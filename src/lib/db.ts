import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalDb = globalThis as unknown as { vocabdeckDb?: PrismaClient };
export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  if (!globalDb.vocabdeckDb) {
    globalDb.vocabdeckDb = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 20_000 }) });
  }
  return globalDb.vocabdeckDb;
}
export type Database = PrismaClient;
