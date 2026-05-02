import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_TRANSLATION_SUBTITLES_PER_REQUEST } from "@/lib/translation";

const { translateWithClaudeMock } = vi.hoisted(() => ({
  translateWithClaudeMock: vi.fn(),
}));

vi.mock("@/lib/claude", () => ({
  translateWithClaude: translateWithClaudeMock,
  ClaudeApiError: class ClaudeApiError extends Error {
    status: number;

    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
}));

import { POST } from "./route";

describe("POST /api/translate", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when subtitles are missing", async () => {
    const request = new Request("http://localhost:3000/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("A non-empty subtitles array is required.");
  });

  it("returns 413 when a single translation request is too large", async () => {
    const request = new Request("http://localhost:3000/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subtitles: Array.from(
          { length: MAX_TRANSLATION_SUBTITLES_PER_REQUEST + 1 },
          (_, index) => ({
          id: `sub-${index + 1}`,
          text: `Sentence ${index + 1}`,
          }),
        ),
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(413);
    expect(payload.error).toContain(
      `at most ${MAX_TRANSLATION_SUBTITLES_PER_REQUEST} subtitles`,
    );
    expect(translateWithClaudeMock).not.toHaveBeenCalled();
  });

  it("returns translations when the service succeeds", async () => {
    translateWithClaudeMock.mockResolvedValueOnce([
      {
        id: "sub-1",
        translated_text: "你好，世界",
      },
    ]);

    const request = new Request("http://localhost:3000/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subtitles: [
          {
            id: "sub-1",
            text: "Hello, world",
          },
        ],
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.translations[0].translated_text).toBe("你好，世界");
  });
});
