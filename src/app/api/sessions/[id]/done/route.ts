import { NextRequest, NextResponse } from 'next/server';
import { ImplementationExecutor } from '@/services/executor';
import { MarkDoneSchema } from '@/types/execution';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    let note: string | undefined;
    try {
      const rawBody = await request.json();
      const parsed = MarkDoneSchema.safeParse(rawBody);
      if (parsed.success) {
        note = parsed.data.note;
      }
    } catch {
      // Body is optional
    }

    const executor = new ImplementationExecutor();
    const updatedSession = executor.markSessionDone(id, note);

    return NextResponse.json({
      success: true,
      sessionId: id,
      session: updatedSession,
    });
  } catch (err: unknown) {
    const message = (err as Error).message || 'Failed to mark session as done';
    return NextResponse.json(
      { error: message },
      { status: message.includes('not found') ? 404 : 400 }
    );
  }
}
