import "server-only";
import type { Database } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { UserContext } from "./auth";
import { deckSchema, vocabularySchema, normalize, type VocabularyInput } from "@/lib/validation";
import { StudyScheduler } from "@/lib/scheduler";
import { AppError, notFound } from "./errors";
import { lockActiveUser } from "./transactions";

const detail = { senses: { orderBy: { position: "asc" as const }, include: { examples: { orderBy: { position: "asc" as const } } } } };
export class ContentService {
  constructor(private db: Database) {}
  listDecks(user: UserContext) {
    return this.db.deck.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" }, include: { _count: { select: { vocabulary: true } } } });
  }
  async getDeck(user: UserContext, id: string, search = "") {
    const deck = await this.db.deck.findFirst({ where: { id, ownerId: user.id }, include: { vocabulary: { where: search ? { word: { contains: search.slice(0, 120), mode: "insensitive" } } : {}, orderBy: { word: "asc" }, take: 200, include: detail }, _count: { select: { vocabulary: true } } } });
    return deck || notFound();
  }
  async createDeck(user: UserContext, input: unknown) {
    return this.db.deck.create({ data: { ...deckSchema.parse(input), ownerId: user.id } });
  }
  async updateDeck(user: UserContext, id: string, input: unknown) {
    const result = await this.db.deck.updateMany({ where: { id, ownerId: user.id }, data: deckSchema.parse(input) });
    if (!result.count) notFound(); return { id };
  }
  async deleteDeck(user: UserContext, id: string) {
    const result = await this.db.deck.deleteMany({ where: { id, ownerId: user.id } });
    if (!result.count) notFound(); return { deleted: true };
  }
  async getVocabulary(user: UserContext, id: string) {
    const entry = await this.db.vocabularyEntry.findFirst({ where: { id, deck: { ownerId: user.id } }, include: { ...detail, deck: { select: { id: true, name: true } } } });
    return entry || notFound();
  }
  async deleteVocabulary(user: UserContext, id: string) {
    const result = await this.db.vocabularyEntry.deleteMany({ where: { id, deck: { ownerId: user.id } } });
    if (!result.count) notFound(); return { deleted: true };
  }
  async previewBatch(user: UserContext, deckId: string, raw: unknown[]) {
    if (raw.length < 1 || raw.length > 20) throw new AppError(422, "INVALID_COUNT", "Pilih 1–20 kata.");
    const items = raw.map(item => vocabularySchema.parse(item));
    if (!await this.db.deck.findFirst({ where: { id: deckId, ownerId: user.id } })) notFound();
    const existing = await this.db.vocabularyEntry.findMany({ where: { deckId, deck: { ownerId: user.id }, normalized: { in: items.map(i => normalize(i.word)) } }, include: { senses: true } });
    const seen = new Set(existing.flatMap(e => e.senses.map(s => `${e.normalized}\0${e.partOfSpeech}\0${s.normalized}`)));
    return items.map(item => {
      let duplicateSenses = 0;
      for (const sense of item.senses) {
        const key = `${normalize(item.word)}\0${item.partOfSpeech}\0${normalize(sense.meaningInIndonesian)}`;
        if (seen.has(key)) duplicateSenses++;
        seen.add(key);
      }
      return { duplicateSenses, allDuplicate: duplicateSenses === item.senses.length };
    });
  }
  async addBatch(user: UserContext, deckId: string, raw: unknown[], source = "manual") {
    if (raw.length < 1 || raw.length > 500) throw new AppError(422, "INVALID_COUNT", "Pilih 1–500 entri.");
    const items = raw.map(item => vocabularySchema.parse(item));
    const scheduler = await StudyScheduler.create();
    return this.db.$transaction(async tx => {
      await lockActiveUser(tx, user);
      if (!await tx.deck.findFirst({ where: { id: deckId, ownerId: user.id } })) notFound();
      let created = 0; let skipped = 0;
      const entryIds = new Set<string>();
      for (const item of items) {
        const entry = await tx.vocabularyEntry.upsert({ where: { deckId_normalized_partOfSpeech: { deckId, normalized: normalize(item.word), partOfSpeech: item.partOfSpeech } }, create: { deckId, word: item.word, normalized: normalize(item.word), partOfSpeech: item.partOfSpeech, source }, update: {} });
        entryIds.add(entry.id);
        let position = await tx.wordSense.count({ where: { vocabularyId: entry.id } });
        for (const sense of item.senses) {
          if (await tx.wordSense.findUnique({ where: { vocabularyId_normalized: { vocabularyId: entry.id, normalized: normalize(sense.meaningInIndonesian) } } })) { skipped++; continue; }
          if (position >= 5) throw new AppError(422, "TOO_MANY_SENSES", `Kata ${item.word} akan memiliki lebih dari 5 makna. Edit entri yang ada terlebih dahulu.`);
          await this.createSense(tx, user.id, entry.id, sense, position++, scheduler);
          created++;
        }
      }
      return { created, skipped, entryIds: [...entryIds] };
    }, { timeout: 30_000 });
  }
  private async createSense(tx: Prisma.TransactionClient, userId: string, vocabularyId: string, input: VocabularyInput["senses"][number], position: number, scheduler: StudyScheduler) {
    const sense = await tx.wordSense.create({ data: { vocabularyId, meaningInIndonesian: input.meaningInIndonesian, normalized: normalize(input.meaningInIndonesian), definitionEn: input.definitionEn, position, examples: { create: input.examples.map(({ id: _id, ...example }, i) => ({ ...example, position: i })) } }, include: { examples: { orderBy: { position: "asc" } } } });
    const now = new Date(); const card = scheduler.newCard(now);
    await tx.card.create({ data: { senseId: sense.id, defaultExampleId: sense.examples[0].id, progress: { create: { userId, dueAt: now, fsrsData: scheduler.serialize(card) } } } });
    return sense;
  }
  async updateVocabulary(user: UserContext, id: string, raw: unknown) {
    const item = vocabularySchema.parse(raw); const scheduler = await StudyScheduler.create();
    return this.db.$transaction(async tx => {
      await lockActiveUser(tx, user);
      const current = await tx.vocabularyEntry.findFirst({ where: { id, deck: { ownerId: user.id } }, include: detail });
      if (!current) notFound();
      const retainedIds = item.senses.flatMap(s => s.id ? [s.id] : []);
      if (new Set(retainedIds).size !== retainedIds.length || retainedIds.some(id => !current.senses.some(s => s.id === id))) throw new AppError(422, "INVALID_SENSE", "Makna tidak sesuai dengan entri.");
      await tx.vocabularyEntry.update({ where: { id }, data: { word: item.word, normalized: normalize(item.word), partOfSpeech: item.partOfSpeech } });
      await tx.wordSense.deleteMany({ where: { vocabularyId: id, id: { notIn: retainedIds } } });
      for (const [position, sense] of item.senses.entries()) {
        if (!sense.id) { await this.createSense(tx, user.id, id, sense, position, scheduler); continue; }
        const old = current.senses.find(s => s.id === sense.id)!;
        const exampleIds: string[] = [];
        for (const [i, example] of sense.examples.entries()) {
          const { id: exampleId, ...data } = example;
          if (exampleId && (!old.examples.some(e => e.id === exampleId) || exampleIds.includes(exampleId))) throw new AppError(422, "INVALID_EXAMPLE", "Contoh tidak sesuai dengan makna.");
          const result = exampleId ? await tx.example.update({ where: { id: exampleId }, data: { ...data, position: i } }) : await tx.example.create({ data: { ...data, senseId: sense.id, position: i } });
          exampleIds.push(result.id);
        }
        // Move the stable example reference before deleting removed examples.
        // The card and its progress keep the same IDs for typo/content edits.
        await tx.card.updateMany({ where: { senseId: sense.id }, data: { defaultExampleId: exampleIds[0] } });
        await tx.example.deleteMany({ where: { senseId: sense.id, id: { notIn: exampleIds } } });
        await tx.wordSense.update({ where: { id: sense.id }, data: { meaningInIndonesian: sense.meaningInIndonesian, normalized: normalize(sense.meaningInIndonesian), definitionEn: sense.definitionEn, position } });
      }
      return { id };
    }, { timeout: 30_000 });
  }
}
