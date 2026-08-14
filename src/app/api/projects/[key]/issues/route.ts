import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";
import { auditLog, getIp } from "@/lib/audit";

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

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const priority = searchParams.get("priority") || "";
    const type = searchParams.get("type") || "";
    const assigneeId = searchParams.get("assigneeId") || "";

    const whereClause: any = {
      project_id: project.id,
    };

    if (status) whereClause.status = status;
    if (priority) whereClause.priority = priority;
    if (type) whereClause.type = type;
    if (assigneeId) {
      if (assigneeId === "unassigned") {
        whereClause.assignee_id = null;
      } else {
        whereClause.assignee_id = Number(assigneeId);
      }
    }

    if (search.trim()) {
      whereClause.OR = [
        { title: { contains: search.trim() } },
        { description: { contains: search.trim() } },
      ];
    }

    const issues = await prisma.issue.findMany({
      where: whereClause,
      include: {
        assignee: { select: { id: true, name: true, email: true, avatar: true } },
        reporter: { select: { id: true, name: true, email: true, avatar: true } },
        labels: {
          include: {
            label: true,
          },
        },
        _count: {
          select: { comments: true },
        },
      },
      orderBy: [
        { position: "asc" },
        { created_at: "desc" },
      ],
    });

    const enriched = issues.map((iss) => ({
      id: iss.id,
      key: `${projectKey}-${iss.issue_number}`,
      issueNumber: iss.issue_number,
      title: iss.title,
      description: iss.description,
      status: iss.status,
      priority: iss.priority,
      type: iss.type,
      position: iss.position,
      estimate: iss.estimate,
      dueDate: iss.due_date,
      assignee: iss.assignee,
      reporter: iss.reporter,
      labels: iss.labels.map((l) => l.label),
      commentsCount: iss._count.comments,
      createdAt: iss.created_at,
      updatedAt: iss.updated_at,
    }));

    return NextResponse.json({
      project,
      issues: enriched,
    });
  } catch (error) {
    console.error("[GET /api/projects/[key]/issues] error:", error);
    return NextResponse.json({ error: "Failed to fetch issues" }, { status: 500 });
  }
}

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
    const { title, description, status, priority, type, assignee_id, due_date, estimate, label_ids, position } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Issue title is required" }, { status: 400 });
    }

    // Determine next issue number for this project
    const latest = await prisma.issue.findFirst({
      where: { project_id: project.id },
      orderBy: { issue_number: "desc" },
      select: { issue_number: true },
    });
    const nextIssueNumber = (latest?.issue_number ?? 0) + 1;

    const issue = await prisma.issue.create({
      data: {
        project_id: project.id,
        issue_number: nextIssueNumber,
        title: title.trim(),
        description: description?.trim() || null,
        status: status || "todo",
        priority: priority || "medium",
        type: type || "task",
        position: position !== undefined ? Number(position) : 0,
        assignee_id: assignee_id ? Number(assignee_id) : null,
        reporter_id: session.sub ? Number(session.sub) : null,
        due_date: due_date ? new Date(due_date) : null,
        estimate: estimate ? Number(estimate) : null,
        ...(Array.isArray(label_ids) && label_ids.length > 0 && {
          labels: {
            create: label_ids.map((lid: number) => ({
              label: { connect: { id: Number(lid) } },
            })),
          },
        }),
      },
      include: {
        assignee: { select: { id: true, name: true, email: true, avatar: true } },
        reporter: { select: { id: true, name: true, email: true, avatar: true } },
        labels: { include: { label: true } },
      },
    });

    const issueKey = `${projectKey}-${issue.issue_number}`;

    await auditLog({
      userId: session.sub ? Number(session.sub) : null,
      action: "ISSUE_CREATED",
      resource: "issue",
      resourceId: issueKey,
      details: { title: issue.title, status: issue.status, priority: issue.priority },
      ip: getIp(req),
    });

    return NextResponse.json({
      id: issue.id,
      key: issueKey,
      issueNumber: issue.issue_number,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      priority: issue.priority,
      type: issue.type,
      position: issue.position,
      estimate: issue.estimate,
      dueDate: issue.due_date,
      assignee: issue.assignee,
      reporter: issue.reporter,
      labels: issue.labels.map((l) => l.label),
      commentsCount: 0,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/projects/[key]/issues] error:", error);
    return NextResponse.json({ error: "Failed to create issue" }, { status: 500 });
  }
}
