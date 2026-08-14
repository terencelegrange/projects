import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { prisma } from "./prisma";

export const COOKIE = "bp_token";
export const THEME_COOKIE = "bp_theme";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fallback-secret-change-me"
);

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  name: string | null;
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getSessionFromApiKey(rawKey: string): Promise<JwtPayload | null> {
  try {
    const keyHash = await sha256Hex(rawKey);
    const rows = await prisma.$queryRaw<{
      id: number; active: number; expires_at: Date | null; created_by: number | null;
    }[]>`
      SELECT id, active, expires_at, created_by FROM api_keys
      WHERE key_hash = ${keyHash} AND active = 1
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `;
    if (!rows[0]) return null;

    // Update last_used (fire and forget)
    prisma.$executeRaw`UPDATE api_keys SET last_used = NOW() WHERE id = ${rows[0].id}`.catch(() => {});

    const userId = rows[0].created_by ? String(rows[0].created_by) : "1";

    // API keys get admin-level access
    return { sub: userId, email: "api@local", role: "admin", name: "API Key" };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JwtPayload | null> {
  // 1. Check Authorization: Bearer header (API key support)
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const rawKey = authHeader.slice(7).trim();
    if (rawKey.startsWith("bp_")) {
      const apiKeySession = await getSessionFromApiKey(rawKey);
      if (apiKeySession) return apiKeySession;
    } else {
      // Could be a raw JWT Bearer token
      const jwtSession = await verifyToken(rawKey);
      if (jwtSession) return jwtSession;
      // Or fallback to API key lookup
      const apiKeySession = await getSessionFromApiKey(rawKey);
      if (apiKeySession) return apiKeySession;
    }
  }

  // 2. Fall back to cookie-based JWT
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}
