import { NextRequest, NextResponse } from 'next/server';
import { ImplementationExecutor } from '@/services/executor';
import { RequestRevisionSchema } from '@/types/execution';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const rawBody = await request.json();
    const parsed = RequestRevisionSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid revision request', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const executor = new ImplementationExecutor();
    const revision = await executor.generateRevisionPlan(id, parsed.data.feedback);

    return NextResponse.json({
      success: true,
      sessionId: id,
      revision,
    });
  } catch (err: unknown) {
    const message = (err as Error).message || 'Failed to generate revision plan';
    return NextResponse.json(
      { error: message },
      { status: message.includes('not found') ? 404 : 500 }
    );
  }
}
