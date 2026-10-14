import { NextRequest, NextResponse } from 'next/server';
import { getAppConfig } from '@/config/env';
import { ExecutionStorageService } from '@/services/execution-storage';
import { getUnifiedDiff } from '@/services/git-ops';

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

    const diff = getUnifiedDiff(session.workingPath);

    return NextResponse.json({
      sessionId: session.id,
      issueIdentifier: session.issueIdentifier,
      workingPath: session.workingPath,
      isIsolated: session.isIsolated,
      diff,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || `Failed to generate diff for session "${id}".` },
      { status: 500 }
    );
  }
}
