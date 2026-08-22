import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var __lumihubPrisma: PrismaClient | undefined;
}

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const db = globalThis.__lumihubPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__lumihubPrisma = db;
}
