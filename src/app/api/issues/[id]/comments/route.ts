import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";
import { auditLog, getIp } from "@/lib/audit";

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

    const comments = await prisma.issueComment.findMany({
      where: { issue_id: issueId },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { created_at: "asc" },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("[GET /api/issues/[id]/comments] error:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDb();
    const session = await getSession();
    if (!session || !session.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const issueId = await resolveIssueId(id);
    if (!issueId) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

    const body = await req.json();
    const { content } = body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Comment content is required" }, { status: 400 });
    }

    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: true },
    });
    if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

    const comment = await prisma.issueComment.create({
      data: {
        issue_id: issueId,
        user_id: Number(session.sub),
        content: content.trim(),
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    const issueKey = `${issue.project.key}-${issue.issue_number}`;

    await auditLog({
      userId: Number(session.sub),
      action: "COMMENT_ADDED",
      resource: "issue",
      resourceId: issueKey,
      details: { commentId: comment.id, issueKey },
      ip: getIp(req),
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("[POST /api/issues/[id]/comments] error:", error);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}
