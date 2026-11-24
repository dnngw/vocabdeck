import { DefaultScheduler, type DefaultSchedulerCard } from "ts-fsrs";
import { z } from "zod";

const storedSchema = z.object({
  model: z.literal("FSRS-7"),
  card: z.record(z.string(), z.unknown()),
});
const cardSchema = z.object({
  cardId: z.string(),
  stability: z.number().nonnegative(),
  stabilityFast: z.number().nonnegative(),
  difficulty: z.number().nonnegative(),
  state: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  scheduleStatus: z.enum(["new", "learning", "review"]),
  dueAt: z.coerce.date(),
  lastReviewAt: z.coerce.date().nullable(),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  scheduledDays: z.number().nonnegative(),
  learningStep: z.number().int().nonnegative(),
});
export class StudyScheduler {
  private constructor(private scheduler: DefaultScheduler) {}
  static async create(retention = 0.9) {
    return new StudyScheduler(
      await DefaultScheduler({
        version: "FSRS-7",
        desiredRetention: retention,
        enableFuzz: false,
      }),
    );
  }
  newCard(now: Date) {
    return this.scheduler.newCard({ now });
  }
  serialize(card: DefaultSchedulerCard) {
    return JSON.parse(JSON.stringify({ model: "FSRS-7", card })) as {
      model: "FSRS-7";
      card: Record<string, string | number | null>;
    };
  }
  deserialize(value: unknown): DefaultSchedulerCard {
    const { card } = storedSchema.parse(value);
    return cardSchema.parse(card);
  }
  review(card: DefaultSchedulerCard, rating: 1 | 2 | 3 | 4, now: Date) {
    return this.scheduler.review({ card, grade: rating, now });
  }
  preview(card: DefaultSchedulerCard, now: Date) {
    return [...this.scheduler.preview({ card, now })].map((result) => ({
      rating: result.grade,
      dueAt: result.card.dueAt.toISOString(),
      seconds: Math.max(
        1,
        Math.round((result.card.dueAt.getTime() - now.getTime()) / 1000),
      ),
    }));
  }
}
