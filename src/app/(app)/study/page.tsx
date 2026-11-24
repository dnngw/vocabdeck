import { pageData, pageUser } from "@/server/page-auth";
import { getDb } from "@/lib/db";
import { idSchema } from "@/lib/validation";
import { notFound } from "next/navigation";
import { StudyService } from "@/server/study";
import { StudySession } from "@/components/study-session";
export default async function Study({
  searchParams,
}: {
  searchParams: Promise<{ deckId?: string }>;
}) {
  const { deckId } = await searchParams;
  if (deckId && !idSchema.safeParse(deckId).success) notFound();
  const user = await pageUser();
  const queue = await pageData(() =>
    new StudyService(getDb()).queue(user, deckId),
  );
  return <StudySession initial={queue} deckId={deckId} />;
}
