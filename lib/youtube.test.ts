import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchTranscriptMock } = vi.hoisted(() => ({
  fetchTranscriptMock: vi.fn(),
}));

vi.mock("youtube-transcript", () => ({
  YoutubeTranscript: {
    fetchTranscript: fetchTranscriptMock,
  },
}));

import {
  extractYoutubeVideoId,
  getYoutubeTranscript,
  toTranscriptApiError,
} from "./youtube";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("extractYoutubeVideoId", () => {
  it("extracts the id from a standard watch url", () => {
    expect(
      extractYoutubeVideoId("https://www.youtube.com/watch?v=abc123def45"),
    ).toBe("abc123def45");
  });

  it("extracts the id from a short url", () => {
    expect(extractYoutubeVideoId("https://youtu.be/abc123def45")).toBe(
      "abc123def45",
    );
  });

  it("returns null for unsupported urls", () => {
    expect(extractYoutubeVideoId("https://example.com/video")).toBeNull();
  });
});

describe("toTranscriptApiError", () => {
  it("converts connection reset errors into a clear upstream connectivity message", () => {
    const error = new TypeError("fetch failed");
    Object.assign(error, {
      cause: new Error("read ECONNRESET"),
    });

    const normalized = toTranscriptApiError(error);

    expect(normalized.status).toBe(503);
    expect(normalized.message).toContain("Cannot reach YouTube");
  });

  it("converts disabled transcript errors into a 422", () => {
    const error = new Error("Could not get transcripts for video");
    const normalized = toTranscriptApiError(error);
    expect(normalized.status).toBe(503);
  });
});

describe("getYoutubeTranscript", () => {
  it("uses the available transcript track when the video is not in English", async () => {
    fetchTranscriptMock.mockResolvedValueOnce([
      {
        text: "Hola mundo",
        duration: 1.5,
        offset: 0,
        lang: "es",
      },
    ]);

    const transcript = await getYoutubeTranscript(
      "https://www.youtube.com/watch?v=abc123def45",
    );

    expect(fetchTranscriptMock).toHaveBeenCalledWith("abc123def45");
    expect(transcript.videoInfo.language).toBe("es");
    expect(transcript.subtitles).toEqual([
      {
        start: 0,
        end: 1.5,
        text: "Hola mundo",
      },
    ]);
  });

  it("reports login-required videos clearly instead of saying captions are missing", async () => {
    fetchTranscriptMock.mockRejectedValueOnce(
      new Error("[YoutubeTranscript] 🚨 Transcript is disabled on this video (abc123def45)"),
    );

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        playabilityStatus: {
          status: "LOGIN_REQUIRED",
        },
      }),
    } as Response);

    await expect(
      getYoutubeTranscript("https://www.youtube.com/watch?v=abc123def45"),
    ).rejects.toMatchObject({
      status: 403,
      message:
        "This video requires YouTube login or verification, so subtitles cannot be fetched anonymously.",
    });

    expect(fetchTranscriptMock).toHaveBeenCalledWith("abc123def45");

    global.fetch = originalFetch;
  });
});
