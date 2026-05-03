import type { TranslationInputSubtitle } from "@/types";

export const MAX_TRANSLATION_SUBTITLES_PER_REQUEST = 50;

export function buildTranslationRequestBatches(
  subtitles: TranslationInputSubtitle[],
  batchSize = MAX_TRANSLATION_SUBTITLES_PER_REQUEST,
): TranslationInputSubtitle[][] {
  const batches: TranslationInputSubtitle[][] = [];

  for (let index = 0; index < subtitles.length; index += batchSize) {
    batches.push(subtitles.slice(index, index + batchSize));
  }

  return batches;
}
