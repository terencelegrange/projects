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

    const projects = await prisma.project.findMany({
      include: {
        lead: { select: { id: true, name: true, email: true, avatar: true } },
        issues: {
          select: {
            id: true,
            status: true,
            priority: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    const enriched = projects.map((p) => {
      const totalIssues = p.issues.length;
      const doneIssues = p.issues.filter((i) => i.status === "done").length;
      const inProgressIssues = p.issues.filter((i) => i.status === "in_progress").length;
      const todoIssues = p.issues.filter((i) => i.status === "todo").length;
      const backlogIssues = p.issues.filter((i) => i.status === "backlog").length;
      const completionRate = totalIssues > 0 ? Math.round((doneIssues / totalIssues) * 100) : 0;

      return {
        id: p.id,
        key: p.key,
        name: p.name,
        description: p.description,
        color: p.color,
        icon: p.icon,
        lead: p.lead,
        created_at: p.created_at,
        updated_at: p.updated_at,
        stats: {
          total: totalIssues,
          done: doneIssues,
          in_progress: inProgressIssues,
          todo: todoIssues,
          backlog: backlogIssues,
          completionRate,
        },
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("[GET /api/projects] error:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    let { key, name, description, color, lead_id } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    if (!key || typeof key !== "string") {
      key = name.trim().slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!key) key = "PRJ";
    } else {
      key = key.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    }

    if (key.length < 2 || key.length > 10) {
      return NextResponse.json({ error: "Project key must be between 2 and 10 alphanumeric characters" }, { status: 400 });
    }

    const existing = await prisma.project.findUnique({ where: { key } });
    if (existing) {
      return NextResponse.json({ error: `Project key '${key}' already exists` }, { status: 409 });
    }

    const project = await prisma.project.create({
      data: {
        key,
        name: name.trim(),
        description: description?.trim() || null,
        color: color || "#3b82f6",
        lead_id: lead_id ? Number(lead_id) : (session.sub ? Number(session.sub) : null),
      },
      include: {
        lead: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    await auditLog({
      userId: session.sub ? Number(session.sub) : null,
      action: "PROJECT_CREATED",
      resource: "project",
      resourceId: project.key,
      details: { name: project.name, key: project.key },
      ip: getIp(req),
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("[POST /api/projects] error:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
