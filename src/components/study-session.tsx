"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, BookOpen, RotateCw } from "lucide-react";
import { Button } from "./ui/button";
import { apiFetch } from "@/lib/api-client";
import type { StudyQueue } from "@/server/study";
const grades = [
  {
    rating: 1,
    label: "Again",
    hint: "Belum ingat",
    color: "border-red-200 bg-red-50 text-red-800",
  },
  {
    rating: 2,
    label: "Hard",
    hint: "Sulit",
    color: "border-amber-200 bg-amber-50 text-amber-900",
  },
  {
    rating: 3,
    label: "Good",
    hint: "Ingat",
    color: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    rating: 4,
    label: "Easy",
    hint: "Sangat mudah",
    color: "border-sky-200 bg-sky-50 text-sky-800",
  },
] as const;
function interval(seconds: number) {
  return seconds < 60
    ? `${seconds} dtk`
    : seconds < 3600
      ? `${Math.round(seconds / 60)} mnt`
      : seconds < 86400
        ? `${Math.round(seconds / 3600)} jam`
        : `${Math.round(seconds / 86400)} hari`;
}
export function StudySession({
  initial,
  deckId,
}: {
  initial: StudyQueue;
  deckId?: string;
}) {
  const [queue, setQueue] = useState(initial);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);
  const [counts, setCounts] = useState([0, 0, 0, 0]);
  const [pending, setPending] = useState<{
    requestId: string;
    rating: 1 | 2 | 3 | 4;
  } | null>(null);
  const inFlight = useRef(false);
  const card = queue.cards[0];
  const reviewed = counts.reduce((a, b) => a + b, 0);
  const reload = useCallback(async () => {
    const next = await apiFetch<StudyQueue>(
      `/api/study/queue${deckId ? `?deckId=${deckId}` : ""}`,
    );
    setQueue(next);
    setRevealed(false);
    setPending(null);
    setSaved(false);
  }, [deckId]);
  const answer = useCallback(
    async (rating: 1 | 2 | 3 | 4) => {
      if (
        !card ||
        !revealed ||
        saved ||
        inFlight.current ||
        (pending && pending.rating !== rating)
      )
        return;
      inFlight.current = true;
      setBusy(true);
      setError("");
      const request = pending || { requestId: crypto.randomUUID(), rating };
      setPending(request);
      let committed = false;
      try {
        await apiFetch("/api/study/review", {
          method: "POST",
          body: JSON.stringify({
            progressId: card.id,
            version: card.version,
            ...request,
          }),
        });
        committed = true;
        setSaved(true);
        setCounts((previous) =>
          previous.map((n, i) => (i === rating - 1 ? n + 1 : n)),
        );
        await reload();
      } catch (e) {
        setError(
          committed
            ? "Jawaban tersimpan. Muat kembali untuk membuka kartu berikutnya."
            : (e as Error).message,
        );
      } finally {
        setBusy(false);
        inFlight.current = false;
      }
    },
    [card, revealed, saved, pending, reload],
  );
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        finished ||
        busy ||
        !card
      )
        return;
      const element = event.target as HTMLElement;
      if (
        element.closest(
          "input, textarea, select, button, a, [contenteditable=true]",
        )
      )
        return;
      if (event.code === "Space" && !revealed) {
        event.preventDefault();
        setRevealed(true);
      }
      if (revealed && /^[1-4]$/.test(event.key)) {
        event.preventDefault();
        void answer(Number(event.key) as 1 | 2 | 3 | 4);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, busy, card, finished, revealed]);
  useEffect(() => {
    if (card || finished || !queue.nextDueAt) return;
    const wait = Math.min(
      60_000,
      Math.max(1000, new Date(queue.nextDueAt).getTime() - Date.now() + 100),
    );
    const timer = window.setTimeout(() => {
      void reload().catch(() =>
        setError("Belum bisa memuat jadwal terbaru. Coba kembali."),
      );
    }, wait);
    return () => window.clearTimeout(timer);
  }, [card, finished, queue.nextDueAt, reload]);
  async function refresh() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-3">Waktu untuk memahami</p>
          <h1 className="page-title">Sesi belajar</h1>
        </div>
        {card && !finished && (
          <Button
            variant="ghost"
            disabled={busy || Boolean(pending)}
            onClick={() => setFinished(true)}
          >
            Akhiri sesi
          </Button>
        )}
      </header>
      <div className="mb-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>{reviewed} jawaban tersimpan</span>
        <span>{queue.due} review due</span>
        <span>{queue.newAvailable} kartu baru tersedia</span>
      </div>
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          <p>{error}</p>
          <Button
            variant="outline"
            className="mt-3"
            disabled={busy}
            onClick={refresh}
          >
            <RotateCw size={16} />
            Muat kartu terbaru
          </Button>
          {pending && !saved && (
            <p className="mt-3">
              Untuk mencoba jawaban yang sama lagi, tekan rating yang tadi
              dipilih.
            </p>
          )}
        </div>
      )}
      {!card || finished ? (
        <section className="panel py-12 text-center">
          <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-primary">
            <Check size={30} />
          </span>
          <h2 className="text-2xl font-semibold">
            {finished || reviewed
              ? "Sesi yang berarti."
              : "Semua sudah terkejar."}
          </h2>
          <p className="mt-3 text-muted-foreground">
            {reviewed
              ? `${reviewed} jawaban telah tersimpan. Sedikit demi sedikit, semakin melekat.`
              : "Belum ada kartu yang perlu dipelajari saat ini."}
          </p>
          {queue.nextDueAt && (
            <p className="mt-3 text-sm text-muted-foreground">
              Review berikutnya:{" "}
              {new Intl.DateTimeFormat("id-ID", {
                timeZone: queue.timezone,
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(queue.nextDueAt))}
            </p>
          )}
          {queue.newRemaining > queue.newAvailable && (
            <p className="mt-3 text-sm text-muted-foreground">
              Batas kartu baru hari ini: {queue.dailyNewLimit}. Kartu baru
              lainnya tersedia pada hari berikutnya.
            </p>
          )}
          {reviewed > 0 && (
            <div className="my-8 grid grid-cols-4 gap-2">
              {grades.map((g, i) => (
                <div key={g.rating}>
                  <p className="text-2xl font-semibold">{counts[i]}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {g.label}
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/dashboard">Kembali ke ringkasan</Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFinished(false);
                void refresh();
              }}
              disabled={busy}
            >
              Periksa jadwal
            </Button>
          </div>
        </section>
      ) : (
        <>
          <section
            className="overflow-hidden rounded-3xl border border-border bg-white shadow-sm"
            aria-label="Kartu belajar"
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4 text-sm text-muted-foreground">
              <span className="truncate">{card.deckName}</span>
              <span className="ml-4 flex shrink-0 items-center gap-2">
                <BookOpen size={16} />
                {card.state === 0 ? "Kartu baru" : "Review"}
              </span>
            </div>
            <div className="px-6 py-10 sm:px-12">
              <p className="text-sm text-muted-foreground">
                {card.partOfSpeech || "Vocabulary"}
              </p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight break-words sm:text-5xl">
                {card.word}
              </h2>
              <p className="mt-8 text-xl leading-relaxed">
                “{card.sentenceEn}”
              </p>
              <p className="mt-6 text-sm text-muted-foreground">
                Apa arti “{card.word}” dalam kalimat ini?
              </p>
              {revealed && (
                <div
                  className="mt-8 border-t border-border pt-8"
                  aria-live="polite"
                >
                  <p className="eyebrow mb-3">Makna dalam konteks</p>
                  <h3 className="text-2xl font-semibold text-primary">
                    {card.meaningInIndonesian}
                  </h3>
                  {card.definitionEn && (
                    <p className="mt-3 leading-relaxed">{card.definitionEn}</p>
                  )}
                  {card.translationInIndonesian && (
                    <p className="mt-5 rounded-xl bg-muted p-4 leading-relaxed">
                      {card.translationInIndonesian}
                    </p>
                  )}
                  {card.contextExplanationInIndonesian && (
                    <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                      {card.contextExplanationInIndonesian}
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
          {!revealed ? (
            <Button
              className="mt-6 w-full py-4"
              onClick={() => setRevealed(true)}
            >
              Tampilkan jawaban{" "}
              <span className="ml-2 text-xs opacity-75">Space</span>
            </Button>
          ) : (
            <div className="mt-6">
              <p className="mb-4 text-center text-sm text-muted-foreground">
                Seberapa mudah kamu mengingatnya?
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {grades.map((g) => (
                  <button
                    key={g.rating}
                    disabled={
                      busy ||
                      saved ||
                      Boolean(pending && pending.rating !== g.rating)
                    }
                    onClick={() => void answer(g.rating)}
                    className={`min-h-24 rounded-2xl border p-3 text-center transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 ${g.color}`}
                  >
                    <span className="block font-bold">
                      {g.label}{" "}
                      <span className="text-xs font-normal">{g.rating}</span>
                    </span>
                    <span className="mt-1 block text-sm">{g.hint}</span>
                    <span className="mt-2 block text-xs">
                      {interval(
                        card.intervals.find((i) => i.rating === g.rating)
                          ?.seconds || 1,
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <p
            role="status"
            className="mt-4 min-h-6 text-center text-sm text-muted-foreground"
          >
            {busy
              ? "Menyimpan jawaban…"
              : "Jadwal dihitung dengan FSRS untuk setiap makna."}
          </p>
        </>
      )}
    </div>
  );
}
