"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { apiFetch } from "@/lib/api-client";
export function DeckForm({
  initial,
}: {
  initial?: { id: string; name: string; description: string };
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <div>
      <Button
        variant={initial ? "outline" : "default"}
        onClick={() => setOpen(!open)}
      >
        {initial ? <Pencil size={17} /> : <Plus size={17} />}
        {initial ? "Edit deck" : "Buat deck"}
      </Button>
      {open && (
        <form
          className="panel mt-4 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const data = Object.fromEntries(new FormData(e.currentTarget));
            try {
              const result = await apiFetch<{ id: string }>(
                initial ? `/api/decks/${initial.id}` : "/api/decks",
                {
                  method: initial ? "PATCH" : "POST",
                  body: JSON.stringify(data),
                },
              );
              setOpen(false);
              if (!initial) router.push(`/decks/${result.id}`);
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Nama deck
            <input
              name="name"
              defaultValue={initial?.name}
              placeholder="Misalnya: Everyday English"
              required
              maxLength={100}
            />
          </label>
          <label>
            Deskripsi{" "}
            <span className="font-normal text-muted-foreground">
              (opsional)
            </span>
            <textarea
              name="description"
              defaultValue={initial?.description}
              maxLength={500}
              rows={2}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan deck"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
export function DeleteButton({
  endpoint,
  label,
  returnTo,
}: {
  endpoint: string;
  label: string;
  returnTo: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <div>
      <Button
        variant="ghost"
        className="text-red-700"
        disabled={busy}
        onClick={async () => {
          if (
            !window.confirm(
              `Hapus ${label}? Seluruh kartu, progres, dan riwayat terkait akan dihapus permanen.`,
            )
          )
            return;
          setBusy(true);
          setError("");
          try {
            await apiFetch(endpoint, { method: "DELETE" });
            router.push(returnTo);
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        <Trash2 size={17} />
        {busy ? "Menghapus…" : "Hapus"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
