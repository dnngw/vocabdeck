"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
export function AuthForm({ mode = "login", configured = true }: { mode?: "login" | "password"; configured?: boolean }) {
  const [reset, setReset] = useState(false);
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const router = useRouter();
  return <form className="field-grid" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    const form = new FormData(e.currentTarget);
    try {
      await apiFetch(`/api/auth/${reset ? "reset" : mode}`, { method: "POST", body: JSON.stringify(Object.fromEntries(form)) });
      if (reset) setMessage("Jika email terdaftar, tautan reset akan dikirim. Periksa kotak masuk dan spam.");
      else { router.replace("/dashboard"); router.refresh(); }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }}>
    {mode === "login" && <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="nama@email.com" /></label>}
    {!reset && <label>{mode === "password" ? "Password baru" : "Password"}<input name="password" type="password" autoComplete={mode === "password" ? "new-password" : "current-password"} minLength={mode === "password" ? 12 : 1} maxLength={128} required /></label>}
    {mode === "password" && <p className="text-sm text-muted-foreground">Gunakan setidaknya 12 karakter.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{message && <p role="status" className="text-sm text-primary">{message}</p>}
    <Button disabled={busy || !configured}>{busy ? "Memproses…" : reset ? "Kirim tautan reset" : mode === "password" ? "Simpan password" : "Masuk ke Vocabdeck"}</Button>
    {mode === "login" && <Button type="button" variant="ghost" onClick={() => { setReset(!reset); setError(""); setMessage(""); }}>{reset ? "Kembali ke login" : "Lupa password?"}</Button>}
  </form>;
}
