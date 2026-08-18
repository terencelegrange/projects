import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";
import { auditLog, getIp } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const webhooks = await prisma.webhook.findMany({
      include: {
        project: { select: { id: true, key: true, name: true, color: true } },
        deliveries: {
          orderBy: { created_at: "desc" },
          take: 1,
          select: {
            id: true,
            response_status: true,
            created_at: true,
            duration_ms: true,
            error: true,
          },
        },
        _count: {
          select: { deliveries: true },
        },
      },
      orderBy: { created_at: "desc" },
    });

    const enriched = webhooks.map((w) => {
      let parsedEvents: string[] = [];
      try {
        parsedEvents = JSON.parse(w.events);
      } catch {
        parsedEvents = w.events.split(",").map((s) => s.trim());
      }

      const lastDelivery = w.deliveries[0] || null;

      return {
        id: w.id,
        name: w.name,
        url: w.url,
        hasSecret: Boolean(w.secret),
        events: parsedEvents,
        project: w.project,
        active: w.active,
        totalDeliveries: w._count.deliveries,
        lastDelivery: lastDelivery
          ? {
              status: lastDelivery.response_status,
              durationMs: lastDelivery.duration_ms,
              createdAt: lastDelivery.created_at.toISOString(),
              error: lastDelivery.error,
            }
          : null,
        createdAt: w.created_at.toISOString(),
        updatedAt: w.updated_at.toISOString(),
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("[GET /api/webhooks] error:", error);
    return NextResponse.json({ error: "Failed to fetch webhooks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, url, secret, events, project_id, active } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Webhook name is required" }, { status: 400 });
    }

    if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url.trim())) {
      return NextResponse.json({ error: "A valid HTTP or HTTPS webhook URL is required" }, { status: 400 });
    }

    let formattedEvents = JSON.stringify(["*"]);
    if (Array.isArray(events) && events.length > 0) {
      formattedEvents = JSON.stringify(events);
    } else if (typeof events === "string" && events.trim()) {
      formattedEvents = JSON.stringify([events.trim()]);
    }

    const webhook = await prisma.webhook.create({
      data: {
        name: name.trim(),
        url: url.trim(),
        secret: secret?.trim() || null,
        events: formattedEvents,
        project_id: project_id ? Number(project_id) : null,
        active: active !== undefined ? Boolean(active) : true,
        created_by: session.sub ? Number(session.sub) : null,
      },
      include: {
        project: { select: { id: true, key: true, name: true, color: true } },
      },
    });

    await auditLog({
      userId: session.sub ? Number(session.sub) : null,
      action: "WEBHOOK_CREATED",
      resource: "webhook",
      resourceId: String(webhook.id),
      details: { name: webhook.name, url: webhook.url },
      ip: getIp(req),
    });

    let parsedEvents: string[] = [];
    try {
      parsedEvents = JSON.parse(webhook.events);
    } catch {
      parsedEvents = [webhook.events];
    }

    return NextResponse.json(
      {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        hasSecret: Boolean(webhook.secret),
        events: parsedEvents,
        project: webhook.project,
        active: webhook.active,
        totalDeliveries: 0,
        lastDelivery: null,
        createdAt: webhook.created_at.toISOString(),
        updatedAt: webhook.updated_at.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/webhooks] error:", error);
    return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 });
  }
}
