import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";

/**
 * POST /api/notifications/read-all
 * Marks all of the current user's notifications as read.
 */
export async function POST(req: NextRequest) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = Number(session.sub);

    const result = await prisma.notification.updateMany({
      where: { user_id: userId, read: false },
      data: { read: true },
    });

    return NextResponse.json({ ok: true, updated: result.count });
  } catch (error) {
    console.error("[POST /api/notifications/read-all] error:", error);
    return NextResponse.json({ error: "Failed to mark notifications read" }, { status: 500 });
  }
}
