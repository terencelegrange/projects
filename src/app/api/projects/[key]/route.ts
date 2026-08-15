import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";
import { auditLog, getIp } from "@/lib/audit";
import { ensureProjectStatuses } from "@/lib/projectStatuses";

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
      include: {
        lead: { select: { id: true, name: true, email: true, avatar: true } },
        labels: true,
        statuses: { orderBy: { order: "asc" } },
        issues: {
          select: {
            id: true,
            status: true,
            priority: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const statuses = project.statuses.length > 0 ? project.statuses : await ensureProjectStatuses(project.id);
    const doneKeys = new Set(statuses.filter((s) => s.is_done).map((s) => s.key));
    if (doneKeys.size === 0) doneKeys.add("done");

    const totalIssues = project.issues.length;
    const doneIssues = project.issues.filter((i) => doneKeys.has(i.status)).length;
    const completionRate = totalIssues > 0 ? Math.round((doneIssues / totalIssues) * 100) : 0;

    const countByStatus: Record<string, number> = {};
    for (const st of statuses) {
      countByStatus[st.key] = 0;
    }
    for (const iss of project.issues) {
      countByStatus[iss.status] = (countByStatus[iss.status] || 0) + 1;
    }

    return NextResponse.json({
      id: project.id,
      key: project.key,
      name: project.name,
      description: project.description,
      color: project.color,
      icon: project.icon,
      lead: project.lead,
      labels: project.labels,
      statuses,
      created_at: project.created_at,
      updated_at: project.updated_at,
      stats: {
        total: totalIssues,
        done: doneIssues,
        completionRate,
        byStatus: countByStatus,
      },
    });
  } catch (error) {
    console.error("[GET /api/projects/[key]] error:", error);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { key } = await params;
    const projectKey = key.toUpperCase();
    const body = await req.json();

    const { name, description, color, lead_id } = body;

    const existing = await prisma.project.findUnique({ where: { key: projectKey } });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const updated = await prisma.project.update({
      where: { key: projectKey },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(color !== undefined && { color }),
        ...(lead_id !== undefined && { lead_id: lead_id ? Number(lead_id) : null }),
      },
      include: {
        lead: { select: { id: true, name: true, email: true, avatar: true } },
        statuses: { orderBy: { order: "asc" } },
      },
    });

    await auditLog({
      userId: session.sub ? Number(session.sub) : null,
      action: "PROJECT_UPDATED",
      resource: "project",
      resourceId: updated.key,
      details: { name: updated.name },
      ip: getIp(req),
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/projects/[key]] error:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { key } = await params;
    const projectKey = key.toUpperCase();

    const existing = await prisma.project.findUnique({ where: { key: projectKey } });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await prisma.project.delete({ where: { key: projectKey } });

    await auditLog({
      userId: session.sub ? Number(session.sub) : null,
      action: "PROJECT_DELETED",
      resource: "project",
      resourceId: projectKey,
      details: { name: existing.name },
      ip: getIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/projects/[key]] error:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
