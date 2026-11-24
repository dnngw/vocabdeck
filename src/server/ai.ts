import "server-only";
import { z } from "zod";
import type { Database } from "@/lib/db";
import { generateSchema, generatedSchema, normalize } from "@/lib/validation";
import type { AIProvider } from "@/lib/ai/provider";
import { DeepSeekProvider } from "@/lib/ai/deepseek";
import type { UserContext } from "./auth";
import { lockActiveUser } from "./transactions";
import { AppError } from "./errors";

export const aiLimitsSchema = z.object({
  enabled: z.boolean(),
  userDaily: z.number().int().min(0).max(1000),
  globalDaily: z.number().int().min(0).max(10000),
  globalConcurrency: z.number().int().min(1).max(20),
  userPerMinute: z.number().int().min(1).max(10),
  globalPerMinute: z.number().int().min(1).max(100),
});
export type AiLimits = z.infer<typeof aiLimitsSchema>;
export function aiLimits(): AiLimits {
  return aiLimitsSchema.parse({
    enabled: process.env.AI_ENABLED === "true",
    userDaily: Number(process.env.AI_USER_DAILY_LIMIT || 10),
    globalDaily: Number(process.env.AI_GLOBAL_DAILY_LIMIT || 100),
    globalConcurrency: Number(process.env.AI_GLOBAL_CONCURRENCY || 5),
    userPerMinute: 3,
    globalPerMinute: 20,
  });
}
export function aiProvider(): AIProvider {
  if (
    (process.env.AI_PROVIDER || "deepseek") !== "deepseek" ||
    !process.env.DEEPSEEK_API_KEY ||
    !process.env.AI_MODEL
  )
    throw new AppError(
      503,
      "AI_NOT_CONFIGURED",
      "AI belum diaktifkan oleh pengelola.",
    );
  return new DeepSeekProvider(
    process.env.AI_MODEL,
    process.env.DEEPSEEK_API_KEY,
  );
}
export class AIService {
  constructor(
    private db: Database,
    private provider: AIProvider,
    private limits: AiLimits,
  ) {}
  async generate(user: UserContext, raw: unknown, now = new Date()) {
    const input = generateSchema.parse(raw);
    if (input.mode === "word" && input.input.length > 120)
      throw new AppError(
        422,
        "INPUT_TOO_LONG",
        "Input kata maksimal 120 karakter.",
      );
    if (!this.limits.enabled)
      throw new AppError(
        503,
        "AI_DISABLED",
        "AI sedang dinonaktifkan. Kamu tetap dapat menambah kata manual atau mengimpor CSV.",
      );
    const reservation = await this.reserve(user, now);
    const start = Date.now();
    try {
      const result = await this.provider.generateVocabulary(input);
      // Validate the normalized contract again so future adapters are held to it.
      const validated = generatedSchema.parse(result);
      if (validated.items.length > (input.mode === "word" ? 1 : input.count))
        throw new AppError(
          502,
          "AI_INVALID_RESPONSE",
          "Jumlah kata dari AI tidak sesuai permintaan.",
        );
      const used = new Set<string>();
      const items = validated.items.filter((item) => {
        const key = `${normalize(item.word)}\0${item.partOfSpeech}`;
        if (used.has(key)) return false;
        used.add(key);
        return true;
      });
      await this.db.aiUsage.update({
        where: { id: reservation.id },
        data: {
          status: "success",
          durationMs: Date.now() - start,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
        },
      });
      return {
        items,
        remaining: reservation.remaining,
        provider: this.provider.name,
        model: this.provider.model,
      };
    } catch (error) {
      const code = error instanceof AppError ? error.code : "AI_FAILED";
      await this.db.aiUsage.update({
        where: { id: reservation.id },
        data: {
          status: "failed",
          durationMs: Date.now() - start,
          errorCode: code,
        },
      });
      if (error instanceof AppError) throw error;
      throw new AppError(
        502,
        "AI_FAILED",
        "Permintaan AI gagal. Input manual dan impor tetap tersedia.",
      );
    }
  }
  private async reserve(user: UserContext, now: Date) {
    return this.db.$transaction(
      async (tx) => {
        // One global lock makes daily caps and concurrent reservations atomic.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(862411)`;
        await lockActiveUser(tx, user);
        const setting = await tx.appSetting.findUnique({
          where: { key: "ai_enabled" },
        });
        if (setting?.value === false)
          throw new AppError(
            503,
            "AI_DISABLED",
            "AI sedang dinonaktifkan oleh admin.",
          );
        const configured = await tx.appSetting.findUnique({
          where: { key: "ai_limits" },
        });
        const override = configured
          ? aiLimitsSchema.omit({ enabled: true }).parse(configured.value)
          : {};
        const limits = { ...this.limits, ...override };
        const day = new Date(now);
        day.setUTCHours(0, 0, 0, 0);
        const minute = new Date(now.getTime() - 60_000);
        // Expired leases still count against the daily budget.
        await tx.aiUsage.updateMany({
          where: {
            status: "pending",
            createdAt: { lt: new Date(now.getTime() - 90_000) },
          },
          data: { status: "timed_out", errorCode: "LEASE_EXPIRED" },
        });
        const [
          userDaily,
          globalDaily,
          userRunning,
          globalRunning,
          userMinute,
          globalMinute,
        ] = await Promise.all([
          tx.aiUsage.count({
            where: { userId: user.id, createdAt: { gte: day } },
          }),
          tx.aiUsage.count({ where: { createdAt: { gte: day } } }),
          tx.aiUsage.count({ where: { userId: user.id, status: "pending" } }),
          tx.aiUsage.count({ where: { status: "pending" } }),
          tx.aiUsage.count({
            where: { userId: user.id, createdAt: { gte: minute } },
          }),
          tx.aiUsage.count({ where: { createdAt: { gte: minute } } }),
        ]);
        if (userDaily >= limits.userDaily || globalDaily >= limits.globalDaily)
          throw new AppError(
            429,
            "QUOTA_EXCEEDED",
            "Kuota AI harian sudah habis. Kuota diperbarui pukul 00.00 UTC (07.00 WIB).",
          );
        if (
          userRunning >= 1 ||
          globalRunning >= limits.globalConcurrency ||
          userMinute >= limits.userPerMinute ||
          globalMinute >= limits.globalPerMinute
        )
          throw new AppError(
            429,
            "AI_RATE_LIMIT",
            "Permintaan AI masih diproses atau terlalu sering. Tunggu sebentar lalu coba kembali.",
          );
        const usage = await tx.aiUsage.create({
          data: {
            userId: user.id,
            provider: this.provider.name,
            model: this.provider.model,
            createdAt: now,
          },
        });
        return { id: usage.id, remaining: limits.userDaily - userDaily - 1 };
      },
      { timeout: 15_000 },
    );
  }
}
