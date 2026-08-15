import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";
import { auditLog, getIp } from "@/lib/audit";
import { DEFAULT_STATUSES, getEffectiveStatuses, getStatusLabelMap } from "@/lib/statuses";

/**
 * GET /api/statuses
 * Returns all workflow statuses with custom display labels (if configured) or defaults.
 */
export async function GET() {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const statuses = await getEffectiveStatuses();
    const map = await getStatusLabelMap();

    return NextResponse.json({
      statuses,
      map,
    });
  } catch (error) {
    console.error("[GET /api/statuses] error:", error);
    return NextResponse.json({ error: "Failed to fetch statuses" }, { status: 500 });
  }
}

/**
 * PUT /api/statuses
 * Updates custom status display labels.
 * Body: { mappings: Record<string, string> } or { statuses: Array<{ key: string, label: string }> }
 */
export async function PUT(req: NextRequest) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    let mappings: Record<string, string> = {};

    if (body.mappings && typeof body.mappings === "object") {
      mappings = body.mappings;
    } else if (Array.isArray(body.statuses)) {
      for (const item of body.statuses) {
        if (item.key && typeof item.label === "string") {
          mappings[item.key] = item.label;
        }
      }
    } else if (typeof body === "object") {
      mappings = body;
    }

    const validKeys = new Set(DEFAULT_STATUSES.map((s) => s.key));

    for (const [key, label] of Object.entries(mappings)) {
      if (!validKeys.has(key)) continue;

      const trimmedLabel = typeof label === "string" ? label.trim() : "";
      const defaultObj = DEFAULT_STATUSES.find((s) => s.key === key);

      // If empty or identical to default, remove custom entry
      if (!trimmedLabel || trimmedLabel === defaultObj?.defaultLabel) {
        await prisma.customStatus.deleteMany({ where: { key } });
      } else {
        await prisma.customStatus.upsert({
          where: { key },
          create: { key, label: trimmedLabel },
          update: { label: trimmedLabel },
        });
      }
    }

    await auditLog({
      userId: Number(session.sub),
      action: "STATUS_MAPPINGS_UPDATED",
      resource: "custom_statuses",
      details: mappings,
      ip: getIp(req),
    });

    const updatedStatuses = await getEffectiveStatuses();
    const updatedMap = await getStatusLabelMap();

    return NextResponse.json({
      ok: true,
      statuses: updatedStatuses,
      map: updatedMap,
    });
  } catch (error) {
    console.error("[PUT /api/statuses] error:", error);
    return NextResponse.json({ error: "Failed to update statuses" }, { status: 500 });
  }
}

/**
 * DELETE /api/statuses
 * Resets all status mappings to system defaults.
 */
export async function DELETE(req: NextRequest) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.customStatus.deleteMany();

    await auditLog({
      userId: Number(session.sub),
      action: "STATUS_MAPPINGS_RESET",
      resource: "custom_statuses",
      ip: getIp(req),
    });

    const defaultStatuses = await getEffectiveStatuses();
    const defaultMap = await getStatusLabelMap();

    return NextResponse.json({
      ok: true,
      message: "Reset to default statuses",
      statuses: defaultStatuses,
      map: defaultMap,
    });
  } catch (error) {
    console.error("[DELETE /api/statuses] error:", error);
    return NextResponse.json({ error: "Failed to reset statuses" }, { status: 500 });
  }
}
