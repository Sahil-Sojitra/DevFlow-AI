import { NextRequest, NextResponse } from 'next/server';
import { getAppConfig } from '@/config/env';
import { ExecutionStorageService } from '@/services/execution-storage';

export async function POST(
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

    if (!['queued', 'running', 'verifying'].includes(session.status)) {
      return NextResponse.json(
        { error: `Session "${id}" cannot be cancelled because it is already in "${session.status}" state.` },
        { status: 400 }
      );
    }

    const cancelled = storage.cancelActiveProcess(id);

    // If already queued or in process, update record
    storage.transitionSession(id, 'cancelled', {
      progressMessage: 'Session was cancelled by user.',
      summary: 'Implementation process cancelled by developer. Files may require manual review.',
      error: 'Execution cancelled by user.',
      endedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      sessionId: id,
      cancelledActiveProcess: cancelled,
      message: 'Session cancellation requested and state updated to cancelled.',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || `Failed to cancel session "${id}".` },
      { status: 500 }
    );
  }
}
