import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  function redirectTo(path: string) {
    const response = NextResponse.redirect(new URL(path, base));
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
  try {
    const supabase = await supabaseServer();
    const token_hash = url.searchParams.get("token_hash");
    const type = url.searchParams.get("type");
    const code = url.searchParams.get("code");
    if (token_hash && (type === "invite" || type === "recovery")) {
      const { error } = await supabase.auth.verifyOtp({ token_hash, type });
      if (!error) return redirectTo("/auth/password");
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return redirectTo("/auth/password");
    }
  } catch {
    /* Do not expose provider or configuration details. */
  }
  return redirectTo("/login?error=invalid_link");
}
