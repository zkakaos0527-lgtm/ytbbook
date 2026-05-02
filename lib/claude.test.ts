import { describe, expect, it } from "vitest";

import {
  applyTranslationsToNotebook,
  buildTranslationBatches,
  parseTranslationResponse,
} from "./claude";
import type { Notebook } from "@/types";

describe("buildTranslationBatches", () => {
  it("splits subtitles into chunks of 20", () => {
    const subtitles = Array.from({ length: 45 }, (_, index) => ({
      id: `sub-${index + 1}`,
      text: `Sentence ${index + 1}`,
    }));

    const batches = buildTranslationBatches(subtitles, 20);

    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(20);
    expect(batches[1]).toHaveLength(20);
    expect(batches[2]).toHaveLength(5);
  });

  it("uses a safe default batch size for one API call", () => {
    const subtitles = Array.from({ length: 101 }, (_, index) => ({
      id: `sub-${index + 1}`,
      text: `Sentence ${index + 1}`,
    }));

    const batches = buildTranslationBatches(subtitles);

    expect(batches).toHaveLength(6);
    expect(batches[0]).toHaveLength(20);
    expect(batches.at(-1)).toHaveLength(1);
  });
});

describe("parseTranslationResponse", () => {
  it("extracts a clean translation array from the model text response", () => {
    const parsed = parseTranslationResponse(`
      Here is the result:
      [
        {"id":"sub-1","translated_text":"第一句"},
        {"id":"sub-2","translated_text":"第二句"}
      ]
    `);

    expect(parsed).toEqual([
      {
        id: "sub-1",
        translated_text: "第一句",
      },
      {
        id: "sub-2",
        translated_text: "第二句",
      },
    ]);
  });
});

describe("applyTranslationsToNotebook", () => {
  it("merges translated text back into notebook subtitles", () => {
    const notebook: Notebook = {
      id: "draft-1",
      youtubeUrl: "https://youtube.com/watch?v=abc123def45",
      videoTitle: "Demo",
      channelName: "Channel",
      durationSeconds: 100,
      thumbnailUrl: "https://i.ytimg.com/vi/abc123def45/hqdefault.jpg",
      sourceLanguage: "en",
      targetLanguage: "zh",
      summary: "",
      createdAt: "2026-05-02T00:00:00.000Z",
      updatedAt: "2026-05-02T00:00:00.000Z",
      subtitles: [
        {
          id: "sub-1",
          notebookId: "draft-1",
          sequence: 1,
          startTime: 0,
          endTime: 1,
          originalText: "Hello",
          translatedText: null,
          userNote: null,
          createdAt: "2026-05-02T00:00:00.000Z",
        },
      ],
    };

    const updated = applyTranslationsToNotebook(notebook, [
      {
        id: "sub-1",
        translated_text: "你好",
      },
    ]);

    expect(updated.subtitles[0].translatedText).toBe("你好");
  });
});
