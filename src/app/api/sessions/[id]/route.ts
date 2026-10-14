import { NextRequest, NextResponse } from 'next/server';
import { getAppConfig } from '@/config/env';
import { ExecutionStorageService } from '@/services/execution-storage';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const storage = new ExecutionStorageService(getAppConfig());
    const session = storage.getSession(id);

    if (!session) {
      return NextResponse.json({ error: `Execution session "${id}" not found.` }, { status: 404 });
    }

    return NextResponse.json({ session });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || `Failed to read session "${id}".` },
      { status: 500 }
    );
  }
}
