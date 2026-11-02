import { NextRequest, NextResponse } from 'next/server';
import { ImplementationExecutor } from '@/services/executor';
import { CreatePullRequestSchema } from '@/types/execution';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    let options = {};
    try {
      const rawBody = await request.json();
      const parsed = CreatePullRequestSchema.safeParse(rawBody);
      if (parsed.success) {
        options = parsed.data;
      }
    } catch {
      // Body is optional
    }

    const executor = new ImplementationExecutor();
    const result = await executor.createPullRequest(id, options);

    return NextResponse.json({
      success: true,
      sessionId: id,
      prUrl: result.prUrl,
      prNumber: result.prNumber,
      message: result.message,
      session: result.session,
    });
  } catch (err: unknown) {
    const message = (err as Error).message || 'Failed to create pull request';
    return NextResponse.json(
      { error: message },
      { status: message.includes('not found') ? 404 : 400 }
    );
  }
}
