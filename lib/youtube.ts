import { YoutubeTranscript } from "youtube-transcript";

export type TranscriptSubtitle = {
  start: number;
  end: number;
  text: string;
};

export type TranscriptVideoInfo = {
  id: string;
  title: string;
  channel: string;
  duration: number;
  language: string;
};

export type TranscriptResult = {
  subtitles: TranscriptSubtitle[];
  videoInfo: TranscriptVideoInfo;
};

export class TranscriptApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "TranscriptApiError";
    this.status = status;
  }
}

async function getYoutubePlayabilityStatus(videoId: string): Promise<string | null> {
  try {
    const response = await fetch(
      "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: "ANDROID",
              clientVersion: "20.10.38",
            },
          },
          videoId,
        }),
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      playabilityStatus?: { status?: string };
    };

    return payload.playabilityStatus?.status ?? null;
  } catch {
    return null;
  }
}

export function toTranscriptApiError(error: unknown): TranscriptApiError {
  if (error instanceof TranscriptApiError) {
    return error;
  }

  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "";

  if (
    message.includes("ECONNRESET") ||
    message.includes("ENOTFOUND") ||
    message.includes("ETIMEDOUT") ||
    message.includes("fetch failed") ||
    message.includes("Could not get transcripts")
  ) {
    return new TranscriptApiError(
      "Cannot reach YouTube. Please check your network or VPN connection.",
      503,
    );
  }

  if (message.includes("disabled") || message.includes("No transcripts")) {
    return new TranscriptApiError(
      "No subtitles were found for this video. The video may not have captions enabled.",
      422,
    );
  }

  return new TranscriptApiError(
    "Unable to retrieve subtitles for this video right now.",
    502,
  );
}

export function extractYoutubeVideoId(input: string): string | null {
  if (!input) return null;

  const trimmed = input.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.replace(/^www\./, "");

    if (hostname === "youtu.be") {
      const shortId = url.pathname.split("/").filter(Boolean)[0];
      return shortId && /^[a-zA-Z0-9_-]{11}$/.test(shortId) ? shortId : null;
    }

    if (
      hostname === "youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname === "music.youtube.com"
    ) {
      const watchId = url.searchParams.get("v");
      if (watchId && /^[a-zA-Z0-9_-]{11}$/.test(watchId)) {
        return watchId;
      }

      const pathParts = url.pathname.split("/").filter(Boolean);
      const candidate = pathParts.at(-1);

      if (
        (pathParts[0] === "shorts" || pathParts[0] === "embed") &&
        candidate &&
        /^[a-zA-Z0-9_-]{11}$/.test(candidate)
      ) {
        return candidate;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function cleanText(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export async function getYoutubeTranscript(youtubeUrl: string): Promise<TranscriptResult> {
  const videoId = extractYoutubeVideoId(youtubeUrl);

  if (!videoId) {
    throw new TranscriptApiError("Invalid YouTube URL.", 400);
  }

  try {
    const rawTranscript = await YoutubeTranscript.fetchTranscript(videoId);

    if (!rawTranscript || rawTranscript.length === 0) {
      throw new TranscriptApiError(
        "No subtitles were found for this video.",
        422,
      );
    }

    const subtitles: TranscriptSubtitle[] = rawTranscript.map((item) => ({
      start: Number(item.offset.toFixed(3)),
      end: Number((item.offset + item.duration).toFixed(3)),
      text: cleanText(item.text),
    }));

    return {
      subtitles,
      videoInfo: {
        id: videoId,
        title: "Video",
        channel: "Unknown",
        duration: subtitles.at(-1)?.end ?? 0,
        language: rawTranscript[0]?.lang ?? "unknown",
      },
    };
  } catch (error) {
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : "";

    if (message.includes("disabled") || message.includes("No transcripts")) {
      const playabilityStatus = await getYoutubePlayabilityStatus(videoId);
      if (playabilityStatus === "LOGIN_REQUIRED") {
        throw new TranscriptApiError(
          "This video requires YouTube login or verification, so subtitles cannot be fetched anonymously.",
          403,
        );
      }
    }

    throw toTranscriptApiError(error);
  }
}
