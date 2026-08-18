import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";

export async function GET(req: NextRequest) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const since = searchParams.get("since");
    const projectKey = searchParams.get("projectKey")?.toUpperCase();
    const eventType = searchParams.get("eventType");
    const action = searchParams.get("action");
    const resourceKey = searchParams.get("resourceKey")?.toUpperCase();
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 200);
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);

    const where: any = {};

    if (projectKey) {
      where.project_key = projectKey;
    }

    if (eventType) {
      if (eventType.endsWith(".*")) {
        const prefix = eventType.slice(0, -2);
        where.event_type = { startsWith: `${prefix}.` };
      } else {
        where.event_type = eventType;
      }
    }

    if (action) {
      where.action = action;
    }

    if (resourceKey) {
      where.resource_key = resourceKey;
    }

    if (since) {
      const sinceDate = !isNaN(Number(since)) ? new Date(Number(since)) : new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        where.created_at = { gte: sinceDate };
      }
    }

    const [total, events] = await Promise.all([
      prisma.systemEvent.count({ where }),
      prisma.systemEvent.findMany({
        where,
        orderBy: { created_at: "desc" },
        take: limit,
        skip: offset,
      }),
    ]);

    const parsedEvents = events.map((ev) => {
      let parsedPayload: any = null;
      try {
        parsedPayload = JSON.parse(ev.payload);
      } catch {
        parsedPayload = ev.payload;
      }

      return {
        id: ev.event_id,
        eventType: ev.event_type,
        action: ev.action,
        resourceType: ev.resource_type,
        resourceKey: ev.resource_key,
        projectKey: ev.project_key,
        createdAt: ev.created_at.toISOString(),
        payload: parsedPayload,
      };
    });

    return NextResponse.json({
      total,
      limit,
      offset,
      events: parsedEvents,
    });
  } catch (error) {
    console.error("[GET /api/events] error:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}
