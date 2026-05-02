import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const { getYoutubeTranscriptMock } = vi.hoisted(() => ({
  getYoutubeTranscriptMock: vi.fn(),
}));

vi.mock("@/lib/youtube", () => ({
  getYoutubeTranscript: getYoutubeTranscriptMock,
  extractYoutubeVideoId: (url: string) => {
    const match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  },
  TranscriptApiError: class TranscriptApiError extends Error {
    status: number;

    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
}));

describe("POST /api/transcript", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when youtubeUrl is missing", async () => {
    const request = new Request("http://localhost:3000/api/transcript", {
      method: "POST",
      body: JSON.stringify({}),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("A valid youtubeUrl is required.");
  });

  it("returns transcript data when the service succeeds", async () => {
    getYoutubeTranscriptMock.mockResolvedValueOnce({
      subtitles: [
        {
          start: 0,
          end: 5,
          text: "Hello world",
        },
      ],
      videoInfo: {
        id: "abc123def45",
        title: "Test video",
        channel: "Test channel",
        duration: 120,
        language: "en",
      },
    });

    const request = new Request("http://localhost:3000/api/transcript", {
      method: "POST",
      body: JSON.stringify({
        youtubeUrl: "https://www.youtube.com/watch?v=abc123def45",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.videoInfo.title).toBe("Test video");
    expect(payload.subtitles).toHaveLength(1);
  });

  it("returns the service status for expected transcript errors", async () => {
    getYoutubeTranscriptMock.mockRejectedValueOnce({
      message: "No subtitles were found for this video.",
      status: 422,
    });

    const request = new Request("http://localhost:3000/api/transcript", {
      method: "POST",
      body: JSON.stringify({
        youtubeUrl: "https://www.youtube.com/watch?v=abc123def45",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error).toBe("No subtitles were found for this video.");
  });
});
