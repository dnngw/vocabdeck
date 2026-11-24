import { z } from "zod";

export const idSchema = z.uuid();
const text = (max: number) => z.string().trim().max(max);
export const deckSchema = z.object({ name: text(100).min(1, "Nama deck wajib diisi."), description: text(500).default("") });
export const exampleSchema = z.object({
  id: idSchema.optional(),
  sentenceEn: text(2000).min(1, "Kalimat Inggris wajib diisi."),
  translationInIndonesian: text(2000).default(""),
  contextExplanationInIndonesian: text(2000).default(""),
});
export const senseSchema = z.object({
  id: idSchema.optional(),
  meaningInIndonesian: text(500).min(1, "Makna Indonesia wajib diisi."),
  definitionEn: text(1000).default(""),
  examples: z.array(exampleSchema).min(1).max(3),
});
export const vocabularySchema = z.object({
  word: text(120).min(1, "Kata wajib diisi."),
  partOfSpeech: text(40).toLowerCase().default(""),
  senses: z.array(senseSchema).min(1).max(5),
}).superRefine((value, ctx) => {
  const meanings = new Set<string>();
  value.senses.forEach((sense, i) => {
    const key = normalize(sense.meaningInIndonesian);
    if (meanings.has(key)) ctx.addIssue({ code: "custom", path: ["senses", i], message: "Makna duplikat dalam satu kata." });
    meanings.add(key);
  });
});
export const settingsSchema = z.object({
  dailyNewLimit: z.number().int().min(0).max(100),
  desiredRetention: z.number().min(0.7).max(0.97),
  timezone: text(100).refine(value => { try { new Intl.DateTimeFormat("id", { timeZone: value }); return true; } catch { return false; } }, "Timezone tidak valid."),
});
export const reviewSchema = z.object({ progressId: idSchema, requestId: idSchema, version: z.number().int().min(0), rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]) });
export const generateSchema = z.object({ mode: z.enum(["word", "topic"]), input: text(2000).min(1), count: z.number().int().min(1).max(20).default(5), level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).default("B1") });
export const generatedSchema = z.object({ items: z.array(vocabularySchema).min(1).max(20) });
export type VocabularyInput = z.infer<typeof vocabularySchema>;
export type GenerateInput = z.infer<typeof generateSchema>;
export function normalize(value: string) { return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en"); }
