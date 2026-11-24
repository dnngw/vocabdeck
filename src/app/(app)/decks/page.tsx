import Link from "next/link";
import { Layers3 } from "lucide-react";
import { getDb } from "@/lib/db";
import { pageUser } from "@/server/page-auth";
import { ContentService } from "@/server/content";
import { DeckForm } from "@/components/deck-form";
export default async function Decks() {
  const decks = await new ContentService(getDb()).listDecks(await pageUser());
  return (
    <>
      <header className="mb-8">
        <p className="eyebrow mb-3">Koleksi pribadi</p>
        <h1 className="page-title">Deck saya</h1>
        <p className="mt-2 text-muted-foreground">
          Tempat untuk menghubungkan kata, makna, dan konteks.
        </p>
      </header>
      <DeckForm />
      {decks.length ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {decks.map((deck) => (
            <Link
              href={`/decks/${deck.id}`}
              key={deck.id}
              className="panel hover:border-primary"
            >
              <span className="mb-6 inline-flex rounded-xl bg-emerald-50 p-3 text-primary">
                <Layers3 size={24} />
              </span>
              <h2 className="text-lg font-semibold">{deck.name}</h2>
              <p className="mt-2 min-h-10 text-sm leading-relaxed text-muted-foreground">
                {deck.description || "Setiap kata punya ceritanya sendiri."}
              </p>
              <p className="mt-6 border-t border-border pt-4 text-sm font-medium">
                {deck._count.vocabulary} kata
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="panel mt-8 py-14 text-center">
          <Layers3 className="mx-auto mb-5 text-primary" size={36} />
          <h2 className="text-xl font-semibold">Belum ada deck</h2>
          <p className="mt-3 text-muted-foreground">
            Buat deck untuk buku, pekerjaan, atau percakapan sehari-hari.
          </p>
        </div>
      )}
    </>
  );
}
