import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { contextForVerifiedIdentity, type UserContext } from "@/server/auth";
import { AIService, type AiLimits } from "@/server/ai";
import { AdminService } from "@/server/admin";
import type { AIProvider, GeneratedResult } from "@/lib/ai/provider";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Use a disposable TEST_DATABASE_URL ending in _test.");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url, max: 5 }),
});
const limits: AiLimits = {
  enabled: true,
  userDaily: 10,
  globalDaily: 100,
  globalConcurrency: 5,
  userPerMinute: 3,
  globalPerMinute: 20,
};
const input = { mode: "word", input: "take", count: 1, level: "B1" };
const result: GeneratedResult = {
  items: [
    {
      word: "take",
      partOfSpeech: "verb",
      senses: [
        {
          meaningInIndonesian: "mengambil",
          definitionEn: "",
          examples: [
            {
              sentenceEn: "Take this book.",
              translationInIndonesian: "",
              contextExplanationInIndonesian: "",
            },
          ],
        },
      ],
    },
  ],
  tokensIn: 30,
  tokensOut: 70,
};
let a: UserContext;
let b: UserContext;
let admin: UserContext;
function provider(
  generate = vi
    .fn<AIProvider["generateVocabulary"]>()
    .mockResolvedValue(result),
): AIProvider {
  return { name: "test", model: "test-model", generateVocabulary: generate };
}
beforeEach(async () => {
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  await db.profile.createMany({
    data: ids.map((id, i) => ({
      id,
      status: "active",
      role: i === 2 ? "admin" : "user",
      invitedAt: new Date(),
      acceptedAt: new Date(),
    })),
  });
  [a, b, admin] = await Promise.all(
    ids.map((id) => contextForVerifiedIdentity(db, id)),
  );
});
afterEach(async () => {
  await db.appSetting.deleteMany({
    where: { updatedBy: { in: [a.id, b.id, admin.id] } },
  });
  await db.auditLog.deleteMany({ where: { actorId: admin.id } });
  await db.profile.deleteMany({
    where: { id: { in: [a.id, b.id, admin.id] } },
  });
});
afterAll(() => db.$disconnect());
describe("AI usage reservations", () => {
  it("logs usage without saving generated vocabulary", async () => {
    await new AIService(db, provider(), limits).generate(a, input);
    expect(
      await db.vocabularyEntry.count({ where: { deck: { ownerId: a.id } } }),
    ).toBe(0);
    const usage = await db.aiUsage.findFirstOrThrow({
      where: { userId: a.id },
    });
    expect(usage).toMatchObject({
      status: "success",
      tokensIn: 30,
      tokensOut: 70,
    });
    expect(Object.keys(usage)).not.toContain("prompt");
  });
  it("counts failed attempts and rejects over-quota calls before the provider", async () => {
    const generate = vi
      .fn<AIProvider["generateVocabulary"]>()
      .mockRejectedValue(new Error("failure"));
    const service = new AIService(db, provider(generate), {
      ...limits,
      userDaily: 1,
    });
    await expect(service.generate(a, input)).rejects.toMatchObject({
      status: 502,
    });
    await expect(service.generate(a, input)).rejects.toMatchObject({
      status: 429,
    });
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("atomically reserves the last global request for only one user", async () => {
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const generate = vi
      .fn<AIProvider["generateVocabulary"]>()
      .mockImplementation(async () => {
        started();
        await blocked;
        return result;
      });
    const service = new AIService(db, provider(generate), {
      ...limits,
      globalDaily: 1,
    });
    const first = service.generate(a, input);
    await ready;
    try {
      await expect(service.generate(b, input)).rejects.toMatchObject({
        status: 429,
      });
    } finally {
      release();
      await first;
    }
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("blocks a second in-flight request for the same user", async () => {
    await db.aiUsage.create({
      data: {
        userId: a.id,
        provider: "test",
        model: "test",
        status: "pending",
      },
    });
    const generate = vi
      .fn<AIProvider["generateVocabulary"]>()
      .mockResolvedValue(result);
    await expect(
      new AIService(db, provider(generate), limits).generate(a, input),
    ).rejects.toMatchObject({ status: 429 });
    expect(generate).not.toHaveBeenCalled();
  });
  it("resets the quota at UTC midnight and expires stale reservations", async () => {
    const now = new Date("2026-11-24T12:00:00Z");
    await db.aiUsage.create({
      data: {
        userId: a.id,
        provider: "test",
        model: "test",
        status: "pending",
        createdAt: new Date("2026-11-23T23:59:00Z"),
      },
    });
    await new AIService(db, provider(), { ...limits, userDaily: 1 }).generate(
      a,
      input,
      now,
    );
    expect(
      await db.aiUsage.count({ where: { userId: a.id, status: "timed_out" } }),
    ).toBe(1);
  });
  it("honors the kill switch and suspension before any provider call", async () => {
    const generate = vi
      .fn<AIProvider["generateVocabulary"]>()
      .mockResolvedValue(result);
    const service = new AIService(db, provider(generate), limits);
    await new AdminService(db).updateAi(admin, { ...limits, enabled: false });
    await expect(service.generate(a, input)).rejects.toMatchObject({
      status: 503,
    });
    await new AdminService(db).updateAi(admin, limits);
    await db.profile.update({
      where: { id: a.id },
      data: { status: "suspended" },
    });
    await expect(service.generate(a, input)).rejects.toMatchObject({
      status: 403,
    });
    expect(generate).not.toHaveBeenCalled();
  });
});
describe("admin authorization", () => {
  it("limits repeated administrative mutations before changing account status", async () => {
    await db.auditLog.createMany({
      data: Array.from({ length: 20 }, () => ({
        actorId: admin.id,
        targetId: a.id,
        action: "account_active",
      })),
    });
    await expect(
      new AdminService(db).setStatus(admin, a.id, { status: "suspended" }),
    ).rejects.toMatchObject({ status: 429, code: "ADMIN_RATE_LIMIT" });
    expect(
      (await db.profile.findUniqueOrThrow({ where: { id: a.id } })).status,
    ).toBe("active");
  });
  it("denies normal users, records status changes and blocks a suspended session", async () => {
    const service = new AdminService(db);
    await expect(service.users(a)).rejects.toMatchObject({ status: 403 });
    await expect(
      service.setStatus(a, b.id, { status: "suspended" }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.updateAi(a, limits)).rejects.toMatchObject({
      status: 403,
    });
    await service.setStatus(admin, a.id, { status: "suspended" });
    await expect(contextForVerifiedIdentity(db, a.id)).rejects.toMatchObject({
      status: 403,
    });
    expect(
      await db.auditLog.count({ where: { actorId: admin.id, targetId: a.id } }),
    ).toBe(1);
    await service.setStatus(admin, a.id, { status: "active" });
    expect((await contextForVerifiedIdentity(db, a.id)).id).toBe(a.id);
  });
});
