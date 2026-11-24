"use client";
import { useState } from "react";
import { Button } from "./ui/button";
import { apiFetch } from "@/lib/api-client";
export function SettingsForm({ initial }: { initial: { dailyNewLimit: number; desiredRetention: number; timezone: string } }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [saved, setSaved] = useState(false);
  return <form className="panel max-w-2xl space-y-6" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError(""); setSaved(false);
    const form = new FormData(e.currentTarget);
    try { await apiFetch("/api/settings", { method: "PATCH", body: JSON.stringify({ dailyNewLimit: Number(form.get("dailyNewLimit")), desiredRetention: Number(form.get("desiredRetention")) / 100, timezone: form.get("timezone") }) }); setSaved(true); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }}>
    <label>Kartu baru per hari<input name="dailyNewLimit" type="number" min={0} max={100} step={1} required defaultValue={initial.dailyNewLimit} /><span className="mt-2 block text-sm font-normal text-muted-foreground">Berlaku untuk semua deck. Kartu yang sudah due tetap tersedia. Isi 0 untuk fokus pada review.</span></label>
    <label>Timezone<input name="timezone" list="timezones" required maxLength={100} defaultValue={initial.timezone} /><span className="mt-2 block text-sm font-normal text-muted-foreground">Menentukan pergantian hari dan tampilan jadwal.</span></label><datalist id="timezones">{["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "Asia/Singapore", "UTC", "Europe/London", "America/New_York"].map(tz => <option key={tz} value={tz} />)}</datalist>
    <details className="rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm font-semibold">Pengaturan FSRS lanjutan</summary><label className="mt-5">Target retensi (%)<input name="desiredRetention" type="number" min={70} max={97} step={1} required defaultValue={Math.round(initial.desiredRetention * 100)} /><span className="mt-2 block text-sm font-normal text-muted-foreground">Default 90%. Nilai lebih tinggi menambah beban review. Perubahan berlaku pada jawaban berikutnya dan tidak menghapus riwayat.</span></label></details>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{saved && <p role="status" className="text-sm text-primary">Pengaturan tersimpan.</p>}<Button disabled={busy}>{busy ? "Menyimpan…" : "Simpan pengaturan"}</Button>
  </form>;
}
