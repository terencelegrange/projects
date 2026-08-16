import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";
import { auditLog, getIp } from "@/lib/audit";
import { ensureIssueTypes } from "@/lib/issueTypes";

export async function GET(req: NextRequest) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const issueTypes = await ensureIssueTypes();

    // Get count of issues grouped by type
    const issueCounts = await prisma.issue.groupBy({
      by: ["type"],
      _count: { id: true },
    });

    const countMap: Record<string, number> = {};
    for (const c of issueCounts) {
      countMap[c.type] = c._count.id;
    }

    const typesWithCounts = issueTypes.map((t) => ({
      ...t,
      issuesCount: countMap[t.key] || 0,
    }));

    return NextResponse.json({ issueTypes: typesWithCounts });
  } catch (error) {
    console.error("[GET /api/issue-types] error:", error);
    return NextResponse.json({ error: "Failed to fetch issue types" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session as any).role || "viewer";
    if (role === "viewer") {
      return NextResponse.json({ error: "Forbidden: Viewer role cannot create issue types" }, { status: 403 });
    }

    const body = await req.json();
    const { name, key, icon, color, description, is_default } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Issue type name is required" }, { status: 400 });
    }

    const typeName = name.trim();
    let typeKey = (key && typeof key === "string" && key.trim())
      ? key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_")
      : typeName.toLowerCase().replace(/[^a-z0-9_]+/g, "_");

    if (!typeKey) {
      typeKey = `type_${Date.now()}`;
    }

    // Check if key already exists
    const existing = await prisma.issueType.findUnique({
      where: { key: typeKey },
    });
    if (existing) {
      return NextResponse.json({ error: `An issue type with key '${typeKey}' already exists.` }, { status: 400 });
    }

    // If is_default is set to true, reset other types
    if (is_default) {
      await prisma.issueType.updateMany({
        data: { is_default: false },
      });
    }

    const created = await prisma.issueType.create({
      data: {
        key: typeKey,
        name: typeName,
        icon: icon?.trim() || "✓",
        color: color || "#3b82f6",
        description: description?.trim() || null,
        is_default: Boolean(is_default),
      },
    });

    await auditLog({
      userId: session.sub ? Number(session.sub) : null,
      action: "ISSUE_TYPE_CREATED",
      resource: "issue_type",
      resourceId: String(created.id),
      details: { key: created.key, name: created.name },
      ip: getIp(req),
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[POST /api/issue-types] error:", error);
    return NextResponse.json({ error: "Failed to create issue type" }, { status: 500 });
  }
}
