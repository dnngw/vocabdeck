import "server-only";
import { getDb, type Database } from "@/lib/db";
import { supabaseServer } from "@/lib/supabase/server";
import { AppError } from "./errors";

declare const verified: unique symbol;
export type UserContext = { id: string; role: "admin" | "user"; displayName: string; readonly [verified]: true };

// Identity must come from Supabase, never from a body, URL or public metadata.
export async function contextForVerifiedIdentity(db: Database, verifiedId: string): Promise<UserContext> {
  const profile = await db.profile.findUnique({ where: { id: verifiedId } });
  if (!profile || profile.status !== "active") throw new AppError(403, "ACCOUNT_INACTIVE", "Akses akun belum aktif atau telah ditangguhkan. Hubungi admin.");
  return { id: profile.id, role: profile.role, displayName: profile.displayName } as UserContext;
}
export async function requireUser(): Promise<UserContext> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new AppError(401, "UNAUTHENTICATED", "Silakan masuk terlebih dahulu.");
  return contextForVerifiedIdentity(getDb(), data.user.id);
}
export function requireAdmin(user: UserContext) {
  if (user.role !== "admin") throw new AppError(403, "FORBIDDEN", "Hanya admin yang dapat mengakses fitur ini.");
}
