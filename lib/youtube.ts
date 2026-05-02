import { Innertube } from "youtubei.js";

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

  if (
    message.includes("disabled") ||
    message.includes("No transcripts") ||
    message.includes("Transcript not available") ||
    message.includes("no transcript") ||
    message.includes("No subtitles")
  ) {
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

export async function getYoutubeTranscript(youtubeUrl: string): Promise<TranscriptResult> {
  const videoId = extractYoutubeVideoId(youtubeUrl);

  if (!videoId) {
    throw new TranscriptApiError("Invalid YouTube URL.", 400);
  }

  try {
    const innertube = await Innertube.create({ retrieve_player: false });
    const info = await innertube.getBasicInfo(videoId, { client: "WEB" });

    if (info.playability_status?.status === "LOGIN_REQUIRED") {
      throw new TranscriptApiError(
        "This video requires YouTube login or verification, so subtitles cannot be fetched anonymously.",
        403,
      );
    }

    const transcriptInfo = await info.getTranscript();

    const segmentList = transcriptInfo.transcript.content?.body?.initial_segments;

    if (!segmentList || segmentList.length === 0) {
      throw new TranscriptApiError(
        "No subtitles were found for this video.",
        422,
      );
    }

    const subtitles: TranscriptSubtitle[] = segmentList
      .filter((seg) => seg.type === "TranscriptSegment")
      .map((seg) => {
        const start = Number((seg as { start_ms: string }).start_ms) / 1000;
        const end = Number((seg as { end_ms: string }).end_ms) / 1000;
        const snippet = (seg as { snippet: { text?: string } }).snippet;
        return {
          start: Number(start.toFixed(3)),
          end: Number(end.toFixed(3)),
          text: snippet.text ?? "",
        };
      });

    if (subtitles.length === 0) {
      throw new TranscriptApiError(
        "No subtitles were found for this video.",
        422,
      );
    }

    const language = transcriptInfo.selectedLanguage ?? "unknown";

    return {
      subtitles,
      videoInfo: {
        id: videoId,
        title: info.basic_info.title ?? "Video",
        channel: info.basic_info.author ?? info.basic_info.channel?.name ?? "Unknown",
        duration: info.basic_info.duration ?? subtitles.at(-1)?.end ?? 0,
        language,
      },
    };
  } catch (error) {
    if (error instanceof TranscriptApiError) {
      throw error;
    }
    throw toTranscriptApiError(error);
  }
}
