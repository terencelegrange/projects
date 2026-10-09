import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { isSetupComplete, writeSiteConfig, type DbConfig } from "@/lib/setup";
import { resetPrisma, prisma } from "@/lib/prisma";
import { initDb } from "@/lib/initDb";
import { auditLog } from "@/lib/audit";

export async function POST(req: Request) {
  if (isSetupComplete()) {
    return NextResponse.json(
      { error: "Setup has already been completed." },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const { db, appName, orgName, admin } = body;

    if (!db?.host || !db?.user || !db?.name) {
      return NextResponse.json(
        { error: "Host, username, and database name are required." },
        { status: 400 }
      );
    }

    if (!admin?.email?.trim() || !admin?.password) {
      return NextResponse.json(
        { error: "Administrator email and password are required." },
        { status: 400 }
      );
    }

    if (admin.password.length < 8) {
      return NextResponse.json(
        { error: "Administrator password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const dbConfig: DbConfig = {
      dialect: "mysql",
      host: db.host.trim(),
      port: Number(db.port) || 3306,
      user: db.user.trim(),
      password: db.password ?? "",
      name: db.name.trim(),
    };

    const finalAppName = (appName || "Projects").trim();
    const finalOrgName = (orgName || "").trim();

    // 1. Write site.config.json in incomplete state so credentials can be read
    writeSiteConfig({
      setupComplete: false,
      appName: finalAppName,
      orgName: finalOrgName,
      db: dbConfig,
    });

    // 2. Write/update .env.local for persistence
    const encodedUser = encodeURIComponent(dbConfig.user);
    const encodedPass = encodeURIComponent(dbConfig.password);
    const databaseUrl = `mysql://${encodedUser}:${encodedPass}@${dbConfig.host}:${dbConfig.port}/${dbConfig.name}`;
    
    const envLocalPath = path.join(process.cwd(), ".env.local");
    const envContent = `DATABASE_URL="${databaseUrl}"\n`;
    fs.writeFileSync(envLocalPath, envContent, "utf-8");

    // 3. Reset and bootstrap Prisma DB
    resetPrisma();
    await initDb();

    // 4. Create first administrator user account
    const hashedPassword = await bcrypt.hash(admin.password, 10);
    const adminEmail = admin.email.toLowerCase().trim();
    const adminName = (admin.name || "").trim() || null;

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    let userId: number;
    if (existing) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          password_hash: hashedPassword,
          name: adminName,
          role: "admin",
          status: "approved",
        },
      });
      userId = updated.id;
    } else {
      const created = await prisma.user.create({
        data: {
          email: adminEmail,
          password_hash: hashedPassword,
          name: adminName,
          role: "admin",
          status: "approved",
          theme: "dark",
        },
      });
      userId = created.id;
    }

    // 5. Mark setup as complete
    writeSiteConfig({
      setupComplete: true,
      appName: finalAppName,
      orgName: finalOrgName,
      db: dbConfig,
    });

    // 6. Record audit log
    await auditLog({
      userId,
      action: "SETUP_COMPLETED",
      resource: "system",
      details: { appName: finalAppName, adminEmail },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Setup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
