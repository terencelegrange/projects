import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

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
    const { type, endpoint, apiKey, payload, customHeaders } = body;

    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json({ error: "Endpoint URL is required" }, { status: 400 });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(typeof customHeaders === "object" && customHeaders !== null ? customHeaders : {}),
    };

    if (apiKey && String(apiKey).trim()) {
      headers["Authorization"] = `Bearer ${String(apiKey).trim()}`;
    }

    const startTime = Date.now();
    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      response = await fetch(endpoint.trim(), {
        method: "POST",
        headers,
        body: JSON.stringify(payload ?? {}),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch (fetchErr: unknown) {
      const elapsed = Date.now() - startTime;
      const message = fetchErr instanceof Error ? fetchErr.message : "Network fetch failed";
      return NextResponse.json({
        success: false,
        latencyMs: elapsed,
        error: message,
      });
    }

    const elapsed = Date.now() - startTime;
    const status = response.status;
    const statusText = response.statusText;
    let responseBody: unknown;

    try {
      const text = await response.text();
      try {
        responseBody = JSON.parse(text);
      } catch {
        responseBody = text;
      }
    } catch {
      responseBody = null;
    }

    const isOk = status >= 200 && status < 300;

    return NextResponse.json({
      success: isOk,
      statusCode: status,
      statusText,
      latencyMs: elapsed,
      response: responseBody,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to run test";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
