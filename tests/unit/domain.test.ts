import { describe, expect, it } from "vitest";
import { StudyScheduler } from "@/lib/scheduler";
import { normalize, vocabularySchema, settingsSchema } from "@/lib/validation";
import { parseCsv } from "@/lib/csv";
import { dayBounds } from "@/lib/time";
describe("domain validation", () => {
  it("normalizes unicode, spaces and case for duplicate detection", () =>
    expect(normalize(" ＴＡＫＥ   off ")).toBe("take off"));
  it("requires an Indonesian meaning and a contextual English sentence", () => {
    expect(
      vocabularySchema.safeParse({
        word: "take",
        senses: [{ meaningInIndonesian: "", examples: [{ sentenceEn: "" }] }],
      }).success,
    ).toBe(false);
  });
  it("rejects invalid timezone and extreme review limits", () =>
    expect(
      settingsSchema.safeParse({
        timezone: "Mars",
        dailyNewLimit: 1000,
        desiredRetention: 1,
      }).success,
    ).toBe(false));
});
describe("CSV", () => {
  it("parses quoted multiline CSV, flags duplicates and retains invalid row diagnostics", () => {
    const rows = parseCsv(
      'word,meaning_indonesian,sentence_en\r\ntake,mengambil,"Take this, please.\nThank you."\r\nTAKE,Mengambil,Take this book.\r\nrun,,Run fast.',
    );
    expect(rows[0].item?.senses[0].examples[0].sentenceEn).toContain("\n");
    expect(rows[1].duplicate).toBe(true);
    expect(rows[2].error).toBeTruthy();
  });
  it("rejects missing and duplicate headers", () => {
    expect(() => parseCsv("word,word\ntake,take")).toThrow();
    expect(() => parseCsv("word\ntake")).toThrow();
  });
});
describe("FSRS scheduling", () => {
  it("persists all model fields and schedules all four ratings without mutating input", async () => {
    const scheduler = await StudyScheduler.create();
    const now = new Date("2026-11-24T02:00:00Z");
    const card = scheduler.newCard(now);
    const before = scheduler.serialize(card);
    for (const rating of [1, 2, 3, 4] as const) {
      const { card: next } = scheduler.review(card, rating, now);
      expect(next.dueAt.getTime()).toBeGreaterThan(now.getTime());
      expect(next.reps).toBe(1);
      expect(next.stabilityFast).toBeGreaterThan(0);
      expect(scheduler.deserialize(scheduler.serialize(next))).toEqual(next);
    }
    expect(scheduler.serialize(card)).toEqual(before);
    expect(scheduler.preview(card, now)).toHaveLength(4);
  });
  it("handles learning, graduation and relearning", async () => {
    const s = await StudyScheduler.create();
    let now = new Date("2026-11-24T02:00:00Z");
    let card = s.review(s.newCard(now), 1, now).card;
    expect(card.state).toBe(1);
    for (let i = 0; i < 15 && card.state !== 2; i++) {
      now = card.dueAt;
      card = s.review(card, 3, now).card;
    }
    expect(card.state).toBe(2);
    card = s.review(card, 1, card.dueAt).card;
    expect(card.state).toBe(3);
  });
});
describe("local daily boundaries", () => {
  it("uses Jakarta midnight rather than UTC midnight", () =>
    expect(
      dayBounds(
        new Date("2026-11-24T00:00:00Z"),
        "Asia/Jakarta",
      ).start.toISOString(),
    ).toBe("2026-11-23T17:00:00.000Z"));
  it("handles a daylight-saving day with 23 hours", () => {
    const { start, end } = dayBounds(
      new Date("2026-03-08T12:00:00Z"),
      "America/New_York",
    );
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });
});
