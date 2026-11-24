import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { checkOrigin, readJson, errorResponse } from "@/server/http";
import { AppError } from "@/server/errors";
import { requireUser } from "@/server/auth";

export async function POST(
  request: Request,
  context: { params: Promise<{ action: string }> },
) {
  try {
    checkOrigin(request);
    const { action } = await context.params;
    const supabase = await supabaseServer();
    if (action === "logout") {
      const { error } = await supabase.auth.signOut();
      if (error)
        throw new AppError(503, "AUTH_FAILED", "Gagal keluar. Coba kembali.");
    } else if (action === "login") {
      const input = z
        .object({
          email: z.email().max(254),
          password: z.string().min(1).max(128),
        })
        .parse(await readJson(request, 4096));
      const { error } = await supabase.auth.signInWithPassword(input);
      if (error)
        throw new AppError(
          error.status === 429 ? 429 : 401,
          "LOGIN_FAILED",
          "Email atau password salah, atau akses belum tersedia.",
        );
      try {
        await requireUser();
      } catch (error) {
        await supabase.auth.signOut();
        throw error;
      }
    } else if (action === "reset") {
      const { email } = z
        .object({ email: z.email().max(254) })
        .parse(await readJson(request, 4096));
      const base =
        process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${base}/auth/password`,
      });
      if (error?.status === 429)
        throw new AppError(
          429,
          "RATE_LIMIT",
          "Terlalu banyak permintaan. Coba beberapa saat lagi.",
        );
      // Same response regardless of account existence.
    } else if (action === "password") {
      await requireUser();
      const { password } = z
        .object({
          password: z
            .string()
            .min(12, "Gunakan setidaknya 12 karakter.")
            .max(128),
        })
        .parse(await readJson(request, 4096));
      const { error } = await supabase.auth.updateUser({ password });
      if (error)
        throw new AppError(
          422,
          "PASSWORD_FAILED",
          "Password tidak dapat disimpan. Periksa tautan undangan atau reset password.",
        );
    } else throw new AppError(404, "NOT_FOUND", "Halaman tidak ditemukan.");
    return NextResponse.json(
      { data: { success: true }, error: null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
