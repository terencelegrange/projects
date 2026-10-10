import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";
import { getEventsBus, WebhookPayload } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/events/stream
 * Server-Sent Events (SSE) stream for real-time ticket, card, status, and project event updates.
 * Query Parameters:
 *   - projectKey?: string (Filter events to a specific project workspace, e.g. "CORE")
 *   - since?: string | number (Replay missed events since timestamp)
 */
export async function GET(req: NextRequest) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filterProjectKey = searchParams.get("projectKey")?.toUpperCase();
    const sinceParam = searchParams.get("since") || req.headers.get("last-event-id");

    const encoder = new TextEncoder();
    let isClosed = false;
    let heartbeatTimer: NodeJS.Timeout | null = null;
    let eventListener: ((payload: WebhookPayload) => void) | null = null;

    const stream = new ReadableStream({
      async start(controller) {
        function safeEnqueue(text: string) {
          if (isClosed) return;
          try {
            controller.enqueue(encoder.encode(text));
          } catch {
            isClosed = true;
          }
        }

        // 1. Send initial connected event
        safeEnqueue(`event: open\ndata: ${JSON.stringify({ status: "connected", projectKey: filterProjectKey || null, time: new Date().toISOString() })}\n\n`);

        // 2. Replay recent missed events if since parameter was provided
        if (sinceParam) {
          try {
            const sinceDate = !isNaN(Number(sinceParam))
              ? new Date(Number(sinceParam))
              : new Date(sinceParam);

            if (!isNaN(sinceDate.getTime())) {
              const missedEvents = await prisma.systemEvent.findMany({
                where: {
                  created_at: { gte: sinceDate },
                  ...(filterProjectKey ? { project_key: filterProjectKey } : {}),
                },
                orderBy: { created_at: "asc" },
                take: 50,
              });

              for (const ev of missedEvents) {
                let parsedPayload: any = null;
                try {
                  parsedPayload = JSON.parse(ev.payload);
                } catch {
                  parsedPayload = ev.payload;
                }
                safeEnqueue(`id: ${ev.event_id}\nevent: ${ev.event_type}\ndata: ${JSON.stringify(parsedPayload)}\n\n`);
              }
            }
          } catch (e) {
            console.error("[events/stream] Failed to replay missed events:", e);
          }
        }

        // 3. Register live event bus listener
        eventListener = (payload: WebhookPayload) => {
          if (isClosed) return;
          if (filterProjectKey && payload.project.key.toUpperCase() !== filterProjectKey) {
            return;
          }

          const sseData = `id: ${payload.id}\nevent: ${payload.event}\ndata: ${JSON.stringify(payload)}\n\n`;
          safeEnqueue(sseData);
        };

        const bus = getEventsBus();
        bus.on("system_event", eventListener);

        // 4. Heartbeat interval to prevent socket timeout (every 15 seconds)
        heartbeatTimer = setInterval(() => {
          if (isClosed) {
            if (heartbeatTimer) clearInterval(heartbeatTimer);
            return;
          }
          safeEnqueue(": heartbeat\n\n");
        }, 15000);
      },

      cancel() {
        isClosed = true;
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        if (eventListener) {
          getEventsBus().off("system_event", eventListener);
          eventListener = null;
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform, no-store",
        "Connection": "keep-alive",
        "Content-Encoding": "none",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[GET /api/events/stream] error:", error);
    return NextResponse.json({ error: "Failed to establish event stream" }, { status: 500 });
  }
}
