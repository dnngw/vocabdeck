"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { apiFetch } from "@/lib/api-client";
import type { AiLimits } from "@/server/ai";
export function AccountStatusButton({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const next = status === "active" ? "suspended" : "active";
  return (
    <div>
      <Button
        variant={next === "suspended" ? "outline" : "default"}
        disabled={busy}
        onClick={async () => {
          if (
            !window.confirm(
              next === "suspended"
                ? "Tangguhkan akun ini? Request berikutnya langsung ditolak meskipun sesi login masih aktif."
                : "Aktifkan kembali akses akun ini?",
            )
          )
            return;
          setBusy(true);
          setError("");
          try {
            await apiFetch(`/api/admin/users/${id}`, {
              method: "PATCH",
              body: JSON.stringify({ status: next }),
            });
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Menyimpan…" : next === "suspended" ? "Tangguhkan" : "Aktifkan"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
export function AiSettings({
  initial,
  environmentEnabled,
}: {
  initial: AiLimits;
  environmentEnabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  return (
    <form
      className="panel space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setSaved(false);
        const data = new FormData(e.currentTarget);
        try {
          await apiFetch("/api/admin/settings", {
            method: "PATCH",
            body: JSON.stringify({
              enabled: data.get("enabled") === "on",
              userDaily: Number(data.get("userDaily")),
              globalDaily: Number(data.get("globalDaily")),
              globalConcurrency: Number(data.get("globalConcurrency")),
              userPerMinute: initial.userPerMinute,
              globalPerMinute: initial.globalPerMinute,
            }),
          });
          setSaved(true);
          router.refresh();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-lg font-semibold">Kontrol pemakaian AI</h2>
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={initial.enabled}
        />
        Izinkan permintaan AI
      </label>
      {!environmentEnabled && (
        <p className="text-sm text-amber-900">
          AI_ENABLED di server masih false. Switch ini tidak dapat melampaui
          penonaktifan pada environment.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <label>
          Request / pengguna / hari
          <input
            name="userDaily"
            type="number"
            min={0}
            max={1000}
            required
            defaultValue={initial.userDaily}
          />
        </label>
        <label>
          Request global / hari
          <input
            name="globalDaily"
            type="number"
            min={0}
            max={10000}
            required
            defaultValue={initial.globalDaily}
          />
        </label>
        <label>
          Request global bersamaan
          <input
            name="globalConcurrency"
            type="number"
            min={1}
            max={20}
            required
            defaultValue={initial.globalConcurrency}
          />
        </label>
      </div>
      <p className="text-sm text-muted-foreground">
        Request gagal ikut dihitung. Reset harian 00.00 UTC. Batas request ini
        tidak menggantikan batas saldo di provider.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-primary">
          Pengaturan AI tersimpan.
        </p>
      )}
      <Button disabled={busy}>{busy ? "Menyimpan…" : "Simpan batas AI"}</Button>
    </form>
  );
}
