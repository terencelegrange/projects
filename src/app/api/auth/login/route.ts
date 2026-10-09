import { NextRequest, NextResponse } from "next/server";
import { initDb, verifyPassword } from "@/lib/initDb";
import { prisma } from "@/lib/prisma";
import { signToken, COOKIE, THEME_COOKIE } from "@/lib/auth";
import { auditLog, getIp } from "@/lib/audit";
import { isSetupComplete } from "@/lib/setup";

interface UserRow {
  id: number; email: string; password_hash: string;
  role: string; status: string; theme: string; name: string | null;
}

export async function POST(req: NextRequest) {
  if (!isSetupComplete()) {
    return NextResponse.json(
      { error: "Setup is not complete. Please visit /setup to configure the database.", setupRequired: true },
      { status: 503 }
    );
  }

  await initDb();
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const rows = await prisma.$queryRaw<UserRow[]>`
    SELECT id, email, password_hash, role, status, theme, name FROM users WHERE email = ${email} LIMIT 1
  `;
  const user = rows[0] ?? null;

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await auditLog({ action: "LOGIN_FAILED", resource: "sessions", details: { email }, ip: getIp(req) });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (user.status === "pending") {
    return NextResponse.json({ error: "Your account is awaiting approval" }, { status: 403 });
  }
  if (user.status === "rejected") {
    return NextResponse.json({ error: "Your account has been rejected" }, { status: 403 });
  }

  const token = await signToken({ sub: String(user.id), email: user.email, role: user.role, name: user.name });

  await auditLog({ userId: user.id, action: "LOGIN", resource: "sessions", ip: getIp(req) });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  res.cookies.set(THEME_COOKIE, user.theme, { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
