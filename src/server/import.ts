import "server-only";
import { z } from "zod";
import { parseCsv } from "@/lib/csv";
import { idSchema, normalize } from "@/lib/validation";
import type { Database } from "@/lib/db";
import type { UserContext } from "./auth";
import { AppError, notFound } from "./errors";
import { ContentService } from "./content";
const inputSchema = z.object({ deckId: idSchema, csv: z.string().min(1).max(1_000_000), rows: z.array(z.number().int().min(2).max(501)).max(500).optional() });
export class ImportService {
  constructor(private db: Database) {}
  async preview(user: UserContext, raw: unknown) {
    const input = inputSchema.parse(raw);
    if (!await this.db.deck.findFirst({ where: { id: input.deckId, ownerId: user.id } })) notFound();
    let rows; try { rows = parseCsv(input.csv); } catch (error) { throw new AppError(422, "INVALID_CSV", (error as Error).message); }
    const words = [...new Set(rows.flatMap(r => r.item ? [normalize(r.item.word)] : []))];
    const entries = await this.db.vocabularyEntry.findMany({ where: { deckId: input.deckId, deck: { ownerId: user.id }, normalized: { in: words } }, include: { senses: true } });
    return rows.map(row => ({ ...row, duplicate: row.duplicate || Boolean(row.item && entries.some(e => e.normalized === normalize(row.item!.word) && e.partOfSpeech === row.item!.partOfSpeech && e.senses.some(s => s.normalized === normalize(row.item!.senses[0].meaningInIndonesian)))) }));
  }
  async commit(user: UserContext, raw: unknown) {
    const input = inputSchema.parse(raw); const rows = await this.preview(user, input);
    const selected = new Set(input.rows || []);
    if (!selected.size || [...selected].some(n => !rows.some(r => r.row === n && r.item))) throw new AppError(422, "INVALID_SELECTION", "Pilih baris yang valid.");
    return new ContentService(this.db).addBatch(user, input.deckId, rows.filter(r => selected.has(r.row) && r.item).map(r => r.item!), "csv");
  }
}
