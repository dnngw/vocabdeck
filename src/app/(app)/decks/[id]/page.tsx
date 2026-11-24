import Link from "next/link";
import { BookOpen, Plus, Upload, Sparkles, Search } from "lucide-react";
import { getDb } from "@/lib/db";
import { idSchema } from "@/lib/validation";
import { notFound } from "next/navigation";
import { pageData, pageUser } from "@/server/page-auth";
import { ContentService } from "@/server/content";
import { Button } from "@/components/ui/button";
import { DeckForm, DeleteButton } from "@/components/deck-form";
export default async function DeckPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const { id } = await params; if (!idSchema.safeParse(id).success) notFound();
  const { q = "" } = await searchParams; const user = await pageUser();
  const deck = await pageData(() => new ContentService(getDb()).getDeck(user, id, q));
  return <><Link href="/decks" className="text-sm font-medium text-primary">Semua deck</Link><header className="mt-5 mb-8"><p className="eyebrow mb-3">{deck._count.vocabulary} kata dalam koleksi</p><h1 className="page-title break-words">{deck.name}</h1>{deck.description && <p className="mt-3 text-muted-foreground">{deck.description}</p>}</header>
    <div className="mb-7 flex flex-wrap gap-3"><Button asChild><Link href={`/study?deckId=${id}`}><BookOpen size={18} />Belajar deck ini</Link></Button><Button asChild variant="outline"><Link href={`/vocabulary/new?deckId=${id}`}><Plus size={18} />Tambah kata</Link></Button><Button asChild variant="outline"><Link href={`/decks/${id}/import`}><Upload size={18} />Impor CSV</Link></Button><Button asChild variant="outline"><Link href={`/ai/generate?deckId=${id}`}><Sparkles size={18} />Buat dengan AI</Link></Button></div>
    <form className="mb-6 flex gap-2" role="search"><label className="grow"><span className="sr-only">Cari kata</span><input name="q" defaultValue={q} placeholder="Cari kata di deck ini…" maxLength={120} /></label><Button variant="outline" aria-label="Cari"><Search size={18} /></Button></form>
    <div className="space-y-3">{deck.vocabulary.map(entry => <Link key={entry.id} href={`/vocabulary/${entry.id}`} className="panel flex items-center justify-between gap-4 hover:border-primary"><div className="min-w-0"><h2 className="text-lg font-semibold break-words">{entry.word} <span className="text-sm font-normal text-muted-foreground">{entry.partOfSpeech}</span></h2><p className="mt-2 text-sm text-muted-foreground">{entry.senses.map(s => s.meaningInIndonesian).join(" · ")}</p></div><span className="shrink-0 rounded-lg bg-muted px-3 py-1.5 text-xs">{entry.senses.length} makna</span></Link>)}</div>
    {!deck.vocabulary.length && <div className="panel py-12 text-center"><BookOpen className="mx-auto mb-4 text-primary" size={30} /><h2 className="text-lg font-semibold">{q ? "Kata belum ditemukan" : "Deck ini masih kosong"}</h2><p className="mt-2 text-sm text-muted-foreground">{q ? "Coba kata pencarian lain." : "Tambahkan kata pertama, impor CSV, atau minta bantuan AI."}</p></div>}
    {deck.vocabulary.length === 200 && <p className="mt-4 text-sm text-muted-foreground">Menampilkan maksimal 200 kata. Gunakan pencarian untuk menemukan kata lainnya.</p>}
    <div className="mt-10 flex flex-wrap items-start gap-3 border-t border-border pt-6"><div className="grow"><DeckForm initial={{ id, name: deck.name, description: deck.description }} /></div><DeleteButton endpoint={`/api/decks/${id}`} label={`deck “${deck.name}”`} returnTo="/decks" /></div>
  </>;
}
