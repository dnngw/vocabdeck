import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { idSchema } from "@/lib/validation";
import { pageData, pageUser } from "@/server/page-auth";
import { ContentService } from "@/server/content";
import { CsvImport } from "@/components/csv-import";
export default async function Import({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!idSchema.safeParse(id).success) notFound(); const user = await pageUser();
  const deck = await pageData(() => new ContentService(getDb()).getDeck(user, id));
  return <><Link href={`/decks/${id}`} className="text-sm font-medium text-primary">{deck.name}</Link><header className="mt-5 mb-8"><p className="eyebrow mb-3">Dari catatan ke kartu</p><h1 className="page-title">Impor CSV</h1><p className="mt-2 text-muted-foreground">Periksa dahulu, lalu simpan baris yang kamu pilih.</p></header><CsvImport deckId={id} /></>;
}
