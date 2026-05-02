import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  extractYoutubeVideoId,
  getYoutubeTranscript,
  toTranscriptApiError,
} from "./youtube";

const originalEnv = process.env;

beforeEach(() => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
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

  it("converts missing transcript errors into a 422", () => {
    const error = new Error("No transcript available for video");
    const normalized = toTranscriptApiError(error);
    expect(normalized.status).toBe(422);
  });
});

describe("getYoutubeTranscript", () => {
  it("uses Supadata when SUPADATA_API_KEY is configured", async () => {
    process.env.SUPADATA_API_KEY = "supadata-key";

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        lang: "es",
        content: [
          {
            text: "Hola mundo",
            offset: 0,
            duration: 1.5,
          },
        ],
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const transcript = await getYoutubeTranscript(
      "https://www.youtube.com/watch?v=abc123def45",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.supadata.ai/v1/transcript?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dabc123def45&mode=native&text=false",
      expect.objectContaining({
        headers: {
          "x-api-key": "supadata-key",
        },
      }),
    );
    expect(transcript.videoInfo.language).toBe("es");
    expect(transcript.subtitles).toEqual([
      {
        start: 0,
        end: 1.5,
        text: "Hola mundo",
      },
    ]);
  });

  it("falls back to RapidAPI when Supadata cannot provide subtitles", async () => {
    process.env.SUPADATA_API_KEY = "supadata-key";
    process.env.RAPIDAPI_KEY = "rapidapi-key";
    process.env.RAPIDAPI_HOST = "youtube-transcript-api.example.com";
    process.env.RAPIDAPI_TRANSCRIPT_URL =
      "https://youtube-transcript-api.example.com/transcript?video_id={videoId}";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: "No transcript available" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            text: "Hello world",
            start: 2,
            duration: 3,
          },
        ],
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const transcript = await getYoutubeTranscript(
      "https://www.youtube.com/watch?v=abc123def45",
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://youtube-transcript-api.example.com/transcript?video_id=abc123def45",
      expect.objectContaining({
        headers: {
          "x-rapidapi-host": "youtube-transcript-api.example.com",
          "x-rapidapi-key": "rapidapi-key",
        },
      }),
    );
    expect(transcript.videoInfo.language).toBe("unknown");
    expect(transcript.subtitles).toEqual([
      {
        start: 2,
        end: 5,
        text: "Hello world",
      },
    ]);
  });

  it("reports login-required videos clearly", async () => {
    process.env.SUPADATA_API_KEY = "supadata-key";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: "login required" }),
      } as Response),
    );

    await expect(
      getYoutubeTranscript("https://www.youtube.com/watch?v=abc123def45"),
    ).rejects.toMatchObject({
      status: 403,
      message:
        "This video requires YouTube login or verification, so subtitles cannot be fetched anonymously.",
    });
  });
});
