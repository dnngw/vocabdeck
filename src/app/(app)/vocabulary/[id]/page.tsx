import Link from "next/link";
import { notFound } from "next/navigation";
import { pageData, pageUser } from "@/server/page-auth";
import { getDb } from "@/lib/db";
import { idSchema } from "@/lib/validation";
import { ContentService } from "@/server/content";
import { VocabularyEditor } from "@/components/vocabulary-editor";
import { DeleteButton } from "@/components/deck-form";
export default async function Vocabulary({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const user = await pageUser();
  const entry = await pageData(() =>
    new ContentService(getDb()).getVocabulary(user, id),
  );
  return (
    <>
      <Link
        href={`/decks/${entry.deckId}`}
        className="text-sm font-medium text-primary"
      >
        {entry.deck.name}
      </Link>
      <header className="mt-5 mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow mb-3">
            {entry.senses.length} makna · {entry.source}
          </p>
          <h1 className="page-title break-words">{entry.word}</h1>
        </div>
        <DeleteButton
          endpoint={`/api/vocabulary/${id}`}
          label={`kata “${entry.word}”`}
          returnTo={`/decks/${entry.deckId}`}
        />
      </header>
      <VocabularyEditor
        initial={entry}
        entryId={id}
        deckId={entry.deckId}
        decks={[entry.deck]}
      />
    </>
  );
}
