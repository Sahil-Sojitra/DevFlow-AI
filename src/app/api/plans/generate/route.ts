import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAppConfig } from '@/config/env';
import { LinearAdapter } from '@/adapters/linear';
import { TicketPlanner, PlanAlreadyExistsError } from '@/services/planner';
import { RepositoryRegistry } from '@/services/repo-registry';
import { PlanStorageService, DuplicatePlanGenerationError } from '@/services/plan-storage';

const GeneratePlanRequestSchema = z.object({
  issueIdentifier: z.string().min(1, 'issueIdentifier is required'),
  repoPath: z.string().optional(),
  overwrite: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  const parsed = GeneratePlanRequestSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Validation error: ${parsed.error.errors.map((e) => e.message).join(', ')}` },
      { status: 400 }
    );
  }

  const { issueIdentifier, repoPath, overwrite } = parsed.data;
  const config = getAppConfig();
  const storage = new PlanStorageService(config);

  // 1. Concurrency lock to prevent duplicate runs for the same ticket
  let releaseLock: (() => void) | undefined;
  try {
    releaseLock = storage.acquireGenerationLock(issueIdentifier);
  } catch (err: unknown) {
    if (err instanceof DuplicatePlanGenerationError) {
      return NextResponse.json({ error: err.message, code: 'DUPLICATE_GENERATION' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to acquire generation lock' }, { status: 500 });
  }

  try {
    // 2. Validate repository containment
    const registry = new RepositoryRegistry(config);
    const targetRepo = registry.resolveAndValidateRepo(
      repoPath || config.allowedWorkingDirs[0] || process.cwd()
    );

    // 3. Fetch issue details from Linear
    const linear = new LinearAdapter(config);
    const issue = await linear.getIssue(issueIdentifier);
    if (!issue) {
      return NextResponse.json(
        { error: `Issue "${issueIdentifier}" was not found in Linear.` },
        { status: 404 }
      );
    }

    // 4. Run TicketPlanner
    const planner = new TicketPlanner(config);
    const result = await planner.generatePlan(issue, {
      repoPath: targetRepo,
      overwrite: Boolean(overwrite),
    });

    // 5. Initialize or reset review state to pending
    storage.saveReview(issue.identifier, 'pending');

    return NextResponse.json({
      success: true,
      plan: {
        issueIdentifier: result.issueIdentifier,
        issueTitle: result.issueTitle,
        filePath: result.filePath,
        repoPath: result.repoPath,
        branch: result.branch,
        generatedAt: result.generatedAt,
        durationMs: result.durationMs,
        content: result.content,
        reviewStatus: 'pending',
      },
    });
  } catch (err: unknown) {
    if (err instanceof PlanAlreadyExistsError) {
      return NextResponse.json(
        { error: err.message, code: 'PLAN_EXISTS', needsConfirmation: true },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to generate implementation plan' },
      { status: 500 }
    );
  } finally {
    if (releaseLock) {
      releaseLock();
    }
  }
}
