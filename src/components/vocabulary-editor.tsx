"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Eye, Pencil } from "lucide-react";
import { Button } from "./ui/button";
import { apiFetch } from "@/lib/api-client";
import { vocabularySchema, type VocabularyInput } from "@/lib/validation";

export const blankExample = () => ({
  sentenceEn: "",
  translationInIndonesian: "",
  contextExplanationInIndonesian: "",
});
export const blankSense = () => ({
  meaningInIndonesian: "",
  definitionEn: "",
  examples: [blankExample()],
});
const blankVocabulary = (): VocabularyInput => ({
  word: "",
  partOfSpeech: "",
  senses: [blankSense()],
});
export function VocabularyFields({
  value,
  onChange,
  disabled = false,
}: {
  value: VocabularyInput;
  onChange: (value: VocabularyInput) => void;
  disabled?: boolean;
}) {
  const formId = useId();
  function changeSense(
    index: number,
    patch: Partial<VocabularyInput["senses"][number]>,
  ) {
    onChange({
      ...value,
      senses: value.senses.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      ),
    });
  }
  return (
    <fieldset disabled={disabled} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          Kata atau frasa Inggris
          <input
            value={value.word}
            onChange={(e) => onChange({ ...value, word: e.target.value })}
            required
            maxLength={120}
            placeholder="take"
          />
        </label>
        <label>
          Jenis kata
          <input
            list="parts-of-speech"
            value={value.partOfSpeech}
            onChange={(e) =>
              onChange({ ...value, partOfSpeech: e.target.value })
            }
            maxLength={40}
            placeholder="verb, noun, adjective…"
          />
        </label>
      </div>
      {value.senses.map((sense, i) => (
        <section
          key={sense.id || i}
          className="rounded-2xl border border-border bg-slate-50 p-4 sm:p-6"
        >
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-semibold">Makna {i + 1}</h3>
            {value.senses.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                className="text-red-700"
                aria-label={`Hapus makna ${i + 1}`}
                onClick={() => {
                  if (
                    sense.id &&
                    !window.confirm(
                      "Hapus makna ini beserta seluruh kartu dan riwayat reviewnya?",
                    )
                  )
                    return;
                  onChange({
                    ...value,
                    senses: value.senses.filter((_, index) => index !== i),
                  });
                }}
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
          <div className="field-grid">
            <label>
              Makna dalam bahasa Indonesia
              <input
                value={sense.meaningInIndonesian}
                onChange={(e) =>
                  changeSense(i, { meaningInIndonesian: e.target.value })
                }
                required
                maxLength={500}
                placeholder="membutuhkan waktu"
              />
            </label>
            <label>
              Definisi Inggris{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
              <input
                value={sense.definitionEn}
                onChange={(e) =>
                  changeSense(i, { definitionEn: e.target.value })
                }
                maxLength={1000}
              />
            </label>
            {sense.examples.map((example, j) => (
              <div
                key={example.id || j}
                className="field-grid mt-2 border-t border-border pt-5"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-primary">
                    Contoh kalimat {j + 1}
                  </h4>
                  {sense.examples.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Hapus contoh ${j + 1} pada makna ${i + 1}`}
                      onClick={() =>
                        changeSense(i, {
                          examples: sense.examples.filter(
                            (_, index) => index !== j,
                          ),
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
                {(
                  [
                    ["sentenceEn", "Kalimat bahasa Inggris", 2000],
                    [
                      "translationInIndonesian",
                      "Terjemahan Indonesia (opsional)",
                      2000,
                    ],
                    [
                      "contextExplanationInIndonesian",
                      "Penjelasan konteks (opsional)",
                      2000,
                    ],
                  ] as const
                ).map(([key, label, max]) => (
                  <div key={key}>
                    <label htmlFor={`${formId}-${i}-${j}-${key}`}>
                      {label}
                    </label>
                    <textarea
                      id={`${formId}-${i}-${j}-${key}`}
                      className="mt-2"
                      value={example[key]}
                      rows={2}
                      required={key === "sentenceEn"}
                      maxLength={max}
                      onChange={(e) =>
                        changeSense(i, {
                          examples: sense.examples.map((ex, n) =>
                            n === j ? { ...ex, [key]: e.target.value } : ex,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            ))}
            {sense.examples.length < 3 && (
              <Button
                variant="outline"
                type="button"
                onClick={() =>
                  changeSense(i, {
                    examples: [...sense.examples, blankExample()],
                  })
                }
              >
                <Plus size={16} />
                Tambah contoh
              </Button>
            )}
          </div>
        </section>
      ))}
      {value.senses.length < 5 && (
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange({ ...value, senses: [...value.senses, blankSense()] })
          }
        >
          <Plus size={17} />
          Tambah makna
        </Button>
      )}
    </fieldset>
  );
}
export function VocabularyPreview({ value }: { value: VocabularyInput }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">
        {value.word}{" "}
        <span className="text-base font-normal text-muted-foreground">
          {value.partOfSpeech}
        </span>
      </h2>
      {value.senses.map((sense, i) => (
        <div key={i} className="rounded-xl bg-emerald-50/60 p-5">
          <h3 className="font-semibold text-primary">
            {sense.meaningInIndonesian}
          </h3>
          {sense.definitionEn && (
            <p className="mt-2 text-sm">{sense.definitionEn}</p>
          )}
          {sense.examples.map((example, j) => (
            <div key={j} className="mt-4 border-t border-emerald-100 pt-4">
              <p className="leading-relaxed">“{example.sentenceEn}”</p>
              {example.translationInIndonesian && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {example.translationInIndonesian}
                </p>
              )}
              {example.contextExplanationInIndonesian && (
                <p className="mt-3 text-sm text-primary">
                  {example.contextExplanationInIndonesian}
                </p>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
export function VocabularyEditor({
  initial,
  entryId,
  deckId: initialDeckId,
  decks,
}: {
  initial?: VocabularyInput;
  entryId?: string;
  deckId?: string;
  decks: { id: string; name: string }[];
}) {
  const [value, setValue] = useState(initial || blankVocabulary());
  const [deckId, setDeckId] = useState(initialDeckId || decks[0]?.id || "");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  if (!decks.length)
    return (
      <div className="panel">
        <p className="mb-4">
          Buat deck terlebih dahulu untuk menyimpan vocabulary.
        </p>
        <Button asChild>
          <Link href="/decks">Buat deck</Link>
        </Button>
      </div>
    );
  return (
    <form
      className="panel space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        const result = vocabularySchema.safeParse(value);
        if (!result.success) {
          setError(result.error.issues.map((i) => i.message).join(" "));
          return;
        }
        if (!preview) {
          setPreview(true);
          return;
        }
        setBusy(true);
        try {
          const response = await apiFetch<{ entryIds?: string[] }>(
            entryId
              ? `/api/vocabulary/${entryId}`
              : `/api/decks/${deckId}/vocabulary`,
            {
              method: entryId ? "PATCH" : "POST",
              body: JSON.stringify(
                entryId
                  ? result.data
                  : { items: [result.data], source: "manual" },
              ),
            },
          );
          router.push(`/vocabulary/${entryId || response.entryIds![0]}`);
          router.refresh();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {!entryId && (
        <label>
          Simpan ke deck
          <select
            value={deckId}
            onChange={(e) => setDeckId(e.target.value)}
            disabled={busy}
            required
          >
            {decks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {entryId && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          Edit teks mempertahankan progres. Menghapus makna akan menghapus kartu
          dan riwayatnya. Jika makna berubah besar, jadwal lama mungkin tidak
          lagi sesuai.
        </p>
      )}
      {preview ? (
        <VocabularyPreview value={value} />
      ) : (
        <VocabularyFields value={value} onChange={setValue} disabled={busy} />
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        <Button disabled={busy}>
          {busy ? (
            "Menyimpan…"
          ) : preview ? (
            "Simpan vocabulary"
          ) : (
            <>
              <Eye size={17} />
              Periksa kartu
            </>
          )}
        </Button>
        {preview && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setPreview(false)}
            disabled={busy}
          >
            <Pencil size={17} />
            Edit kembali
          </Button>
        )}
      </div>
      <datalist id="parts-of-speech">
        {[
          "verb",
          "noun",
          "adjective",
          "adverb",
          "preposition",
          "conjunction",
          "pronoun",
          "phrase",
        ].map((pos) => (
          <option key={pos} value={pos} />
        ))}
      </datalist>
    </form>
  );
}
