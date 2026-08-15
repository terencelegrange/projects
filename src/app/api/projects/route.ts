import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";
import { auditLog, getIp } from "@/lib/audit";
import { ensureProjectStatuses } from "@/lib/projectStatuses";

export async function GET(req: NextRequest) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const projects = await prisma.project.findMany({
      include: {
        lead: { select: { id: true, name: true, email: true, avatar: true } },
        statuses: { orderBy: { order: "asc" } },
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

    const enriched = await Promise.all(
      projects.map(async (p) => {
        const statuses = p.statuses.length > 0 ? p.statuses : await ensureProjectStatuses(p.id);
        const doneKeys = new Set(statuses.filter((s) => s.is_done).map((s) => s.key));
        if (doneKeys.size === 0) doneKeys.add("done");

        const totalIssues = p.issues.length;
        const doneIssues = p.issues.filter((i) => doneKeys.has(i.status)).length;
        const completionRate = totalIssues > 0 ? Math.round((doneIssues / totalIssues) * 100) : 0;

        // Group counts by status key
        const countByStatus: Record<string, number> = {};
        for (const st of statuses) {
          countByStatus[st.key] = 0;
        }
        for (const iss of p.issues) {
          countByStatus[iss.status] = (countByStatus[iss.status] || 0) + 1;
        }

        return {
          id: p.id,
          key: p.key,
          name: p.name,
          description: p.description,
          color: p.color,
          icon: p.icon,
          lead: p.lead,
          statuses,
          created_at: p.created_at,
          updated_at: p.updated_at,
          stats: {
            total: totalIssues,
            done: doneIssues,
            in_progress: countByStatus["in_progress"] || 0,
            todo: countByStatus["todo"] || 0,
            backlog: countByStatus["backlog"] || 0,
            completionRate,
            byStatus: countByStatus,
          },
        };
      })
    );

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
    let { key, name, description, color, lead_id, initial_statuses } = body;

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

    // Provision custom statuses or defaults 1-5
    if (Array.isArray(initial_statuses) && initial_statuses.length > 0) {
      for (let i = 0; i < initial_statuses.length; i++) {
        const item = initial_statuses[i];
        const sName = typeof item === "string" ? item : item.name;
        const sKey = typeof item === "string" ? item.toLowerCase().replace(/[^a-z0-9_]+/g, "_") : (item.key || sName.toLowerCase().replace(/[^a-z0-9_]+/g, "_"));
        const isDone = typeof item === "object" ? Boolean(item.is_done) : i === initial_statuses.length - 1;
        const sColor = typeof item === "object" ? item.color : undefined;

        await prisma.projectStatus.create({
          data: {
            project_id: project.id,
            key: sKey,
            name: sName,
            order: i + 1,
            color: sColor || "#3b82f6",
            is_done: isDone,
          },
        });
      }
    } else {
      await ensureProjectStatuses(project.id);
    }

    const fullProject = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        lead: { select: { id: true, name: true, email: true, avatar: true } },
        statuses: { orderBy: { order: "asc" } },
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

    return NextResponse.json(fullProject, { status: 201 });
  } catch (error) {
    console.error("[POST /api/projects] error:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
