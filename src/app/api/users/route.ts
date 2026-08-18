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

export async function GET() {
  await initDb();
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.$queryRaw<UserRow[]>`
    SELECT id, email, name, role, status, avatar, created_at, updated_at
    FROM users
    ORDER BY FIELD(status,'pending','approved','rejected'), created_at DESC
  `;

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  await initDb();
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { email, password, name, role, status, avatar } = body;

  if (!email || typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return NextResponse.json({ error: "Invalid email address format" }, { status: 400 });
  }

  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
  }

  // Check if email already exists
  const existing = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM users WHERE email = ${normalizedEmail} LIMIT 1
  `;
  if (existing.length > 0) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  const allowedRoles = ["viewer", "editor", "admin", "user"];
  const userRole = role && allowedRoles.includes(role) ? role : "viewer";

  const allowedStatuses = ["approved", "pending", "rejected"];
  const userStatus = status && allowedStatuses.includes(status) ? status : "approved";

  const userAvatar = avatar && !isNaN(Number(avatar)) ? Math.max(1, Math.min(127, Number(avatar))) : null;
  const safeName = name && typeof name === "string" ? name.trim() : null;

  const passwordHash = await hashPassword(password);

  await prisma.$executeRaw`
    INSERT INTO users (email, password_hash, name, role, status, avatar, created_at, updated_at)
    VALUES (${normalizedEmail}, ${passwordHash}, ${safeName}, ${userRole}, ${userStatus}, ${userAvatar}, NOW(), NOW())
  `;

  const created = await prisma.$queryRaw<UserRow[]>`
    SELECT id, email, name, role, status, avatar, created_at, updated_at
    FROM users
    WHERE email = ${normalizedEmail}
    LIMIT 1
  `;

  const newUser = created[0];

  await auditLog({
    userId: parseInt(session.sub, 10),
    action: "USER_CREATED",
    resource: "users",
    resourceId: newUser.id,
    details: { email: newUser.email, role: newUser.role, status: newUser.status },
    ip: getIp(req),
  });

  return NextResponse.json(newUser, { status: 201 });
}
