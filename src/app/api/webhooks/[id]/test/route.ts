import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";

export async function POST(
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
        project: { select: { id: true, key: true, name: true } },
      },
    });

    if (!webhook) return NextResponse.json({ error: "Webhook not found" }, { status: 404 });

    const eventId = `evt_test_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const timestamp = new Date().toISOString();

    const testPayload = {
      id: eventId,
      event: "webhook.test",
      action: "ping",
      timestamp,
      actor: session.sub ? { id: Number(session.sub), name: session.name || null, email: session.email } : null,
      project: webhook.project || { id: 0, key: "SYSTEM", name: "System Wide" },
      message: "This is a test notification from Projects Webhook System.",
      api_urls: {
        events: "/api/events",
        webhooks: "/api/webhooks",
        project: webhook.project ? `/api/projects/${webhook.project.key}` : undefined,
      },
    };

    const payloadString = JSON.stringify(testPayload);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Projects-Webhook/1.0",
      "X-Event-Type": "webhook.test",
      "X-Event-ID": eventId,
      "X-Event-Action": "ping",
    };

    if (webhook.secret) {
      const hmac = crypto.createHmac("sha256", webhook.secret);
      hmac.update(payloadString);
      headers["X-Webhook-Signature-256"] = `sha256=${hmac.digest("hex")}`;
    }

    const startTime = Date.now();
    let status: number | null = null;
    let responseBody: string | null = null;
    let errorMsg: string | null = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(webhook.url, {
        method: "POST",
        headers,
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      status = res.status;
      const text = await res.text();
      responseBody = text.slice(0, 1000);
    } catch (fetchErr: any) {
      errorMsg = fetchErr.message || String(fetchErr);
    }

    const duration = Date.now() - startTime;

    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhook_id: webhook.id,
        event_id: eventId,
        event_type: "webhook.test",
        payload: payloadString,
        response_status: status,
        response_body: responseBody,
        duration_ms: duration,
        error: errorMsg,
      },
    });

    return NextResponse.json({
      success: status !== null && status >= 200 && status < 300,
      delivery: {
        id: delivery.id,
        eventId,
        status,
        durationMs: duration,
        responseBody,
        error: errorMsg,
        createdAt: delivery.created_at.toISOString(),
      },
    });
  } catch (error) {
    console.error("[POST /api/webhooks/[id]/test] error:", error);
    return NextResponse.json({ error: "Failed to test webhook" }, { status: 500 });
  }
}
