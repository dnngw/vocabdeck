import { getDb } from "@/lib/db";
import { pageUser } from "@/server/page-auth";
import { ContentService } from "@/server/content";
import { AIGenerator } from "@/components/ai-generator";
export default async function Generate({
  searchParams,
}: {
  searchParams: Promise<{ deckId?: string }>;
}) {
  const user = await pageUser();
  const db = getDb();
  const { deckId } = await searchParams;
  const [decks, setting] = await Promise.all([
    new ContentService(db).listDecks(user),
    db.appSetting.findUnique({ where: { key: "ai_enabled" } }),
  ]);
  const enabled =
    process.env.AI_ENABLED === "true" &&
    !!process.env.DEEPSEEK_API_KEY &&
    !!process.env.AI_MODEL &&
    setting?.value !== false;
  return (
    <>
      <header className="mb-8">
        <p className="eyebrow mb-3">Rasa ingin tahu, dibantu AI</p>
        <h1 className="page-title">Temukan konteks baru</h1>
        <p className="mt-2 text-muted-foreground">
          Kamu memilih kata yang layak masuk ke koleksimu.
        </p>
      </header>
      <AIGenerator
        decks={decks.map((d) => ({ id: d.id, name: d.name }))}
        initialDeckId={decks.some((d) => d.id === deckId) ? deckId : undefined}
        enabled={enabled}
      />
    </>
  );
}
