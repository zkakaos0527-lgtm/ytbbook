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
    const expectedBatchCount = Math.ceil(
      subtitles.length / MAX_TRANSLATION_SUBTITLES_PER_REQUEST,
    );
    const expectedLastBatchSize =
      subtitles.length % MAX_TRANSLATION_SUBTITLES_PER_REQUEST ||
      MAX_TRANSLATION_SUBTITLES_PER_REQUEST;

    expect(batches).toHaveLength(expectedBatchCount);
    expect(batches[0]).toHaveLength(MAX_TRANSLATION_SUBTITLES_PER_REQUEST);
    expect(batches.at(-1)).toHaveLength(expectedLastBatchSize);
  });
});
