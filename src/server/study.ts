import "server-only";
import type { Database } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { StudyScheduler } from "@/lib/scheduler";
import { dayBounds } from "@/lib/time";
import { reviewSchema, settingsSchema } from "@/lib/validation";
import type { UserContext } from "./auth";
import { AppError, notFound } from "./errors";
import { lockActiveUser } from "./transactions";

const defaultSettings = { dailyNewLimit: 10, desiredRetention: 0.9, timezone: "Asia/Jakarta" };
export class StudyService {
  constructor(private db: Database) {}
  async settings(user: UserContext) { return await this.db.userSettings.findUnique({ where: { userId: user.id } }) || defaultSettings; }
  async updateSettings(user: UserContext, raw: unknown) {
    const data = settingsSchema.parse(raw);
    return this.db.userSettings.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  }
  async queue(user: UserContext, deckId?: string, now = new Date()) {
    if (deckId && !await this.db.deck.findFirst({ where: { id: deckId, ownerId: user.id } })) notFound();
    const settings = await this.settings(user); const { start, end } = dayBounds(now, settings.timezone);
    const base = { userId: user.id, card: { active: true, sense: { vocabulary: { deck: { ownerId: user.id }, ...(deckId ? { deckId } : {}) } } } };
    const used = await this.db.cardProgress.count({ where: { userId: user.id, firstReviewAt: { gte: start, lt: end } } });
    const dueWhere = { ...base, state: { not: 0 }, dueAt: { lte: now } };
    const newWhere = { ...base, state: 0 };
    const [due, newCount, dueCards, newCards, next] = await Promise.all([
      this.db.cardProgress.count({ where: dueWhere }), this.db.cardProgress.count({ where: newWhere }),
      this.db.cardProgress.findMany({ where: dueWhere, orderBy: [{ state: "asc" }, { dueAt: "asc" }], take: 50, include: { card: { include: { defaultExample: true, sense: { include: { vocabulary: { include: { deck: true } } } } } } } }),
      this.db.cardProgress.findMany({ where: newWhere, orderBy: { dueAt: "asc" }, take: Math.max(0, settings.dailyNewLimit - used), include: { card: { include: { defaultExample: true, sense: { include: { vocabulary: { include: { deck: true } } } } } } } }),
      this.db.cardProgress.findFirst({ where: { ...base, state: { not: 0 }, dueAt: { gt: now } }, orderBy: { dueAt: "asc" }, select: { dueAt: true } }),
    ]);
    const scheduler = await StudyScheduler.create(settings.desiredRetention);
    const cards = [...dueCards, ...newCards].map(p => ({ id: p.id, version: p.version, state: p.state, word: p.card.sense.vocabulary.word, partOfSpeech: p.card.sense.vocabulary.partOfSpeech, deckName: p.card.sense.vocabulary.deck.name, sentenceEn: p.card.defaultExample.sentenceEn, meaningInIndonesian: p.card.sense.meaningInIndonesian, definitionEn: p.card.sense.definitionEn, translationInIndonesian: p.card.defaultExample.translationInIndonesian, contextExplanationInIndonesian: p.card.defaultExample.contextExplanationInIndonesian, intervals: scheduler.preview(scheduler.deserialize(p.fsrsData), now) }));
    return { cards, due, newAvailable: Math.min(newCount, Math.max(0, settings.dailyNewLimit - used)), newRemaining: newCount, newUsed: used, dailyNewLimit: settings.dailyNewLimit, nextDueAt: next?.dueAt.toISOString() || null, timezone: settings.timezone };
  }
  async review(user: UserContext, raw: unknown, now = new Date()) {
    const input = reviewSchema.parse(raw);
    return this.db.$transaction(async tx => {
      await lockActiveUser(tx, user);
      const duplicate = await tx.reviewLog.findUnique({ where: { requestId: input.requestId } });
      if (duplicate) {
        if (duplicate.userId !== user.id || duplicate.progressId !== input.progressId || duplicate.rating !== input.rating) throw new AppError(409, "REQUEST_CONFLICT", "ID jawaban telah digunakan untuk jawaban lain.");
        return { replayed: true, result: duplicate.after };
      }
      const progress = await tx.cardProgress.findFirst({ where: { id: input.progressId, userId: user.id, card: { active: true, sense: { vocabulary: { deck: { ownerId: user.id } } } } } });
      if (!progress) notFound();
      if (progress.version !== input.version) throw new AppError(409, "STALE_REVIEW", "Kartu sudah dijawab di tab lain. Muat ulang sesi.");
      if (progress.state !== 0 && progress.dueAt > now) throw new AppError(409, "NOT_DUE", "Kartu ini belum waktunya direview.");
      const settings = await tx.userSettings.findUnique({ where: { userId: user.id } }) || defaultSettings;
      if (progress.state === 0) {
        const { start, end } = dayBounds(now, settings.timezone);
        const used = await tx.cardProgress.count({ where: { userId: user.id, firstReviewAt: { gte: start, lt: end } } });
        if (used >= settings.dailyNewLimit) throw new AppError(409, "DAILY_NEW_LIMIT", "Batas kartu baru hari ini sudah tercapai.");
      }
      const scheduler = await StudyScheduler.create(settings.desiredRetention);
      const result = scheduler.review(scheduler.deserialize(progress.fsrsData), input.rating, now);
      const after = { ...scheduler.serialize(result.card), revlog: JSON.parse(JSON.stringify(result.revlog)), version: progress.version + 1 } as Prisma.InputJsonObject;
      const updated = await tx.cardProgress.updateMany({ where: { id: progress.id, userId: user.id, version: input.version }, data: { dueAt: result.card.dueAt, state: result.card.state, lastReviewAt: now, firstReviewAt: progress.firstReviewAt || now, fsrsData: scheduler.serialize(result.card), version: { increment: 1 } } });
      if (updated.count !== 1) throw new AppError(409, "STALE_REVIEW", "Kartu telah berubah. Muat ulang sesi.");
      await tx.reviewLog.create({ data: { userId: user.id, progressId: progress.id, requestId: input.requestId, rating: input.rating, reviewedAt: now, before: progress.fsrsData as Prisma.InputJsonValue, after } });
      return { replayed: false, result: after };
    }, { timeout: 15_000 });
  }
}
export type StudyQueue = Awaited<ReturnType<StudyService["queue"]>>;
