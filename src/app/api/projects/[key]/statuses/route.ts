import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";
import { auditLog, getIp } from "@/lib/audit";
import { ensureProjectStatuses } from "@/lib/projectStatuses";

/**
 * GET /api/projects/[key]/statuses
 * Returns all statuses for the project ordered by `order ASC`.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { key } = await params;
    const projectKey = key.toUpperCase();

    const project = await prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true, key: true, name: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const statuses = await ensureProjectStatuses(project.id);

    return NextResponse.json({
      project,
      statuses,
    });
  } catch (error) {
    console.error("[GET /api/projects/[key]/statuses] error:", error);
    return NextResponse.json({ error: "Failed to fetch project statuses" }, { status: 500 });
  }
}

/**
 * POST /api/projects/[key]/statuses
 * Create a new status stage for this project.
 * Body: { name: string, key?: string, color?: string, order?: number, is_done?: boolean }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { key } = await params;
    const projectKey = key.toUpperCase();

    const project = await prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true, key: true, name: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json();
    let { name, key: statusKey, color, order, is_done } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Status name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();
    if (!statusKey || typeof statusKey !== "string" || !statusKey.trim()) {
      statusKey = trimmedName.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
      if (!statusKey) statusKey = `status_${Date.now()}`;
    } else {
      statusKey = statusKey.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    }

    // Ensure status key is unique within this project
    const existing = await prisma.projectStatus.findUnique({
      where: {
        project_status_key: {
          project_id: project.id,
          key: statusKey,
        },
      },
    });

    if (existing) {
      statusKey = `${statusKey}_${Date.now().toString().slice(-4)}`;
    }

    const currentStatuses = await prisma.projectStatus.findMany({
      where: { project_id: project.id },
      orderBy: { order: "asc" },
    });

    let targetOrder = Number(order);
    if (!order || isNaN(targetOrder) || targetOrder < 1) {
      targetOrder = currentStatuses.length + 1;
    } else if (targetOrder <= currentStatuses.length) {
      // Shift existing statuses to make room for targetOrder
      for (const st of currentStatuses) {
        if (st.order >= targetOrder) {
          await prisma.projectStatus.update({
            where: { id: st.id },
            data: { order: st.order + 1 },
          });
        }
      }
    }

    const newStatus = await prisma.projectStatus.create({
      data: {
        project_id: project.id,
        key: statusKey,
        name: trimmedName,
        order: targetOrder,
        color: color || "#3b82f6",
        is_done: Boolean(is_done),
      },
    });

    // Cleanly re-index all statuses 1..N
    const allStatuses = await prisma.projectStatus.findMany({
      where: { project_id: project.id },
      orderBy: { order: "asc" },
    });

    for (let i = 0; i < allStatuses.length; i++) {
      if (allStatuses[i].order !== i + 1) {
        await prisma.projectStatus.update({
          where: { id: allStatuses[i].id },
          data: { order: i + 1 },
        });
      }
    }

    await auditLog({
      userId: session.sub ? Number(session.sub) : null,
      action: "PROJECT_STATUS_CREATED",
      resource: "project_status",
      resourceId: `${projectKey}:${newStatus.key}`,
      details: { name: newStatus.name, order: newStatus.order },
      ip: getIp(req),
    });

    const refreshed = await prisma.projectStatus.findMany({
      where: { project_id: project.id },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({
      status: newStatus,
      statuses: refreshed,
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/projects/[key]/statuses] error:", error);
    return NextResponse.json({ error: "Failed to create project status" }, { status: 500 });
  }
}

/**
 * PUT /api/projects/[key]/statuses
 * Batch re-orders statuses for this project.
 * Body: { statusIds: number[] } or { items: Array<{ id: number, order: number }> }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { key } = await params;
    const projectKey = key.toUpperCase();

    const project = await prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true, key: true, name: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json();

    if (Array.isArray(body.statusIds)) {
      for (let i = 0; i < body.statusIds.length; i++) {
        const sid = Number(body.statusIds[i]);
        await prisma.projectStatus.updateMany({
          where: { id: sid, project_id: project.id },
          data: { order: i + 1 },
        });
      }
    } else if (Array.isArray(body.items)) {
      for (const item of body.items) {
        if (item.id && typeof item.order === "number") {
          await prisma.projectStatus.updateMany({
            where: { id: Number(item.id), project_id: project.id },
            data: { order: Number(item.order) },
          });
        }
      }
    }

    const updated = await prisma.projectStatus.findMany({
      where: { project_id: project.id },
      orderBy: { order: "asc" },
    });

    // Ensure strict 1..N order
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].order !== i + 1) {
        await prisma.projectStatus.update({
          where: { id: updated[i].id },
          data: { order: i + 1 },
        });
        updated[i].order = i + 1;
      }
    }

    await auditLog({
      userId: session.sub ? Number(session.sub) : null,
      action: "PROJECT_STATUSES_REORDERED",
      resource: "project_statuses",
      resourceId: projectKey,
      details: { order: updated.map((s) => ({ id: s.id, key: s.key, order: s.order })) },
      ip: getIp(req),
    });

    return NextResponse.json({
      ok: true,
      statuses: updated,
    });
  } catch (error) {
    console.error("[PUT /api/projects/[key]/statuses] error:", error);
    return NextResponse.json({ error: "Failed to reorder statuses" }, { status: 500 });
  }
}
