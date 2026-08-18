import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { initDb, hashPassword } from "@/lib/initDb";
import { auditLog, getIp } from "@/lib/audit";

interface UserRow {
  id: number;
  email: string;
  name: string | null;
  role: string;
  status: string;
  avatar: number | null;
  created_at: Date;
  updated_at: Date;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb();
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const rows = await prisma.$queryRaw<UserRow[]>`
    SELECT id, email, name, role, status, avatar, created_at, updated_at
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(rows[0]);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb();
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existingRows = await prisma.$queryRaw<UserRow[]>`
    SELECT id, email, name, role, status, avatar, created_at, updated_at
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;
  if (existingRows.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const existing = existingRows[0];

  const body = await req.json();
  const { name, email, role, status, password, avatar } = body;

  const allowedRoles = ["admin", "editor", "viewer", "user"];
  const allowedStatuses = ["pending", "approved", "rejected"];

  let newEmail = existing.email;
  if (email !== undefined && typeof email === "string" && email.trim()) {
    const normalized = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized)) {
      return NextResponse.json({ error: "Invalid email address format" }, { status: 400 });
    }

    if (normalized !== existing.email.toLowerCase()) {
      const duplicate = await prisma.$queryRaw<{ id: number }[]>`
        SELECT id FROM users WHERE email = ${normalized} AND id != ${userId} LIMIT 1
      `;
      if (duplicate.length > 0) {
        return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
      }
      newEmail = normalized;
    }
  }

  let newName = existing.name;
  if (name !== undefined) {
    newName = typeof name === "string" ? name.trim() || null : null;
  }

  let newRole = existing.role;
  if (role !== undefined && allowedRoles.includes(role)) {
    newRole = role;
  }

  let newStatus = existing.status;
  if (status !== undefined && allowedStatuses.includes(status)) {
    newStatus = status;
  }

  let newAvatar = existing.avatar;
  if (avatar !== undefined) {
    newAvatar = avatar && !isNaN(Number(avatar)) ? Math.max(1, Math.min(127, Number(avatar))) : null;
  }

  // Handle password update if provided
  if (password && typeof password === "string" && password.trim()) {
    if (password.trim().length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
    }
    const newHash = await hashPassword(password.trim());
    await prisma.$executeRaw`
      UPDATE users
      SET password_hash = ${newHash}, updated_at = NOW()
      WHERE id = ${userId}
    `;
  }

  await prisma.$executeRaw`
    UPDATE users
    SET email = ${newEmail},
        name = ${newName},
        role = ${newRole},
        status = ${newStatus},
        avatar = ${newAvatar},
        updated_at = NOW()
    WHERE id = ${userId}
  `;

  const updatedRows = await prisma.$queryRaw<UserRow[]>`
    SELECT id, email, name, role, status, avatar, created_at, updated_at
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;
  const updatedUser = updatedRows[0];

  await auditLog({
    userId: parseInt(session.sub, 10),
    action: "USER_UPDATED",
    resource: "users",
    resourceId: userId,
    details: {
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      status: updatedUser.status,
      passwordChanged: Boolean(password),
    },
    ip: getIp(req),
  });

  return NextResponse.json({ ok: true, user: updatedUser });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb();
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  if (String(userId) === session.sub) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const existingRows = await prisma.$queryRaw<UserRow[]>`
    SELECT id, email, name, role, status FROM users WHERE id = ${userId} LIMIT 1
  `;
  if (existingRows.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const existing = existingRows[0];

  // Clean up references where needed before deletion
  await prisma.$executeRaw`UPDATE projects SET lead_id = NULL WHERE lead_id = ${userId}`;
  await prisma.$executeRaw`UPDATE issues SET assignee_id = NULL WHERE assignee_id = ${userId}`;
  await prisma.$executeRaw`UPDATE issues SET reporter_id = NULL WHERE reporter_id = ${userId}`;
  await prisma.$executeRaw`DELETE FROM issue_comments WHERE user_id = ${userId}`;
  await prisma.$executeRaw`DELETE FROM notifications WHERE user_id = ${userId}`;
  await prisma.$executeRaw`DELETE FROM users WHERE id = ${userId}`;

  await auditLog({
    userId: parseInt(session.sub, 10),
    action: "USER_DELETED",
    resource: "users",
    resourceId: userId,
    details: { email: existing.email, name: existing.name },
    ip: getIp(req),
  });

  return NextResponse.json({ ok: true });
}
