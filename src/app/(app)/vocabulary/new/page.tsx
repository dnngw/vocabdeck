import { pageUser } from "@/server/page-auth";
import { getDb } from "@/lib/db";
import { ContentService } from "@/server/content";
import { VocabularyEditor } from "@/components/vocabulary-editor";
export default async function NewVocabulary({ searchParams }: { searchParams: Promise<{ deckId?: string }> }) {
  const decks = await new ContentService(getDb()).listDecks(await pageUser()); const { deckId } = await searchParams;
  return <><header className="mb-8"><p className="eyebrow mb-3">Bangun koleksimu</p><h1 className="page-title">Tambah vocabulary</h1><p className="mt-2 text-muted-foreground">Simpan makna dan contoh yang membuat kata ini berarti.</p></header><VocabularyEditor decks={decks.map(d => ({ id: d.id, name: d.name }))} deckId={decks.some(d => d.id === deckId) ? deckId : undefined} /></>;
}
