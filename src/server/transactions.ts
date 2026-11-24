import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { UserContext } from "./auth";
import { AppError } from "./errors";
export async function lockActiveUser(
  tx: Prisma.TransactionClient,
  user: UserContext,
) {
  // Serializes reviews across different cards and checks suspension under lock.
  const rows = await tx.$queryRaw<
    { status: string }[]
  >`SELECT status FROM vocabdeck.profiles WHERE id = ${user.id}::uuid FOR UPDATE`;
  if (rows[0]?.status !== "active")
    throw new AppError(403, "ACCOUNT_INACTIVE", "Akses akun tidak aktif.");
}
