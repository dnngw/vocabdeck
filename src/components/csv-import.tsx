"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "./ui/button";
import { apiFetch } from "@/lib/api-client";
import type { CsvRow } from "@/lib/csv";
export function CsvImport({ deckId }: { deckId: string }) {
  const [csv, setCsv] = useState(""); const [rows, setRows] = useState<CsvRow[]>([]); const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  return <div className="space-y-6"><form className="panel space-y-4" onSubmit={async event => {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get("file");
    setError(""); setResult(null); setRows([]); setSelected([]);
    if (!(file instanceof File) || !file.size || file.size > 1_000_000 || !file.name.toLowerCase().endsWith(".csv")) { setError("Pilih file .csv dengan ukuran maksimal 1 MB."); return; }
    setBusy(true);
    try {
      const text = await file.text(); setCsv(text);
      const preview = await apiFetch<CsvRow[]>("/api/import/csv/preview", { method: "POST", body: JSON.stringify({ csv: text, deckId }) });
      setRows(preview); setSelected(preview.filter(row => row.item && !row.duplicate).map(row => row.row));
    } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  }}><p className="leading-relaxed text-muted-foreground">Satu baris mewakili satu makna dan contoh. Kata yang sama akan digabungkan. Semua baris disimpan ke deck ini; kolom deck pada file hanya menjadi informasi.</p><a href="/templates/vocabulary.csv" download className="inline-block text-sm font-semibold text-primary underline">Unduh template CSV</a>
    <label>File CSV <span className="font-normal text-muted-foreground">(maks. 1 MB, 500 baris)</span><input name="file" type="file" accept=".csv,text/csv" required disabled={busy} onChange={() => { setRows([]); setSelected([]); setError(""); setResult(null); setCsv(""); }} /></label>
    <Button type="submit" disabled={busy}>{busy ? "Memproses…" : "Periksa CSV"}</Button>
  </form>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {result && <section className="panel" role="status"><h2 className="text-lg font-semibold text-primary">Impor selesai</h2><p className="my-3">{result.created} makna disimpan, {result.skipped} duplikat dilewati.</p><Button asChild><Link href={`/decks/${deckId}`}>Kembali ke deck</Link></Button></section>}
    {rows.length > 0 && !result && <section className="panel"><h2 className="text-lg font-semibold">Preview impor</h2><p className="mt-2 mb-5 text-sm text-muted-foreground">{selected.length} dipilih · {rows.filter(r => r.duplicate).length} duplikat · {rows.filter(r => r.error).length} baris tidak valid</p><div className="max-h-[32rem] space-y-3 overflow-auto">{rows.map(row => <label key={row.row} className="flex items-start gap-3 rounded-xl border border-border p-4"><input type="checkbox" checked={selected.includes(row.row)} disabled={busy || !row.item || row.duplicate} onChange={e => setSelected(e.target.checked ? [...selected, row.row] : selected.filter(n => n !== row.row))} /><span className="min-w-0"><span className="block">Baris {row.row}: {row.item?.word || "Tidak valid"}</span>{row.item && <><span className="mt-1 block text-sm font-normal text-muted-foreground">{row.item.senses[0].meaningInIndonesian}</span><span className="mt-2 block text-sm font-normal">{row.item.senses[0].examples[0].sentenceEn}</span></>}{row.duplicate && <span className="mt-2 block text-sm text-amber-800">Duplikat — akan dilewati</span>}{row.error && <span className="mt-2 block text-sm text-red-700">{row.error}</span>}</span></label>)}</div><Button className="mt-6" disabled={busy || !selected.length} onClick={async () => { setBusy(true); setError(""); try { setResult(await apiFetch("/api/import/csv/commit", { method: "POST", body: JSON.stringify({ csv, deckId, rows: selected }) })); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>{busy ? "Menyimpan…" : `Impor ${selected.length} baris terpilih`}</Button></section>}
  </div>;
}
