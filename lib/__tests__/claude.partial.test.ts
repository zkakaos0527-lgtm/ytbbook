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

describe("translateWithClaude partial failure tolerance", () => {
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

  it("when one batch fails, successful batches are not discarded", async () => {
    const subtitles = makeSubtitles(600); // 3 batches of 200
    let callCount = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, options: RequestInit) => {
        callCount++;
        const body = JSON.parse(options.body as string);
        const inputSubtitles = JSON.parse(
          body.contents[0].parts[0].text.split("字幕：\n")[1],
        ) as { id: string }[];

        // Batch 2 (callCount === 2) fails with a 500 error
        if (callCount === 2) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ error: "Internal server error" }),
          };
        }

        return {
          ok: true,
          json: async () => makeGeminiResponse(inputSubtitles),
        };
      }),
    );

    const { translateWithClaude } = await import("../claude");

    // Should not throw — should return the 2 successful batches
    const results = await translateWithClaude(subtitles);

    // Batches 1 and 3 succeeded = 400 successful translations
    expect(results).toHaveLength(400);
    // Verify the successful translations are present
    // Batch 1 (s0-s199) succeeded
    expect(results.find((r) => r.id === "s0")).toEqual({
      id: "s0",
      translated_text: "翻译 s0",
    });
    // Batch 3 (s400-s599) succeeded — s200-s399 belong to failed batch 2
    expect(results.find((r) => r.id === "s400")).toEqual({
      id: "s400",
      translated_text: "翻译 s400",
    });
    expect(results.find((r) => r.id === "s200")).toBeUndefined(); // batch 2 failed
    expect(results.find((r) => r.id === "s399")).toBeUndefined(); // batch 2 failed
  });

  it("still throws when ALL batches fail", async () => {
    const subtitles = makeSubtitles(200);

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

  it("applies partial translations to notebook when some batches fail", async () => {
    const subtitles = makeSubtitles(600); // 3 batches

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, options: RequestInit) => {
        const body = JSON.parse(options.body as string);
        const inputSubtitles = JSON.parse(
          body.contents[0].parts[0].text.split("字幕：\n")[1],
        ) as { id: string }[];
        const firstId = parseInt(inputSubtitles[0].id.slice(1), 10);

        // Batch 2 (firstId == 200) fails
        if (firstId === 200) {
          return {
            ok: false,
            status: 502,
            json: async () => ({ error: "Bad gateway" }),
          };
        }

        return {
          ok: true,
          json: async () => makeGeminiResponse(inputSubtitles),
        };
      }),
    );

    const { translateWithClaude, applyTranslationsToNotebook } = await import("../claude");

    const translations = await translateWithClaude(subtitles);
    const notebook = {
      id: "n1",
      youtubeUrl: "https://youtube.com/watch?v=abc",
      videoTitle: "Test Video",
      channelName: "Test Channel",
      durationSeconds: 600,
      thumbnailUrl: "",
      sourceLanguage: "en",
      targetLanguage: "zh",
      summary: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subtitles: subtitles.map((s, i) => ({
        id: s.id,
        notebookId: "n1",
        sequence: i,
        startTime: i * 5,
        endTime: (i + 1) * 5,
        originalText: s.text,
        translatedText: null as string | null,
        userNote: null,
        createdAt: new Date().toISOString(),
      })),
    };

    const updated = applyTranslationsToNotebook(notebook, translations);

    // Batches 1 (0-199) and 3 (400-599) succeeded; batch 2 (200-399) failed
    const translated = updated.subtitles.filter((s) => s.translatedText !== null);
    const pending = updated.subtitles.filter(
      (s) => s.translatedText === null && subtitles.find((sub) => sub.id === s.id) !== undefined,
    );

    expect(translated).toHaveLength(400);
    expect(pending).toHaveLength(200); // s200-s399
  });
});