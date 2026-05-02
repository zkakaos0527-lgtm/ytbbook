import { describe, expect, it } from "vitest";

import {
  buildYoutubeEmbedUrl,
  buildYoutubeThumbnailUrl,
  createNotebookDraftFromTranscript,
} from "./workspace";

describe("buildYoutubeEmbedUrl", () => {
  it("builds an embed url from a video id", () => {
    expect(buildYoutubeEmbedUrl("abc123def45")).toBe(
      "https://www.youtube.com/embed/abc123def45",
    );
  });
});

describe("buildYoutubeThumbnailUrl", () => {
  it("builds a stable high-quality thumbnail url", () => {
    expect(buildYoutubeThumbnailUrl("abc123def45")).toBe(
      "https://i.ytimg.com/vi/abc123def45/hqdefault.jpg",
    );
  });
});

describe("createNotebookDraftFromTranscript", () => {
  it("maps transcript payload into a frontend notebook draft", () => {
    const notebook = createNotebookDraftFromTranscript({
      youtubeUrl: "https://www.youtube.com/watch?v=abc123def45",
      transcript: {
        videoInfo: {
          id: "abc123def45",
          title: "A Great Video",
          channel: "Learning Channel",
          duration: 125,
          language: "en",
        },
        subtitles: [
          {
            start: 0,
            end: 2.5,
            text: "First sentence",
          },
          {
            start: 2.5,
            end: 5,
            text: "Second sentence",
          },
        ],
      },
    });

    expect(notebook.videoTitle).toBe("A Great Video");
    expect(notebook.thumbnailUrl).toBe(
      "https://i.ytimg.com/vi/abc123def45/hqdefault.jpg",
    );
    expect(notebook.subtitles[0]).toMatchObject({
      sequence: 1,
      originalText: "First sentence",
      translatedText: null,
    });
  });
});
