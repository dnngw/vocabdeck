import "server-only";
import { z } from "zod";
import type { Database } from "@/lib/db";
import { requireAdmin, type UserContext } from "./auth";
import { AppError, notFound } from "./errors";
import { lockActiveUser } from "./transactions";
import { aiLimits, aiLimitsSchema } from "./ai";
export class AdminService {
  constructor(private db: Database) {}
  async users(user: UserContext) {
    requireAdmin(user);
    return this.db.profile.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        displayName: true,
        status: true,
        role: true,
        invitedAt: true,
        createdAt: true,
      },
    });
  }
  async setStatus(user: UserContext, id: string, raw: unknown) {
    requireAdmin(user);
    const { status } = z
      .object({ status: z.enum(["active", "suspended"]) })
      .parse(raw);
    if (id === user.id)
      throw new AppError(
        409,
        "SELF_SUSPEND",
        "Status akun admin sendiri tidak dapat diubah di sini.",
      );
    return this.db.$transaction(async (tx) => {
      await lockActiveUser(tx, user);
      const actor = await tx.profile.findUnique({ where: { id: user.id } });
      if (actor?.role !== "admin")
        throw new AppError(403, "FORBIDDEN", "Akses admin tidak tersedia.");
      const target = await tx.profile.findUnique({ where: { id } });
      if (!target) notFound();
      if (target.role === "admin")
        throw new AppError(
          409,
          "ADMIN_ACCOUNT",
          "Kelola akun admin melalui Supabase Dashboard.",
        );
      if (status === "active" && (!target.invitedAt || !target.acceptedAt))
        throw new AppError(
          409,
          "INVITATION_REQUIRED",
          "Pengguna harus menerima undangan sebelum diaktifkan.",
        );
      await tx.profile.update({ where: { id }, data: { status } });
      await tx.auditLog.create({
        data: { actorId: user.id, targetId: id, action: `account_${status}` },
      });
      return { id, status };
    });
  }
  async usage(user: UserContext) {
    requireAdmin(user);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [recent, todayCount, enabled, limits] = await Promise.all([
      this.db.aiUsage.findMany({
        take: 100,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userId: true,
          provider: true,
          model: true,
          status: true,
          tokensIn: true,
          tokensOut: true,
          durationMs: true,
          errorCode: true,
          createdAt: true,
        },
      }),
      this.db.aiUsage.count({ where: { createdAt: { gte: today } } }),
      this.db.appSetting.findUnique({ where: { key: "ai_enabled" } }),
      this.db.appSetting.findUnique({ where: { key: "ai_limits" } }),
    ]);
    return {
      recent,
      todayCount,
      enabled: aiLimits().enabled && enabled?.value !== false,
      environmentEnabled: aiLimits().enabled,
      limits: { ...aiLimits(), ...((limits?.value as object) || {}) },
    };
  }
  async updateAi(user: UserContext, raw: unknown) {
    requireAdmin(user);
    const input = aiLimitsSchema.parse(raw);
    return this.db.$transaction(async (tx) => {
      // Use the same lock as reservations so the switch takes effect atomically.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(862411)`;
      await lockActiveUser(tx, user);
      if (
        (await tx.profile.findUnique({ where: { id: user.id } }))?.role !==
        "admin"
      )
        throw new AppError(403, "FORBIDDEN", "Akses admin tidak tersedia.");
      const { enabled, ...limits } = input;
      for (const [key, value] of [
        ["ai_enabled", enabled],
        ["ai_limits", limits],
      ] as const) {
        await tx.appSetting.upsert({
          where: { key },
          create: { key, value, updatedBy: user.id },
          update: { value, updatedBy: user.id },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          targetId: user.id,
          action: "ai_settings_updated",
        },
      });
      return { saved: true };
    });
  }
}
