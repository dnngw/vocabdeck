import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
export function testDb() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test"))
    throw new Error(
      "E2E requires a disposable TEST_DATABASE_URL ending in _test.",
    );
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url, max: 3 }),
  });
}
