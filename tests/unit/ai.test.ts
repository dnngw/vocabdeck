import { describe, expect, it, vi } from "vitest";
import { DeepSeekProvider } from "@/lib/ai/deepseek";
const input = {
  mode: "word" as const,
  input: "take",
  count: 1,
  level: "B1" as const,
};
const items = [
  {
    word: "take",
    senses: [
      {
        meaningInIndonesian: "mengambil",
        examples: [{ sentenceEn: "Take this book." }],
      },
    ],
  },
];
describe("DeepSeek adapter", () => {
  it("maps structured responses and token usage to the application contract", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: { content: JSON.stringify({ items }) },
              },
            ],
            usage: { prompt_tokens: 42, completion_tokens: 80 },
          }),
        ),
      );
    const result = await new DeepSeekProvider(
      "test-model",
      "test-key",
      fetcher,
    ).generateVocabulary(input);
    expect(result.items[0].senses[0].meaningInIndonesian).toBe("mengambil");
    expect(result.tokensOut).toBe(80);
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://api.deepseek.com/chat/completions",
    );
    expect(
      JSON.parse(String(fetcher.mock.calls[0][1]?.body)).response_format.type,
    ).toBe("json_object");
  });
  it.each([
    "not json",
    JSON.stringify({ items: [] }),
    JSON.stringify({ items: [{ word: "take", senses: [] }] }),
  ])("rejects malformed generated content", async (content) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ finish_reason: "stop", message: { content } }],
          }),
        ),
      );
    await expect(
      new DeepSeekProvider("test", "secret-key", fetcher).generateVocabulary(
        input,
      ),
    ).rejects.toMatchObject({ status: 502, code: "AI_INVALID_RESPONSE" });
  });
  it("does not expose provider errors or secrets", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("private provider details", { status: 500 }),
      );
    await expect(
      new DeepSeekProvider("test", "secret-key", fetcher).generateVocabulary(
        input,
      ),
    ).rejects.toMatchObject({ status: 502, code: "AI_UNAVAILABLE" });
  });
  it("maps timeouts without an automatic billable retry", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    await expect(
      new DeepSeekProvider("test", "secret", fetcher).generateVocabulary(input),
    ).rejects.toMatchObject({ status: 504 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
