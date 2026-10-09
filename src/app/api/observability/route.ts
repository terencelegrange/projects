import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";
import { getObservabilityConfigs, saveObservabilityConfig } from "@/lib/observability";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configs = await getObservabilityConfigs();
  return NextResponse.json(configs);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { type, enabled, endpoint, apiKey, siteId, logLevel, customHeaders } = body;

    if (type !== "analytics" && type !== "logcollector") {
      return NextResponse.json({ error: "Invalid observability type" }, { status: 400 });
    }

    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json({ error: "Endpoint URL is required" }, { status: 400 });
    }

    const updated = await saveObservabilityConfig(type, {
      enabled: Boolean(enabled),
      endpoint: endpoint.trim(),
      apiKey: apiKey != null ? String(apiKey).trim() : "",
      siteId: siteId != null ? String(siteId).trim() : "projects",
      logLevel: logLevel != null ? String(logLevel).trim() : "info",
      customHeaders: typeof customHeaders === "object" && customHeaders !== null ? customHeaders : {},
    });

    await auditLog({
      userId: parseInt(session.sub, 10) || null,
      action: "UPDATE_OBSERVABILITY_CONFIG",
      resource: "observability",
      resourceId: type,
      details: { type, enabled: Boolean(enabled), endpoint: endpoint.trim() },
      ip: getIp(req),
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update observability settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
