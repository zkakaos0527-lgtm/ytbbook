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

describe("translateWithClaude parallel batching", () => {
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
    vi.unstubAllGlobals();
  });

  it("translates 200 subtitles with exactly one Gemini API call", async () => {
    const subtitles = makeSubtitles(200);
    let callCount = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, options: RequestInit) => {
        callCount++;
        const body = JSON.parse(options.body as string);
        const inputSubtitles = JSON.parse(
          body.contents[0].parts[0].text.split("字幕：\n")[1],
        ) as { id: string }[];

        return {
          ok: true,
          json: async () => makeGeminiResponse(inputSubtitles),
        };
      }),
    );

    const { translateWithClaude } = await import("../claude");
    const results = await translateWithClaude(subtitles);

    expect(callCount).toBe(1);
    expect(results).toHaveLength(200);
    expect(results[0]).toEqual({ id: "s0", translated_text: "翻译 s0" });
    expect(results[199]).toEqual({ id: "s199", translated_text: "翻译 s199" });
  });

  it("includes responseMimeType application/json in Gemini request", async () => {
    const subtitles = makeSubtitles(10);
    let capturedBody: Record<string, unknown> | null = null;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, options: RequestInit) => {
        capturedBody = JSON.parse(options.body as string) as Record<string, unknown>;
        const inputSubtitles = JSON.parse(
          (
            capturedBody.contents as {
              parts: { text: string }[];
            }[]
          )[0].parts[0].text.split("字幕：\n")[1],
        ) as { id: string }[];

        return {
          ok: true,
          json: async () => makeGeminiResponse(inputSubtitles),
        };
      }),
    );

    const { translateWithClaude } = await import("../claude");
    await translateWithClaude(subtitles);

    expect(
      (capturedBody?.generationConfig as Record<string, unknown>)?.responseMimeType,
    ).toBe("application/json");
  });

  it("caps concurrent Gemini calls at 5 while keeping each wave parallel", async () => {
    const subtitles = makeSubtitles(1200);
    let activeCalls = 0;
    let maxActiveCalls = 0;
    const callStartTimes: number[] = [];
    const callEndTimes: number[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, options: RequestInit) => {
        activeCalls++;
        maxActiveCalls = Math.max(maxActiveCalls, activeCalls);
        callStartTimes.push(Date.now());

        await new Promise((resolve) => setTimeout(resolve, 50));

        activeCalls--;
        callEndTimes.push(Date.now());

        const body = JSON.parse(options.body as string);
        const inputSubtitles = JSON.parse(
          body.contents[0].parts[0].text.split("字幕：\n")[1],
        ) as { id: string }[];

        return {
          ok: true,
          json: async () => makeGeminiResponse(inputSubtitles),
        };
      }),
    );

    const { translateWithClaude } = await import("../claude");
    const start = Date.now();
    const results = await translateWithClaude(subtitles);
    const elapsed = Date.now() - start;

    expect(results).toHaveLength(1200);
    expect(maxActiveCalls).toBeLessThanOrEqual(5);
    expect(callStartTimes).toHaveLength(6);
    // Wave 1: first 5 batches run in parallel (start together, finish ~50ms later)
    expect(callStartTimes[4]).toBeLessThan(callEndTimes[0]);
    // Wave 2: 6th batch starts only after wave 1 finishes (~50ms)
    // Sequential would have all start times < all end times
    expect(callStartTimes[5]).toBeGreaterThanOrEqual(callEndTimes[0]);
    // With concurrency cap, 6 batches × 50ms ≈ 100-130ms (2 waves)
    // Pure sequential would be 300ms+
    expect(elapsed).toBeLessThan(130);
  });
});
