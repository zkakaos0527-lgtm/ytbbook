import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We test the internal batching/parallelism by intercepting fetch.
// The key behaviors under test:
//   1. A batch of ≤200 subtitles makes exactly ONE Gemini fetch call (no internal re-batching).
//   2. When translateWithClaude is called with 201+ subtitles it still works (caller is
//      responsible for splitting, but we verify the function handles it gracefully).

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

describe("translateWithClaude – parallel batching", () => {
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

  it("translates 50 subtitles with exactly one Gemini API call", async () => {
    const subtitles = makeSubtitles(50);
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
    expect(results).toHaveLength(50);
  });

  it("fires batch calls in parallel when given 400 subtitles (2 batches of 200)", async () => {
    const subtitles = makeSubtitles(400);
    const callStartTimes: number[] = [];
    const callEndTimes: number[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, options: RequestInit) => {
        callStartTimes.push(Date.now());
        // Simulate 50ms latency per call
        await new Promise((r) => setTimeout(r, 50));
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

    // Sequential would take ~100ms; parallel should finish in ~50ms (+margin)
    expect(elapsed).toBeLessThan(90);
    expect(results).toHaveLength(400);
    // Both calls should have started before either finished
    expect(callStartTimes).toHaveLength(2);
    expect(callStartTimes[1]).toBeLessThan(callEndTimes[0]);
  });
});
