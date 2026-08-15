import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";
import { auditLog, getIp } from "@/lib/audit";
import { notifyStatusChange } from "@/lib/notifications";

async function resolveIssueId(idStr: string): Promise<number | null> {
  const numeric = Number(idStr);
  if (!isNaN(numeric)) return numeric;

  if (idStr.includes("-")) {
    const parts = idStr.split("-");
    const projKey = parts[0].toUpperCase();
    const issueNum = Number(parts[1]);
    if (!isNaN(issueNum)) {
      const issue = await prisma.issue.findFirst({
        where: {
          project: { key: projKey },
          issue_number: issueNum,
        },
        select: { id: true },
      });
      return issue?.id ?? null;
    }
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const issueId = await resolveIssueId(id);
    if (!issueId) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        project: { select: { id: true, key: true, name: true, color: true } },
        assignee: { select: { id: true, name: true, email: true, avatar: true } },
        reporter: { select: { id: true, name: true, email: true, avatar: true } },
        labels: { include: { label: true } },
        comments: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
          orderBy: { created_at: "asc" },
        },
      },
    });

    if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

    const issueKey = `${issue.project.key}-${issue.issue_number}`;

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
      project: issue.project,
      assignee: issue.assignee,
      reporter: issue.reporter,
      labels: issue.labels.map((l) => l.label),
      comments: issue.comments,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
    });
  } catch (error) {
    console.error("[GET /api/issues/[id]] error:", error);
    return NextResponse.json({ error: "Failed to fetch issue" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const issueId = await resolveIssueId(id);
    if (!issueId) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

    const existing = await prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: true },
    });
    if (!existing) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

    const body = await req.json();
    const { title, description, status, priority, type, assignee_id, due_date, estimate, label_ids, position } = body;

    const data: any = {};
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (status !== undefined) data.status = status;
    if (priority !== undefined) data.priority = priority;
    if (type !== undefined) data.type = type;
    if (position !== undefined) data.position = Number(position);
    if (assignee_id !== undefined) data.assignee_id = assignee_id ? Number(assignee_id) : null;
    if (due_date !== undefined) data.due_date = due_date ? new Date(due_date) : null;
    if (estimate !== undefined) data.estimate = estimate ? Number(estimate) : null;

    if (Array.isArray(label_ids)) {
      await prisma.issueLabel.deleteMany({ where: { issue_id: issueId } });
      if (label_ids.length > 0) {
        data.labels = {
          create: label_ids.map((lid: number) => ({
            label: { connect: { id: Number(lid) } },
          })),
        };
      }
    }

    const updated = await prisma.issue.update({
      where: { id: issueId },
      data,
      include: {
        project: { select: { id: true, key: true, name: true, color: true } },
        assignee: { select: { id: true, name: true, email: true, avatar: true } },
        reporter: { select: { id: true, name: true, email: true, avatar: true } },
        labels: { include: { label: true } },
        _count: { select: { comments: true } },
      },
    });

    const issueKey = `${updated.project.key}-${updated.issue_number}`;

    await auditLog({
      userId: session.sub ? Number(session.sub) : null,
      action: "ISSUE_UPDATED",
      resource: "issue",
      resourceId: issueKey,
      details: {
        title: updated.title,
        status: updated.status,
        priority: updated.priority,
        position: updated.position,
        statusChanged: existing.status !== updated.status,
        priorityChanged: existing.priority !== updated.priority,
      },
      ip: getIp(req),
    });

    if (existing.status !== updated.status) {
      await notifyStatusChange({
        projectId: updated.project.id,
        statusKey: updated.status,
        issueKey,
      });
    }

    return NextResponse.json({
      id: updated.id,
      key: issueKey,
      issueNumber: updated.issue_number,
      title: updated.title,
      description: updated.description,
      status: updated.status,
      priority: updated.priority,
      type: updated.type,
      position: updated.position,
      estimate: updated.estimate,
      dueDate: updated.due_date,
      project: updated.project,
      assignee: updated.assignee,
      reporter: updated.reporter,
      labels: updated.labels.map((l) => l.label),
      commentsCount: updated._count.comments,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    });
  } catch (error) {
    console.error("[PATCH /api/issues/[id]] error:", error);
    return NextResponse.json({ error: "Failed to update issue" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const issueId = await resolveIssueId(id);
    if (!issueId) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

    const existing = await prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: true },
    });
    if (!existing) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

    const issueKey = `${existing.project.key}-${existing.issue_number}`;

    await prisma.issue.delete({ where: { id: issueId } });

    await auditLog({
      userId: session.sub ? Number(session.sub) : null,
      action: "ISSUE_DELETED",
      resource: "issue",
      resourceId: issueKey,
      details: { title: existing.title },
      ip: getIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/issues/[id]] error:", error);
    return NextResponse.json({ error: "Failed to delete issue" }, { status: 500 });
  }
}
