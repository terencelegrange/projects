import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";

/**
 * GET /api/notifications
 * Returns the current user's recent notification digests (unread first),
 * plus the unread count for the bell badge.
 */
export async function GET(req: NextRequest) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = Number(session.sub);

    const notifications = await prisma.notification.findMany({
      where: { user_id: userId },
      include: {
        project: { select: { key: true, name: true, color: true } },
      },
      orderBy: [{ read: "asc" }, { updated_at: "desc" }],
      take: 30,
    });

    const unreadCount = await prisma.notification.count({
      where: { user_id: userId, read: false },
    });

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        project: n.project,
        statusKey: n.status_key,
        statusName: n.status_name,
        issueKeys: JSON.parse(n.issue_ids) as string[],
        count: n.count,
        read: n.read,
        createdAt: n.created_at,
        updatedAt: n.updated_at,
      })),
      unreadCount,
    });
  } catch (error) {
    console.error("[GET /api/notifications] error:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}
