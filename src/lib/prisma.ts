import { PrismaClient } from "@prisma/client";
import { getSiteConfig } from "./setup";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export function getDatabaseUrl(): string | undefined {
  const config = getSiteConfig();
  if (config?.db && config.db.dialect === "mysql") {
    const { user, password, host, port, name } = config.db;
    const encodedUser = encodeURIComponent(user);
    const encodedPass = encodeURIComponent(password);
    return `mysql://${encodedUser}:${encodedPass}@${host}:${port || 3306}/${name}`;
  }
  return process.env.DATABASE_URL;
}

function createPrismaClient(): PrismaClient {
  const url = getDatabaseUrl();
  if (url) {
    return new PrismaClient({
      datasources: {
        db: {
          url,
        },
      },
      log: ["error"],
    });
  }
  return new PrismaClient({ log: ["error"] });
}

export function resetPrisma(): void {
  if (globalForPrisma.prisma) {
    globalForPrisma.prisma.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
  }
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient();
    }
    const val = (globalForPrisma.prisma as unknown as Record<string, unknown>)[prop as string];
    if (typeof val === "function") {
      return val.bind(globalForPrisma.prisma);
    }
    return val;
  },
});
