import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { host, port, user, password, name } = body;

    if (!host || !user || !name) {
      return NextResponse.json(
        { success: false, error: "Host, username, and database name are required." },
        { status: 400 }
      );
    }

    let connection: mysql.Connection | undefined;
    try {
      connection = await mysql.createConnection({
        host: host.trim(),
        port: Number(port) || 3306,
        user: user.trim(),
        password: password ?? "",
        connectTimeout: 8000,
      });

      // Verify or create the database
      await connection.execute(
        `CREATE DATABASE IF NOT EXISTS \`${name.trim()}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );

      return NextResponse.json({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Database connection failed.";
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    } finally {
      if (connection) {
        await connection.end().catch(() => {});
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
