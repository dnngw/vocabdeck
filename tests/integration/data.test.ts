import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { contextForVerifiedIdentity, requireAdmin, type UserContext } from "@/server/auth";
import { ContentService } from "@/server/content";
import { ImportService } from "@/server/import";
import { StudyService } from "@/server/study";

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("TEST_DATABASE_URL must point to a disposable database ending in _test. Apply migrations first.");
const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 5 }) });
const runtimeUrl = new URL(url); runtimeUrl.username = "vocabdeck_app";
// For local tests auth is trust-only. Remote test databases must provide a runtime URL.
runtimeUrl.password = "";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_RUNTIME_DATABASE_URL || runtimeUrl.toString(), max: 5 }) });
const content = new ContentService(db); const study = new StudyService(db);
let a: UserContext; let b: UserContext; let suspendedId: string;
const sample = (word = "take") => ({ word, partOfSpeech: "verb", senses: [
  { meaningInIndonesian: "mengambil", definitionEn: "To get hold of something.", examples: [{ sentenceEn: "Take this book.", translationInIndonesian: "Ambil buku ini." }] },
  { meaningInIndonesian: "membutuhkan waktu", examples: [{ sentenceEn: "It takes two hours." }] },
] });
async function withCards() { const deck = await content.createDeck(a, { name: "Practice" }); await content.addBatch(a, deck.id, [sample()]); return { deck, queue: await study.queue(a, deck.id) }; }

beforeAll(async () => { await admin.$executeRawUnsafe("ALTER ROLE vocabdeck_app LOGIN"); });
beforeEach(async () => {
  const ids = [randomUUID(), randomUUID(), randomUUID()]; suspendedId = ids[2];
  await admin.profile.createMany({ data: ids.map((id, i) => ({ id, status: i === 2 ? "suspended" : "active" })) });
  a = await contextForVerifiedIdentity(db, ids[0]); b = await contextForVerifiedIdentity(db, ids[1]);
});
afterEach(async () => { await admin.profile.deleteMany({ where: { id: { in: [a?.id, b?.id, suspendedId].filter(Boolean) } } }); });
afterAll(async () => { await Promise.all([db.$disconnect(), admin.$disconnect()]); });

