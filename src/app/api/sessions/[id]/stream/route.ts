import { NextRequest, NextResponse } from 'next/server';
import { ExecutionStorageService, sessionEventEmitter, type SessionStreamEvent } from '@/services/execution-storage';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const storage = new ExecutionStorageService();
  const session = storage.getSession(id);

  if (!session) {
    return NextResponse.json({ error: `Session "${id}" not found.` }, { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial session snapshot
      controller.enqueue(
        encoder.encode(`event: session\ndata: ${JSON.stringify(session)}\n\n`)
      );

      // If already terminal, close stream
      if (['completed', 'failed', 'cancelled', 'blocked'].includes(session.status)) {
        try {
          controller.close();
        } catch {
          // Ignore
        }
        return;
      }

      let isCleanedUp = false;

      const cleanup = () => {
        if (isCleanedUp) return;
        isCleanedUp = true;
        clearInterval(heartbeatTimer);
        sessionEventEmitter.off(`session:${id}`, onSessionEvent);
      };

      // 2. Listen to real-time events from EventEmitter
      const onSessionEvent = (eventData: SessionStreamEvent) => {
        if (isCleanedUp) return;
        try {
          const payload = eventData.session || eventData;
          controller.enqueue(
            encoder.encode(`event: session\ndata: ${JSON.stringify(payload)}\n\n`)
          );

          if (
            eventData.type === 'terminal' ||
            ['completed', 'failed', 'cancelled', 'blocked'].includes(eventData.status)
          ) {
            cleanup();
            try {
              controller.close();
            } catch {
              // Ignore
            }
          }
        } catch {
          cleanup();
        }
      };

      sessionEventEmitter.on(`session:${id}`, onSessionEvent);

      // 3. Heartbeat ping every 15s to keep connection alive through proxies
      const heartbeatTimer = setInterval(() => {
        if (isCleanedUp) return;
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          cleanup();
        }
      }, 15000);

      // 4. Client disconnect cleanup
      request.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

