import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { AppError } from "@/server/errors";

export function authConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.DATABASE_URL);
}
export async function supabaseServer() {
  if (!authConfigured()) throw new AppError(503, "NOT_CONFIGURED", "Layanan belum dikonfigurasi. Hubungi pengelola Vocabdeck.");
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* Server Components are read-only; proxy refreshes cookies. */ }
      },
    },
  });
}
