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

    const event = await prisma.systemEvent.findFirst({
      where: {
        OR: [
          { event_id: id },
          ...(!isNaN(Number(id)) ? [{ id: Number(id) }] : []),
        ],
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    let parsedPayload: any = null;
    try {
      parsedPayload = JSON.parse(event.payload);
    } catch {
      parsedPayload = event.payload;
    }

    return NextResponse.json({
      id: event.event_id,
      eventType: event.event_type,
      action: event.action,
      resourceType: event.resource_type,
      resourceKey: event.resource_key,
      projectKey: event.project_key,
      createdAt: event.created_at.toISOString(),
      payload: parsedPayload,
    });
  } catch (error) {
    console.error("[GET /api/events/[id]] error:", error);
    return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 });
  }
}
