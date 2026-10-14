import { NextRequest, NextResponse } from 'next/server';
import { getAppConfig } from '@/config/env';
import { ExecutionStorageService, ExecutionConcurrencyError } from '@/services/execution-storage';
import { ImplementationExecutor } from '@/services/executor';
import { CreateExecutionRequestSchema } from '@/types/execution';

export async function GET() {
  try {
    const storage = new ExecutionStorageService(getAppConfig());
    const sessions = storage.listSessions();
    return NextResponse.json({ sessions });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to list execution sessions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  const parsed = CreateExecutionRequestSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Validation error: ${parsed.error.errors.map((e) => e.message).join(', ')}` },
      { status: 400 }
    );
  }

  const config = getAppConfig();
  const executor = new ImplementationExecutor({ config });

  try {
    const session = await executor.startExecutionSession(parsed.data);
    return NextResponse.json({ success: true, session }, { status: 201 });
  } catch (err: unknown) {
    const message = (err as Error).message;

    if (err instanceof ExecutionConcurrencyError) {
      return NextResponse.json({ error: message, code: 'CONCURRENCY_CONFLICT' }, { status: 409 });
    }

    if (message.includes('No implementation plan found')) {
      return NextResponse.json({ error: message, code: 'PLAN_NOT_FOUND' }, { status: 404 });
    }

    if (message.includes('review status is')) {
      return NextResponse.json({ error: message, code: 'PLAN_NOT_APPROVED' }, { status: 400 });
    }

    if (message.includes('Repository has uncommitted changes')) {
      return NextResponse.json({ error: message, code: 'DIRTY_REPO_BLOCKED' }, { status: 400 });
    }

    if (message.includes('not permitted') || message.includes('allowlist')) {
      return NextResponse.json({ error: message, code: 'UNAUTHORIZED_PATH' }, { status: 403 });
    }

    return NextResponse.json(
      { error: message || 'Failed to start execution session' },
      { status: 500 }
    );
  }
}
