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
    message.includes("fetch failed")
  ) {
    return new TranscriptApiError(
      "Cannot reach YouTube. Please check your network or VPN connection.",
      503,
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

type CaptionTrack = {
  baseUrl: string;
  languageCode: string;
  kind?: string;
};

async function fetchCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new TranscriptApiError("Failed to fetch YouTube page.", 502);
  }

  const html = await res.text();

  const match = html.match(/"captionTracks":(\[.*?\])/);
  if (!match) {
    if (html.includes('"LOGIN_REQUIRED"') || html.includes("signin")) {
      throw new TranscriptApiError(
        "This video requires YouTube login and cannot be accessed anonymously.",
        403,
      );
    }
    throw new TranscriptApiError(
      "No subtitles were found for this video. The video may not have captions enabled.",
      422,
    );
  }

  return JSON.parse(match[1]) as CaptionTrack[];
}

function pickBestTrack(tracks: CaptionTrack[]): CaptionTrack {
  // Prefer non-auto-generated English, then any English, then first track
  const manual = tracks.filter((t) => t.kind !== "asr");
  const enManual = manual.find((t) => t.languageCode.startsWith("en"));
  if (enManual) return enManual;
  const enAny = tracks.find((t) => t.languageCode.startsWith("en"));
  if (enAny) return enAny;
  return tracks[0];
}

function parseTimedText(xml: string): TranscriptSubtitle[] {
  const subtitles: TranscriptSubtitle[] = [];
  const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(xml)) !== null) {
    const start = parseFloat(m[1]);
    const dur = parseFloat(m[2]);
    const raw = m[3]
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (raw) {
      subtitles.push({
        start: Number(start.toFixed(3)),
        end: Number((start + dur).toFixed(3)),
        text: raw,
      });
    }
  }

  return subtitles;
}

export async function getYoutubeTranscript(youtubeUrl: string): Promise<TranscriptResult> {
  const videoId = extractYoutubeVideoId(youtubeUrl);

  if (!videoId) {
    throw new TranscriptApiError("Invalid YouTube URL.", 400);
  }

  try {
    const tracks = await fetchCaptionTracks(videoId);

    if (!tracks || tracks.length === 0) {
      throw new TranscriptApiError(
        "No subtitles were found for this video. The video may not have captions enabled.",
        422,
      );
    }

    const track = pickBestTrack(tracks);

    const xmlRes = await fetch(track.baseUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!xmlRes.ok) {
      throw new TranscriptApiError("Failed to download subtitle track.", 502);
    }

    const xml = await xmlRes.text();
    const subtitles = parseTimedText(xml);

    if (subtitles.length === 0) {
      throw new TranscriptApiError(
        "No subtitles were found for this video.",
        422,
      );
    }

    return {
      subtitles,
      videoInfo: {
        id: videoId,
        title: "Video",
        channel: "Unknown",
        duration: subtitles.at(-1)?.end ?? 0,
        language: track.languageCode,
      },
    };
  } catch (error) {
    if (error instanceof TranscriptApiError) {
      throw error;
    }
    throw toTranscriptApiError(error);
  }
}
