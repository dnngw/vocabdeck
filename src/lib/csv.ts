import { parse } from "csv-parse/sync";
import {
  vocabularySchema,
  type VocabularyInput,
  normalize,
} from "./validation";

const headers = [
  "word",
  "part_of_speech",
  "meaning_indonesian",
  "definition_en",
  "sentence_en",
  "translation_indonesian",
  "context_explanation_indonesian",
  "deck",
];
export type CsvRow = {
  row: number;
  item: VocabularyInput | null;
  error: string | null;
  duplicate: boolean;
};
export function parseCsv(csv: string): CsvRow[] {
  if (Buffer.byteLength(csv, "utf8") > 1_000_000)
    throw new Error("Ukuran CSV maksimal 1 MB.");
  const records = parse(csv, {
    bom: true,
    skip_empty_lines: true,
    trim: true,
    max_record_size: 16_000,
    columns(input: string[]) {
      if (
        new Set(input).size !== input.length ||
        !["word", "meaning_indonesian", "sentence_en"].every((h) =>
          input.includes(h),
        ) ||
        input.some((h) => !headers.includes(h))
      )
        throw new Error(
          "Header CSV tidak sesuai. Gunakan template yang disediakan.",
        );
      return input;
    },
  }) as Record<string, string>[];
  if (!records.length || records.length > 500)
    throw new Error("CSV harus berisi 1–500 baris.");
  const seen = new Set<string>();
  return records.map((record, index) => {
    const result = vocabularySchema.safeParse({
      word: record.word,
      partOfSpeech: record.part_of_speech,
      senses: [
        {
          meaningInIndonesian: record.meaning_indonesian,
          definitionEn: record.definition_en,
          examples: [
            {
              sentenceEn: record.sentence_en,
              translationInIndonesian: record.translation_indonesian,
              contextExplanationInIndonesian:
                record.context_explanation_indonesian,
            },
          ],
        },
      ],
    });
    if (!result.success)
      return {
        row: index + 2,
        item: null,
        error: result.error.issues.map((i) => i.message).join("; "),
        duplicate: false,
      };
    const key = [
      normalize(result.data.word),
      result.data.partOfSpeech,
      normalize(result.data.senses[0].meaningInIndonesian),
    ].join("\0");
    const duplicate = seen.has(key);
    seen.add(key);
    return { row: index + 2, item: result.data, error: null, duplicate };
  });
}
