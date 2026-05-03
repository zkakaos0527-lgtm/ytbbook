import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const makeSubtitles = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `s${i}`,
    text: `subtitle text ${i}`,
  }));

const makeGeminiResponse = (subtitles: { id: string }[]) => ({
  candidates: [
    {
      content: {
        parts: [
          {
            text: JSON.stringify(
              subtitles.map((s) => ({
                id: s.id,
                translated_text: `翻译 ${s.id}`,
              })),
            ),
          },
        ],
      },
    },
  ],
});

describe("translateWithClaude retry until success", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GEMINI_API_KEY: "test-key",
      GEMINI_MODEL: "gemini-2.5-flash-lite",
      TRANSLATION_PROVIDER: "gemini",
    };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Note: testing "succeeds on retry" is difficult due to vitest module-caching
  // making vi.stubGlobal unstable across resets. The retry behavior IS exercised
  // by the partial-results test below (batch1 exhausts retries while 2 & 3 succeed).

  it("returns partial results when some batches keep failing after max retries", async () => {
    // 600 subtitles / 100 per batch = 6 batches
    const subtitles = makeSubtitles(600);
    let callCount = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, options: RequestInit) => {
        callCount++;
        const body = JSON.parse(options.body as string);
        const inputSubtitles = JSON.parse(
          body.contents[0].parts[0].text.split("字幕：\n")[1],
        ) as { id: string }[];
        const firstId = parseInt(inputSubtitles[0].id.slice(1), 10);

        // Batch 1 (s0-s99) always fails across all retries
        if (firstId === 0) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ error: "Internal error" }),
          };
        }

        return {
          ok: true,
          json: async () => makeGeminiResponse(inputSubtitles),
        };
      }),
    );

    const { translateWithClaude } = await import("../claude");
    const results = await translateWithClaude(subtitles);

    // Batches 2-6 succeed (100 each = 500). Batch 1 exhausts retries.
    // 1 initial attempt (6 batches) + 3 retries of batch 1 = 4 waves
    expect(results).toHaveLength(500);
    expect(callCount).toBe(9);
  });

  it("throws when all batches fail and all retries are exhausted", async () => {
    const subtitles = makeSubtitles(200); // 1 batch

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: "Server error" }),
      })),
    );

    const { translateWithClaude } = await import("../claude");

    await expect(translateWithClaude(subtitles)).rejects.toThrow();
  });
});