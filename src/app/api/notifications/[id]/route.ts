import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";

/**
 * PATCH /api/notifications/[id]
 * Marks a single notification digest as read. Body: { read?: boolean }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = Number(session.sub);
    const { id } = await params;
    const notificationId = Number(id);

    const existing = await prisma.notification.findFirst({
      where: { id: notificationId, user_id: userId },
    });
    if (!existing) return NextResponse.json({ error: "Notification not found" }, { status: 404 });

    let read = true;
    try {
      const body = await req.json();
      if (typeof body?.read === "boolean") read = body.read;
    } catch {
      // No body -- default to marking read
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { read },
    });

    return NextResponse.json({ id: updated.id, read: updated.read });
  } catch (error) {
    console.error("[PATCH /api/notifications/[id]] error:", error);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}
