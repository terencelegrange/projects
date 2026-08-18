import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const webhookId = Number(id);
    if (isNaN(webhookId)) return NextResponse.json({ error: "Invalid webhook ID" }, { status: 400 });

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhook_id: webhookId },
      orderBy: { created_at: "desc" },
      take: 50,
    });

    const parsed = deliveries.map((d) => {
      let parsedPayload: any = null;
      try {
        parsedPayload = JSON.parse(d.payload);
      } catch {
        parsedPayload = d.payload;
      }

      return {
        id: d.id,
        eventId: d.event_id,
        eventType: d.event_type,
        responseStatus: d.response_status,
        responseBody: d.response_body,
        durationMs: d.duration_ms,
        error: d.error,
        createdAt: d.created_at.toISOString(),
        payload: parsedPayload,
      };
    });

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[GET /api/webhooks/[id]/deliveries] error:", error);
    return NextResponse.json({ error: "Failed to fetch webhook deliveries" }, { status: 500 });
  }
}
