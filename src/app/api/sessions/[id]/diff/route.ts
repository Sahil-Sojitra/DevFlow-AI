import { NextRequest, NextResponse } from 'next/server';
import { getAppConfig } from '@/config/env';
import { ExecutionStorageService } from '@/services/execution-storage';
import { getUnifiedDiff, parseStructuredDiff } from '@/services/git-ops';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const storage = new ExecutionStorageService(getAppConfig());
    const session = storage.getSession(id);

    if (!session) {
      return NextResponse.json({ error: `Session "${id}" not found.` }, { status: 404 });
    }

    const baseRef = session.baseBranch || session.baselineCommit;
    const diff = getUnifiedDiff(session.workingPath, baseRef);
    const structured = parseStructuredDiff(diff);

    return NextResponse.json({
      sessionId: session.id,
      issueIdentifier: session.issueIdentifier,
      workingPath: session.workingPath,
      isIsolated: session.isIsolated,
      baseBranch: session.baseBranch,
      ticketBranch: session.ticketBranch,
      diff,
      files: structured.files,
      totalAdditions: structured.totalAdditions,
      totalDeletions: structured.totalDeletions,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || `Failed to generate diff for session "${id}".` },
      { status: 500 }
    );
  }
}
