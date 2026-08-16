import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";
import { auditLog, getIp } from "@/lib/audit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session as any).role || "viewer";
    if (role === "viewer") {
      return NextResponse.json({ error: "Forbidden: Viewer role cannot edit issue types" }, { status: 403 });
    }

    const { id } = await params;
    const typeId = Number(id);
    if (!typeId) {
      return NextResponse.json({ error: "Invalid issue type ID" }, { status: 400 });
    }

    const existing = await prisma.issueType.findUnique({
      where: { id: typeId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Issue type not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, key, icon, color, description, is_default } = body;

    let newKey = existing.key;
    if (key !== undefined && key.trim() !== "") {
      newKey = key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
      if (newKey !== existing.key) {
        const duplicate = await prisma.issueType.findUnique({
          where: { key: newKey },
        });
        if (duplicate) {
          return NextResponse.json({ error: `Key '${newKey}' is already in use by another issue type` }, { status: 400 });
        }
      }
    }

    // If is_default changed to true, unset others
    if (is_default === true && !existing.is_default) {
      await prisma.issueType.updateMany({
        where: { id: { not: typeId } },
        data: { is_default: false },
      });
    }

    // If key changed, migrate existing issues referencing the old key
    if (newKey !== existing.key) {
      await prisma.issue.updateMany({
        where: { type: existing.key },
        data: { type: newKey },
      });
    }

    const updated = await prisma.issueType.update({
      where: { id: typeId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(key !== undefined && { key: newKey }),
        ...(icon !== undefined && { icon: icon.trim() || "✓" }),
        ...(color !== undefined && { color }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(is_default !== undefined && { is_default: Boolean(is_default) }),
      },
    });

    await auditLog({
      userId: session.sub ? Number(session.sub) : null,
      action: "ISSUE_TYPE_UPDATED",
      resource: "issue_type",
      resourceId: String(updated.id),
      details: { key: updated.key, name: updated.name, oldKey: existing.key },
      ip: getIp(req),
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/issue-types/[id]] error:", error);
    return NextResponse.json({ error: "Failed to update issue type" }, { status: 500 });
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

    const role = (session as any).role || "viewer";
    if (role === "viewer") {
      return NextResponse.json({ error: "Forbidden: Viewer role cannot delete issue types" }, { status: 403 });
    }

    const { id } = await params;
    const typeId = Number(id);
    if (!typeId) {
      return NextResponse.json({ error: "Invalid issue type ID" }, { status: 400 });
    }

    const existing = await prisma.issueType.findUnique({
      where: { id: typeId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Issue type not found" }, { status: 404 });
    }

    const totalTypes = await prisma.issueType.count();
    if (totalTypes <= 1) {
      return NextResponse.json({ error: "Cannot delete the last remaining issue type" }, { status: 400 });
    }

    // Determine target type for issue migration
    const url = new URL(req.url);
    let migrateToKey = url.searchParams.get("migrateToKey");

    if (!migrateToKey || migrateToKey === existing.key) {
      const fallback = await prisma.issueType.findFirst({
        where: { id: { not: typeId } },
        orderBy: [{ is_default: "desc" }, { id: "asc" }],
      });
      migrateToKey = fallback?.key || "task";
    }

    // Migrate existing issues with the deleted type
    const affected = await prisma.issue.updateMany({
      where: { type: existing.key },
      data: { type: migrateToKey },
    });

    // Delete the issue type
    await prisma.issueType.delete({
      where: { id: typeId },
    });

    // If the deleted type was default, make the target type default
    if (existing.is_default) {
      await prisma.issueType.updateMany({
        where: { key: migrateToKey },
        data: { is_default: true },
      });
    }

    await auditLog({
      userId: session.sub ? Number(session.sub) : null,
      action: "ISSUE_TYPE_DELETED",
      resource: "issue_type",
      resourceId: String(existing.id),
      details: {
        key: existing.key,
        name: existing.name,
        migratedTo: migrateToKey,
        migratedCount: affected.count,
      },
      ip: getIp(req),
    });

    return NextResponse.json({
      success: true,
      migratedTo: migrateToKey,
      migratedCount: affected.count,
    });
  } catch (error) {
    console.error("[DELETE /api/issue-types/[id]] error:", error);
    return NextResponse.json({ error: "Failed to delete issue type" }, { status: 500 });
  }
}
