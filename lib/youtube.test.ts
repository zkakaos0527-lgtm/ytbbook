import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock, getBasicInfoMock, getTranscriptMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  getBasicInfoMock: vi.fn(),
  getTranscriptMock: vi.fn(),
}));

vi.mock("youtubei.js", () => ({
  Innertube: {
    create: createMock,
  },
}));

import {
  extractYoutubeVideoId,
  getYoutubeTranscript,
  toTranscriptApiError,
} from "./youtube";

beforeEach(() => {
  vi.clearAllMocks();
  createMock.mockResolvedValue({
    getBasicInfo: getBasicInfoMock,
  });
  getBasicInfoMock.mockResolvedValue({
    basic_info: {
      title: "Video",
      author: "Unknown",
      duration: 90,
    },
    playability_status: {
      status: "OK",
    },
    getTranscript: getTranscriptMock,
  });
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
    getTranscriptMock.mockResolvedValueOnce({
      selectedLanguage: "es",
      transcript: {
        content: {
          body: {
            initial_segments: [
              {
                type: "TranscriptSegment",
                start_ms: "0",
                end_ms: "1500",
                snippet: {
                  text: "Hola mundo",
                },
              },
            ],
          },
        },
      },
    });

    const transcript = await getYoutubeTranscript(
      "https://www.youtube.com/watch?v=abc123def45",
    );

    expect(createMock).toHaveBeenCalledWith({ retrieve_player: false });
    expect(getBasicInfoMock).toHaveBeenCalledWith("abc123def45", { client: "WEB" });
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
    getBasicInfoMock.mockResolvedValueOnce({
      basic_info: {
        title: "Video",
        author: "Unknown",
        duration: 90,
      },
      playability_status: {
        status: "LOGIN_REQUIRED",
      },
      getTranscript: getTranscriptMock,
    });

    await expect(
      getYoutubeTranscript("https://www.youtube.com/watch?v=abc123def45"),
    ).rejects.toMatchObject({
      status: 403,
      message:
        "This video requires YouTube login or verification, so subtitles cannot be fetched anonymously.",
    });

    expect(getTranscriptMock).not.toHaveBeenCalled();
  });
});
