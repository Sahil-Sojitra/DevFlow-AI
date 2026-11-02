import { NextResponse, type NextRequest } from 'next/server';
import { ExecutionStorageService } from '@/services/execution-storage';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId') || undefined;

    const storage = new ExecutionStorageService();
    const quota = storage.getModelQuotaStatus(sessionId);

    return NextResponse.json({
      status: 'ok',
      quota,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        status: 'error',
        error: (err as Error).message || 'Failed to calculate model quota status',
      },
      { status: 500 }
    );
  }
}
