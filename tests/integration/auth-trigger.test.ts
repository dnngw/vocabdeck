import { afterAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Use a disposable TEST_DATABASE_URL ending in _test.");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url, max: 2 }),
});
afterAll(() => db.$disconnect());

it("only activates confirmed invitations and ignores public role/status metadata", async () => {
  const invitedId = randomUUID();
  const signupId = randomUUID();
  try {
    await db.$transaction(async (tx) => {
      // A temporary table exercises the real migrated trigger function without
      // creating, altering or dropping Supabase-owned auth.users.
      await tx.$executeRawUnsafe(
        "CREATE TEMP TABLE auth_user_fixture (id uuid, raw_user_meta_data jsonb, invited_at timestamptz, email_confirmed_at timestamptz) ON COMMIT DROP",
      );
      await tx.$executeRawUnsafe(
        "CREATE TRIGGER fixture_sync AFTER INSERT OR UPDATE OF invited_at, email_confirmed_at ON auth_user_fixture FOR EACH ROW EXECUTE FUNCTION vocabdeck.sync_invited_profile()",
      );
      await tx.$executeRaw`INSERT INTO auth_user_fixture VALUES (${signupId}::uuid, '{"role":"admin","status":"active"}'::jsonb, NULL, now())`;
      expect(
        await tx.profile.findUnique({ where: { id: signupId } }),
      ).toMatchObject({ role: "user", status: "pending" });
      await tx.$executeRaw`INSERT INTO auth_user_fixture VALUES (${invitedId}::uuid, '{"display_name":"Invited learner","role":"admin"}'::jsonb, now(), NULL)`;
      expect(
        await tx.profile.findUnique({ where: { id: invitedId } }),
      ).toMatchObject({ role: "user", status: "pending" });
      await tx.$executeRaw`UPDATE auth_user_fixture SET email_confirmed_at = now() WHERE id = ${invitedId}::uuid`;
      expect(
        await tx.profile.findUnique({ where: { id: invitedId } }),
      ).toMatchObject({ role: "user", status: "active" });
      await tx.profile.update({
        where: { id: invitedId },
        data: { status: "suspended" },
      });
      await tx.$executeRaw`UPDATE auth_user_fixture SET email_confirmed_at = now() WHERE id = ${invitedId}::uuid`;
      expect(
        await tx.profile.findUnique({ where: { id: invitedId } }),
      ).toMatchObject({ status: "suspended" });
    });
  } finally {
    await db.profile.deleteMany({
      where: { id: { in: [invitedId, signupId] } },
    });
  }
});
