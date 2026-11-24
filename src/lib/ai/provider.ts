import type { GenerateInput, VocabularyInput } from "@/lib/validation";
export type GeneratedResult = {
  items: VocabularyInput[];
  tokensIn?: number;
  tokensOut?: number;
};
export interface AIProvider {
  readonly name: string;
  readonly model: string;
  generateVocabulary(input: GenerateInput): Promise<GeneratedResult>;
}
