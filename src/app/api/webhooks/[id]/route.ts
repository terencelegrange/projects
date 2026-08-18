import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";
import { auditLog, getIp } from "@/lib/audit";

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

    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId },
      include: {
        project: { select: { id: true, key: true, name: true, color: true } },
      },
    });

    if (!webhook) return NextResponse.json({ error: "Webhook not found" }, { status: 404 });

    let parsedEvents: string[] = [];
    try {
      parsedEvents = JSON.parse(webhook.events);
    } catch {
      parsedEvents = [webhook.events];
    }

    return NextResponse.json({
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      hasSecret: Boolean(webhook.secret),
      events: parsedEvents,
      project: webhook.project,
      active: webhook.active,
      createdAt: webhook.created_at.toISOString(),
      updatedAt: webhook.updated_at.toISOString(),
    });
  } catch (error) {
    console.error("[GET /api/webhooks/[id]] error:", error);
    return NextResponse.json({ error: "Failed to fetch webhook" }, { status: 500 });
  }
}

export async function PATCH(
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

    const existing = await prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!existing) return NextResponse.json({ error: "Webhook not found" }, { status: 404 });

    const body = await req.json();
    const { name, url, secret, events, project_id, active } = body;

    const data: any = {};
    if (name !== undefined) data.name = name.trim();
    if (url !== undefined) {
      if (!/^https?:\/\//i.test(url.trim())) {
        return NextResponse.json({ error: "A valid HTTP or HTTPS webhook URL is required" }, { status: 400 });
      }
      data.url = url.trim();
    }
    if (secret !== undefined) data.secret = secret ? secret.trim() : null;
    if (active !== undefined) data.active = Boolean(active);
    if (project_id !== undefined) data.project_id = project_id ? Number(project_id) : null;
    if (events !== undefined) {
      data.events = Array.isArray(events) ? JSON.stringify(events) : JSON.stringify([events]);
    }

    const updated = await prisma.webhook.update({
      where: { id: webhookId },
      data,
      include: {
        project: { select: { id: true, key: true, name: true, color: true } },
      },
    });

    await auditLog({
      userId: session.sub ? Number(session.sub) : null,
      action: "WEBHOOK_UPDATED",
      resource: "webhook",
      resourceId: String(updated.id),
      details: { name: updated.name, active: updated.active },
      ip: getIp(req),
    });

    let parsedEvents: string[] = [];
    try {
      parsedEvents = JSON.parse(updated.events);
    } catch {
      parsedEvents = [updated.events];
    }

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      url: updated.url,
      hasSecret: Boolean(updated.secret),
      events: parsedEvents,
      project: updated.project,
      active: updated.active,
      createdAt: updated.created_at.toISOString(),
      updatedAt: updated.updated_at.toISOString(),
    });
  } catch (error) {
    console.error("[PATCH /api/webhooks/[id]] error:", error);
    return NextResponse.json({ error: "Failed to update webhook" }, { status: 500 });
  }
}

export async function DELETE(
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

    const existing = await prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!existing) return NextResponse.json({ error: "Webhook not found" }, { status: 404 });

    await prisma.webhook.delete({ where: { id: webhookId } });

    await auditLog({
      userId: session.sub ? Number(session.sub) : null,
      action: "WEBHOOK_DELETED",
      resource: "webhook",
      resourceId: String(webhookId),
      details: { name: existing.name },
      ip: getIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/webhooks/[id]] error:", error);
    return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 });
  }
}
