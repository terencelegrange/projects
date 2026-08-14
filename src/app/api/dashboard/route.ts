import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { initDb } from "@/lib/initDb";

export async function GET() {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.sub ? Number(session.sub) : null;

    const [totalUsers]   = await prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM users`;
    const [pendingUsers] = await prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM users WHERE status = 'pending'`;
    const [totalProjects]= await prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM projects`;
    const [totalIssues]  = await prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM issues`;
    const [inProgressIssues] = await prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM issues WHERE status = 'in_progress'`;
    const [doneIssues]   = await prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM issues WHERE status = 'done'`;

    // Active projects with stats
    const projects = await prisma.project.findMany({
      take: 6,
      include: {
        issues: {
          select: { id: true, status: true },
        },
      },
      orderBy: { updated_at: "desc" },
    });

    const activeProjects = projects.map((p) => {
      const tot = p.issues.length;
      const don = p.issues.filter((i) => i.status === "done").length;
      const act = p.issues.filter((i) => i.status === "in_progress").length;
      return {
        id: p.id,
        key: p.key,
        name: p.name,
        color: p.color,
        totalIssues: tot,
        doneIssues: don,
        inProgressIssues: act,
        completionRate: tot > 0 ? Math.round((don / tot) * 100) : 0,
      };
    });

    // My Assigned Issues
    const myIssues = userId
      ? await prisma.issue.findMany({
          where: { assignee_id: userId, status: { not: "done" } },
          take: 6,
          include: {
            project: { select: { key: true, name: true, color: true } },
          },
          orderBy: { updated_at: "desc" },
        })
      : [];

    const myRecentIssues = myIssues.map((iss) => ({
      id: iss.id,
      key: `${iss.project.key}-${iss.issue_number}`,
      title: iss.title,
      status: iss.status,
      priority: iss.priority,
      type: iss.type,
      projectKey: iss.project.key,
      projectName: iss.project.name,
      projectColor: iss.project.color,
    }));

    return NextResponse.json({
      totalUsers:   Number(totalUsers.c),
      pendingUsers: Number(pendingUsers.c),
      totalProjects: Number(totalProjects.c),
      totalIssues: Number(totalIssues.c),
      inProgressIssues: Number(inProgressIssues.c),
      doneIssues: Number(doneIssues.c),
      activeProjects,
      myRecentIssues,
    });
  } catch (e) {
    console.error("[GET /api/dashboard] error:", e);
    return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
  }
}
