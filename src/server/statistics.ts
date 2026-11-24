import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { addDays } from "date-fns";
import type { Database } from "@/lib/db";
import { dayBounds } from "@/lib/time";
import type { UserContext } from "./auth";
import { StudyService } from "./study";
export class StatisticsService {
  constructor(private db: Database) {}
  async summary(user: UserContext, now = new Date()) {
    const settings = await new StudyService(this.db).settings(user);
    const { start, end } = dayBounds(now, settings.timezone);
    const firstDay = formatInTimeZone(addDays(start, -29), settings.timezone, "yyyy-MM-dd");
    const [today, all, vocabulary, senses, due, fresh, ratingGroups, activity] = await Promise.all([
      this.db.reviewLog.count({ where: { userId: user.id, reviewedAt: { gte: start, lt: end } } }),
      this.db.reviewLog.count({ where: { userId: user.id } }),
      this.db.vocabularyEntry.count({ where: { deck: { ownerId: user.id } } }),
      this.db.wordSense.count({ where: { vocabulary: { deck: { ownerId: user.id } } } }),
      this.db.cardProgress.count({ where: { userId: user.id, state: { not: 0 }, dueAt: { lte: now }, card: { active: true, sense: { vocabulary: { deck: { ownerId: user.id } } } } } }),
      this.db.cardProgress.count({ where: { userId: user.id, state: 0, card: { active: true, sense: { vocabulary: { deck: { ownerId: user.id } } } } } }),
      this.db.reviewLog.groupBy({ by: ["rating"], where: { userId: user.id }, _count: true }),
      this.db.$queryRaw<{ day: string; count: bigint }[]>`SELECT to_char(reviewed_at AT TIME ZONE ${settings.timezone}, 'YYYY-MM-DD') as day, count(*) as count FROM vocabdeck.review_logs WHERE user_id = ${user.id}::uuid AND reviewed_at >= ${addDays(start, -30)} AND reviewed_at < ${end} GROUP BY day ORDER BY day`,
    ]);
    return { today, all, vocabulary, senses, due, fresh, timezone: settings.timezone, ratings: [1, 2, 3, 4].map(rating => ({ rating, count: ratingGroups.find(g => g.rating === rating)?._count || 0 })), activity: Array.from({ length: 30 }, (_, i) => { const day = formatInTimeZone(addDays(new Date(`${firstDay}T12:00:00Z`), i), "UTC", "yyyy-MM-dd"); return { day, count: Number(activity.find(a => a.day === day)?.count || 0) }; }) };
  }
}
