import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";
import { auditLog, getIp } from "@/lib/audit";

/**
 * PATCH /api/projects/[key]/statuses/[id]
 * Updates a project status stage.
 * Body: { name?: string, key?: string, color?: string, order?: number, is_done?: boolean }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string; id: string }> }
) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { key, id } = await params;
    const projectKey = key.toUpperCase();
    const statusId = Number(id);

    const project = await prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true, key: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const existing = await prisma.projectStatus.findFirst({
      where: { id: statusId, project_id: project.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Status not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, key: newKey, color, order, is_done } = body;

    const data: any = {};
    if (name !== undefined && typeof name === "string" && name.trim()) {
      data.name = name.trim();
    }
    if (newKey !== undefined && typeof newKey === "string" && newKey.trim()) {
      const sanitizedKey = newKey.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
      if (sanitizedKey !== existing.key) {
        // Also update any issues currently using old key
        await prisma.issue.updateMany({
          where: { project_id: project.id, status: existing.key },
          data: { status: sanitizedKey },
        });
        data.key = sanitizedKey;
      }
    }
    if (color !== undefined) {
      data.color = color;
    }
    if (is_done !== undefined) {
      data.is_done = Boolean(is_done);
    }
    if (order !== undefined && typeof order === "number") {
      data.order = Number(order);
    }

    const updated = await prisma.projectStatus.update({
      where: { id: statusId },
      data,
    });

    // Re-index all statuses for project to maintain strict 1..N order
    const all = await prisma.projectStatus.findMany({
      where: { project_id: project.id },
      orderBy: { order: "asc" },
    });

    for (let i = 0; i < all.length; i++) {
      if (all[i].order !== i + 1) {
        await prisma.projectStatus.update({
          where: { id: all[i].id },
          data: { order: i + 1 },
        });
        all[i].order = i + 1;
      }
    }

    await auditLog({
      userId: session.sub ? Number(session.sub) : null,
      action: "PROJECT_STATUS_UPDATED",
      resource: "project_status",
      resourceId: `${projectKey}:${updated.key}`,
      details: data,
      ip: getIp(req),
    });

    return NextResponse.json({
      status: updated,
      statuses: all,
    });
  } catch (error) {
    console.error("[PATCH /api/projects/[key]/statuses/[id]] error:", error);
    return NextResponse.json({ error: "Failed to update project status" }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[key]/statuses/[id]
 * Deletes a project status and migrates existing issues if necessary.
 * Query / Body parameter: migrateToKey?: string
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ key: string; id: string }> }
) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { key, id } = await params;
    const projectKey = key.toUpperCase();
    const statusId = Number(id);

    const project = await prisma.project.findUnique({
      where: { key: projectKey },
      select: { id: true, key: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const existing = await prisma.projectStatus.findFirst({
      where: { id: statusId, project_id: project.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Status not found" }, { status: 404 });
    }

    // Check how many statuses are remaining. Must keep at least 1 status.
    const remainingCount = await prisma.projectStatus.count({
      where: { project_id: project.id },
    });

    if (remainingCount <= 1) {
      return NextResponse.json({
        error: "A project must have at least one workflow status stage",
      }, { status: 400 });
    }

    // Read optional migration target
    const { searchParams } = new URL(req.url);
    let migrateToKey = searchParams.get("migrateToKey");
    if (!migrateToKey) {
      try {
        const body = await req.json();
        migrateToKey = body?.migrateToKey;
      } catch {
        // No body
      }
    }

    // If no migrate target specified, migrate issues to first available status
    if (!migrateToKey) {
      const fallback = await prisma.projectStatus.findFirst({
        where: { project_id: project.id, id: { not: statusId } },
        orderBy: { order: "asc" },
      });
      migrateToKey = fallback?.key || "backlog";
    }

    // Migrate existing issues
    await prisma.issue.updateMany({
      where: { project_id: project.id, status: existing.key },
      data: { status: migrateToKey },
    });

    // Delete the status
    await prisma.projectStatus.delete({
      where: { id: statusId },
    });

    // Re-index remaining statuses to 1..N
    const remaining = await prisma.projectStatus.findMany({
      where: { project_id: project.id },
      orderBy: { order: "asc" },
    });

    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].order !== i + 1) {
        await prisma.projectStatus.update({
          where: { id: remaining[i].id },
          data: { order: i + 1 },
        });
        remaining[i].order = i + 1;
      }
    }

    await auditLog({
      userId: session.sub ? Number(session.sub) : null,
      action: "PROJECT_STATUS_DELETED",
      resource: "project_status",
      resourceId: `${projectKey}:${existing.key}`,
      details: { deletedStatus: existing.name, migratedTo: migrateToKey },
      ip: getIp(req),
    });

    return NextResponse.json({
      success: true,
      migratedTo: migrateToKey,
      statuses: remaining,
    });
  } catch (error) {
    console.error("[DELETE /api/projects/[key]/statuses/[id]] error:", error);
    return NextResponse.json({ error: "Failed to delete project status" }, { status: 500 });
  }
}
