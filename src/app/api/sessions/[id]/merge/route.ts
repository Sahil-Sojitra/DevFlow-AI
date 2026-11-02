import { NextRequest, NextResponse } from 'next/server';
import { ImplementationExecutor } from '@/services/executor';
import { MergeSessionSchema } from '@/types/execution';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    let options = {};
    try {
      const rawBody = await request.json();
      const parsed = MergeSessionSchema.safeParse(rawBody);
      if (parsed.success) {
        options = parsed.data;
      }
    } catch {
      // Body is optional
    }

    const executor = new ImplementationExecutor();
    const updatedSession = executor.mergeSession(id, options);

    return NextResponse.json({
      success: true,
      sessionId: id,
      session: updatedSession,
    });
  } catch (err: unknown) {
    const message = (err as Error).message || 'Failed to merge session branch';
    return NextResponse.json(
      { error: message },
      { status: message.includes('not found') ? 404 : 400 }
    );
  }
}
