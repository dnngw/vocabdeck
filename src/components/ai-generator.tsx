"use client";
import Link from "next/link";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { VocabularyFields, VocabularyPreview } from "./vocabulary-editor";
import { apiFetch } from "@/lib/api-client";
import { vocabularySchema, type VocabularyInput } from "@/lib/validation";
type Preview = { duplicateSenses: number; allDuplicate: boolean };
export function AIGenerator({
  decks,
  initialDeckId,
  enabled,
}: {
  decks: { id: string; name: string }[];
  initialDeckId?: string;
  enabled: boolean;
}) {
  const [deckId, setDeckId] = useState(initialDeckId || decks[0]?.id || "");
  const [mode, setMode] = useState("word");
  const [items, setItems] = useState<VocabularyInput[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [duplicates, setDuplicates] = useState<Preview[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [saved, setSaved] = useState<{
    created: number;
    skipped: number;
  } | null>(null);
  if (!decks.length)
    return (
      <section className="panel">
        <p className="mb-5">
          Buat deck terlebih dahulu untuk menyimpan hasil yang kamu pilih.
        </p>
        <Button asChild>
          <Link href="/decks">Buat deck</Link>
        </Button>
      </section>
    );
  return (
    <div className="space-y-6">
      {!enabled && (
        <p
          role="status"
          className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
        >
          AI belum diaktifkan oleh pengelola. Kamu tetap bisa menambah
          vocabulary manual atau mengimpor CSV.
        </p>
      )}
      <form
        className="panel space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            items.length &&
            !window.confirm(
              "Ganti preview yang belum disimpan dengan hasil baru?",
            )
          )
            return;
          setBusy(true);
          setError("");
          const data = new FormData(e.currentTarget);
          try {
            const result = await apiFetch<{
              items: VocabularyInput[];
              remaining: number;
            }>("/api/ai/generate", {
              method: "POST",
              body: JSON.stringify({
                mode,
                input: data.get("input"),
                count: mode === "word" ? 1 : Number(data.get("count")),
                level: data.get("level"),
              }),
            });
            setItems(result.items);
            setSelected(result.items.map((_, i) => i));
            setRemaining(result.remaining);
            setDuplicates(null);
            setSaved(null);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            Buat dari
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              disabled={busy}
            >
              <option value="word">Satu kata / frasa</option>
              <option value="topic">Topik</option>
            </select>
          </label>
          <label>
            Level materi
            <select name="level" defaultValue="B1" disabled={busy}>
              {["A1", "A2", "B1", "B2", "C1", "C2"].map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          {mode === "word" ? "Kata atau frasa" : "Topik yang ingin dipahami"}
          <textarea
            name="input"
            rows={2}
            maxLength={mode === "word" ? 120 : 2000}
            placeholder={
              mode === "word"
                ? "Misalnya: take"
                : "Misalnya: percakapan di bandara"
            }
            required
            disabled={busy}
          />
        </label>
        {mode === "topic" && (
          <label>
            Jumlah kata
            <input
              name="count"
              type="number"
              defaultValue={5}
              min={1}
              max={20}
              disabled={busy}
              required
            />
          </label>
        )}
        <p className="text-sm leading-relaxed text-muted-foreground">
          Input ini dikirim ke provider AI eksternal. Hindari data pribadi.
          Hasil AI perlu diperiksa; belum ada kata yang disimpan sebelum kamu
          memilih Simpan.
        </p>
        <Button disabled={busy || !enabled}>
          <Sparkles size={17} />
          {busy ? "Memproses…" : "Buat preview"}
        </Button>
        {remaining !== null && (
          <p className="text-sm text-muted-foreground">
            Sisa kuota saat request terakhir: {remaining}. Reset harian 07.00
            WIB.
          </p>
        )}
      </form>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {saved && (
        <section role="status" className="panel">
          <h2 className="text-lg font-semibold text-primary">
            Pilihanmu sudah tersimpan
          </h2>
          <p className="my-3">
            {saved.created} makna baru, {saved.skipped} duplikat dilewati.
          </p>
          <Button asChild>
            <Link href={`/decks/${deckId}`}>Buka deck</Link>
          </Button>
        </section>
      )}
      {!!items.length && !saved && (
        <section className="space-y-5">
          <div className="panel">
            <h2 className="text-xl font-semibold">Periksa pilihanmu</h2>
            <p className="mt-2 mb-5 text-sm text-muted-foreground">
              {selected.length} dari {items.length} kata dipilih. Kamu dapat
              mengedit setiap makna dan kalimat.
            </p>
            <label>
              Deck tujuan
              <select
                value={deckId}
                onChange={(e) => {
                  setDeckId(e.target.value);
                  setDuplicates(null);
                }}
                disabled={busy}
              >
                {decks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {items.map((item, i) => (
            <article className="panel" key={i}>
              <label className="mb-5 flex items-center gap-3">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={selected.includes(i)}
                  onChange={(e) => {
                    setSelected(
                      e.target.checked
                        ? [...selected, i]
                        : selected.filter((n) => n !== i),
                    );
                    setDuplicates(null);
                  }}
                />
                Pilih “{item.word}”
              </label>
              <VocabularyPreview value={item} />
              {duplicates?.[i] && (
                <p className="mt-4 text-sm text-amber-800">
                  {duplicates[i].duplicateSenses
                    ? `${duplicates[i].duplicateSenses} makna sudah ada dan akan dilewati.`
                    : "Tidak ada makna duplikat."}
                </p>
              )}
              <details className="mt-5">
                <summary className="cursor-pointer text-sm font-semibold text-primary">
                  Edit kata dan konteks
                </summary>
                <div className="mt-5">
                  <VocabularyFields
                    value={item}
                    disabled={busy}
                    onChange={(value) => {
                      setItems(
                        items.map((original, n) =>
                          n === i ? value : original,
                        ),
                      );
                      setDuplicates(null);
                    }}
                  />
                </div>
              </details>
            </article>
          ))}
          <div className="panel">
            <Button
              disabled={busy || !selected.length}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const chosen = selected.map((i) =>
                    vocabularySchema.parse(items[i]),
                  );
                  if (!duplicates) {
                    const result = await apiFetch<Preview[]>(
                      "/api/ai/preview",
                      {
                        method: "POST",
                        body: JSON.stringify({ deckId, items: chosen }),
                      },
                    );
                    const mapped: Preview[] = [];
                    selected.forEach((index, i) => {
                      mapped[index] = result[i];
                    });
                    setDuplicates(mapped);
                  } else {
                    setSaved(
                      await apiFetch(`/api/decks/${deckId}/vocabulary`, {
                        method: "POST",
                        body: JSON.stringify({ items: chosen, source: "ai" }),
                      }),
                    );
                  }
                } catch (e) {
                  setError(
                    e instanceof Error && e.name === "ZodError"
                      ? "Ada kata, makna, atau contoh yang belum valid. Periksa hasil edit."
                      : (e as Error).message,
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy
                ? "Memproses…"
                : duplicates
                  ? `Simpan ${selected.length} kata terpilih`
                  : "Periksa validasi dan duplikat"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