describe("private data and authorization on PostgreSQL", () => {
  it("denies suspended accounts and ordinary users acting as admin", async () => {
    await expect(contextForVerifiedIdentity(db, suspendedId)).rejects.toMatchObject({ status: 403 });
    expect(() => requireAdmin(a)).toThrow();
    await admin.profile.update({ where: { id: a.id }, data: { status: "suspended" } });
    await expect(contextForVerifiedIdentity(db, a.id)).rejects.toMatchObject({ status: 403 });
  });
  it("isolates guessed deck, vocabulary, nested examples and reviews", async () => {
    const { deck, queue } = await withCards(); const entry = (await content.getDeck(a, deck.id)).vocabulary[0];
    expect(await content.listDecks(b)).toHaveLength(0);
    const operations = [
      () => content.getDeck(b, deck.id), () => content.updateDeck(b, deck.id, { name: "attack" }),
      () => content.deleteDeck(b, deck.id), () => content.getVocabulary(b, entry.id),
      () => content.updateVocabulary(b, entry.id, sample()), () => content.deleteVocabulary(b, entry.id),
      () => content.addBatch(b, deck.id, [sample("run")]), () => study.queue(b, deck.id),
      () => study.review(b, { progressId: queue.cards[0].id, requestId: randomUUID(), version: 0, rating: 3 }),
    ];
    for (const operation of operations) await expect(operation()).rejects.toMatchObject({ status: 404 });
    expect((await content.getVocabulary(a, entry.id)).senses[0].examples[0].sentenceEn).toBe("Take this book.");
  });
  it("runtime role cannot create an active profile or elevate a role", async () => {
    await expect(db.profile.create({ data: { id: randomUUID(), status: "active", role: "admin" } })).rejects.toThrow();
    await expect(db.profile.update({ where: { id: a.id }, data: { role: "admin" } })).rejects.toThrow();
  });
  it("rejects nested example IDs from another sense and rolls back", async () => {
    const { deck } = await withCards(); const entry = (await content.getDeck(a, deck.id)).vocabulary[0];
    const tampered = structuredClone(entry); tampered.senses[0].examples[0].id = entry.senses[1].examples[0].id;
    await expect(content.updateVocabulary(a, entry.id, tampered)).rejects.toMatchObject({ status: 422 });
    expect((await content.getVocabulary(a, entry.id)).senses[0].examples[0].id).toBe(entry.senses[0].examples[0].id);
  });
});
describe("atomic review scheduling", () => {
  it("separates senses, saves state, replays retries and rejects conflicting request reuse", async () => {
    const { queue } = await withCards(); const card = queue.cards[0];
    const answer = { progressId: card.id, requestId: randomUUID(), version: 0, rating: 3 };
    await study.review(a, answer); expect((await study.review(a, answer)).replayed).toBe(true);
    expect(await db.reviewLog.count({ where: { userId: a.id } })).toBe(1);
    const [p1, p2] = await Promise.all(queue.cards.map(c => db.cardProgress.findUniqueOrThrow({ where: { id: c.id } })));
    expect(p1.version).toBe(1); expect(p2.version).toBe(0); expect(p1.dueAt).not.toEqual(p2.dueAt);
    await expect(study.review(a, { ...answer, rating: 4 })).rejects.toMatchObject({ status: 409 });
  });
  it("allows only one answer against a version under concurrency", async () => {
    const { queue } = await withCards(); const input = { progressId: queue.cards[0].id, version: 0, rating: 1 };
    const results = await Promise.allSettled([study.review(a, { ...input, requestId: randomUUID() }), study.review(a, { ...input, requestId: randomUUID() })]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.reviewLog.count({ where: { userId: a.id } })).toBe(1);
  });
  it("rolls back the progress update if writing the log fails", async () => {
    const { queue } = await withCards(); const requestId = randomUUID();
    await admin.$executeRawUnsafe(`ALTER TABLE vocabdeck.review_logs ADD CONSTRAINT test_log_failure CHECK (request_id <> '${requestId}'::uuid)`);
    try {
      await expect(study.review(a, { progressId: queue.cards[0].id, version: 0, rating: 4, requestId })).rejects.toThrow();
      expect((await db.cardProgress.findUniqueOrThrow({ where: { id: queue.cards[0].id } })).version).toBe(0);
      expect(await db.reviewLog.count({ where: { requestId } })).toBe(0);
    } finally { await admin.$executeRawUnsafe("ALTER TABLE vocabdeck.review_logs DROP CONSTRAINT test_log_failure"); }
  });
  it("enforces a daily new limit atomically across different cards and decks", async () => {
    const { queue } = await withCards(); await study.updateSettings(a, { dailyNewLimit: 1, desiredRetention: .9, timezone: "Asia/Jakarta" });
    const results = await Promise.allSettled(queue.cards.map(c => study.review(a, { progressId: c.id, version: 0, rating: 4, requestId: randomUUID() })));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect((await study.queue(a)).newAvailable).toBe(0);
  });
  it("preserves progress when editing meaning and example text", async () => {
    const { deck, queue } = await withCards(); await study.review(a, { progressId: queue.cards[0].id, version: 0, rating: 3, requestId: randomUUID() });
    const entry = (await content.getDeck(a, deck.id)).vocabulary[0]; entry.senses[0].examples[0].sentenceEn = "Please take this book.";
    await content.updateVocabulary(a, entry.id, entry);
    expect((await db.cardProgress.findUniqueOrThrow({ where: { id: queue.cards[0].id } })).version).toBe(1);
    expect(await db.reviewLog.count({ where: { userId: a.id } })).toBe(1);
  });
});
describe("CSV ingestion", () => {
  it("never writes on preview and deduplicates repeated imports", async () => {
    const deck = await content.createDeck(a, { name: "CSV" }); const service = new ImportService(db);
    const input = { deckId: deck.id, csv: "word,meaning_indonesian,sentence_en\ntake,mengambil,Take this book.\ntake,membutuhkan waktu,It takes two hours.\nrun,,Run fast." };
    const rows = await service.preview(a, input); expect(rows[2].error).toBeTruthy();
    expect((await content.getDeck(a, deck.id)).vocabulary).toHaveLength(0);
    expect((await service.commit(a, { ...input, rows: [2, 3] })).created).toBe(2);
    expect((await service.commit(a, { ...input, rows: [2, 3] })).skipped).toBe(2);
    expect((await content.getDeck(a, deck.id)).vocabulary).toHaveLength(1);
    expect((await study.queue(a, deck.id)).cards).toHaveLength(2);
  });
});
