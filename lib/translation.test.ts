import { describe, expect, it } from "vitest";

import {
  MAX_TRANSLATION_SUBTITLES_PER_REQUEST,
  buildTranslationRequestBatches,
} from "./translation";

describe("buildTranslationRequestBatches", () => {
  it("splits large subtitle lists into request-sized chunks", () => {
    const subtitles = Array.from({ length: 3503 }, (_, index) => ({
      id: `sub-${index + 1}`,
      text: `Sentence ${index + 1}`,
    }));

    const batches = buildTranslationRequestBatches(subtitles);

    expect(MAX_TRANSLATION_SUBTITLES_PER_REQUEST).toBe(100);
    expect(batches).toHaveLength(36);
    expect(batches[0]).toHaveLength(100);
    expect(batches.at(-1)).toHaveLength(3);
  });
});
