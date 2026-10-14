import { NextRequest, NextResponse } from 'next/server';
import { ImplementationExecutor } from '@/services/executor';
import { ApplyRevisionSchema } from '@/types/execution';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const rawBody = await request.json();
    const parsed = ApplyRevisionSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid revision apply request', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const executor = new ImplementationExecutor();
    const updatedSession = await executor.applyRevision(
      id,
      parsed.data.planContent,
      parsed.data.feedback
    );

    return NextResponse.json({
      success: true,
      sessionId: id,
      session: updatedSession,
    });
  } catch (err: unknown) {
    const message = (err as Error).message || 'Failed to apply revision';
    return NextResponse.json(
      { error: message },
      { status: message.includes('not found') ? 404 : 500 }
    );
  }
}
