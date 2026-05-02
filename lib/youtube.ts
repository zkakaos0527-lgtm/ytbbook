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

type TranscriptProviderResult = {
  subtitles: TranscriptSubtitle[];
  language: string;
};

type TranscriptSegmentPayload = {
  text?: unknown;
  content?: unknown;
  subtitle?: unknown;
  start?: unknown;
  offset?: unknown;
  startTime?: unknown;
  start_time?: unknown;
  duration?: unknown;
  dur?: unknown;
  end?: unknown;
  endTime?: unknown;
  end_time?: unknown;
  lang?: unknown;
  language?: unknown;
};

function getErrorMessage(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: unknown }).message)
    : "";
}

export function toTranscriptApiError(error: unknown): TranscriptApiError {
  if (error instanceof TranscriptApiError) {
    return error;
  }

  const message = getErrorMessage(error);
  const lower = message.toLowerCase();

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

  if (
    lower.includes("no transcript") ||
    lower.includes("no subtitles") ||
    lower.includes("caption") ||
    lower.includes("not available")
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

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function getPayloadSegments(payload: unknown): TranscriptSegmentPayload[] {
  if (Array.isArray(payload)) {
    return payload as TranscriptSegmentPayload[];
  }

  if (typeof payload !== "object" || payload === null) {
    return [];
  }

  const container = payload as {
    content?: unknown;
    transcript?: unknown;
    subtitles?: unknown;
    data?: unknown;
  };

  const candidates = [
    container.content,
    container.transcript,
    container.subtitles,
    container.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as TranscriptSegmentPayload[];
    }
  }

  return [];
}

function getPayloadLanguage(payload: unknown, segments: TranscriptSegmentPayload[]): string {
  if (typeof payload === "object" && payload !== null) {
    const source = payload as { lang?: unknown; language?: unknown };
    const language = asText(source.lang) || asText(source.language);
    if (language) {
      return language;
    }
  }

  return asText(segments[0]?.lang) || asText(segments[0]?.language) || "unknown";
}

function normalizeTranscriptPayload(payload: unknown): TranscriptProviderResult {
  const segments = getPayloadSegments(payload);
  const subtitles = segments
    .map((segment) => {
      const text =
        asText(segment.text) ||
        asText(segment.content) ||
        asText(segment.subtitle);
      const start =
        asNumber(segment.start) ??
        asNumber(segment.offset) ??
        asNumber(segment.startTime) ??
        asNumber(segment.start_time);
      const duration = asNumber(segment.duration) ?? asNumber(segment.dur);
      const end =
        asNumber(segment.end) ??
        asNumber(segment.endTime) ??
        asNumber(segment.end_time) ??
        (start !== null && duration !== null ? start + duration : null);

      if (!text || start === null || end === null) {
        return null;
      }

      return {
        start: Number(start.toFixed(3)),
        end: Number(end.toFixed(3)),
        text,
      };
    })
    .filter((subtitle): subtitle is TranscriptSubtitle => subtitle !== null);

  if (subtitles.length === 0) {
    throw new TranscriptApiError(
      "No subtitles were found for this video. The video may not have captions enabled.",
      422,
    );
  }

  return {
    subtitles,
    language: getPayloadLanguage(payload, segments),
  };
}

async function readProviderPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function providerErrorFromResponse(response: Response, payload: unknown): TranscriptApiError {
  const payloadText = JSON.stringify(payload ?? {});
  const lower = payloadText.toLowerCase();

  if (response.status === 401 || response.status === 403 || lower.includes("login")) {
    return new TranscriptApiError(
      "This video requires YouTube login or verification, so subtitles cannot be fetched anonymously.",
      403,
    );
  }

  if (response.status === 404 || lower.includes("no transcript") || lower.includes("not available")) {
    return new TranscriptApiError(
      "No subtitles were found for this video. The video may not have captions enabled.",
      422,
    );
  }

  if (response.status === 429) {
    return new TranscriptApiError(
      "Transcript provider quota was reached. Please try another provider or wait for the quota to reset.",
      503,
    );
  }

  return new TranscriptApiError(
    "Unable to retrieve subtitles for this video right now.",
    502,
  );
}

async function fetchSupadataTranscript(youtubeUrl: string): Promise<TranscriptProviderResult | null> {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) {
    return null;
  }

  const params = new URLSearchParams({
    url: youtubeUrl,
    mode: "native",
    text: "false",
  });
  const response = await fetch(`https://api.supadata.ai/v1/transcript?${params}`, {
    headers: {
      "x-api-key": apiKey,
    },
    signal: AbortSignal.timeout(15000),
  });
  const payload = await readProviderPayload(response);

  if (!response.ok) {
    throw providerErrorFromResponse(response, payload);
  }

  return normalizeTranscriptPayload(payload);
}

function buildRapidApiUrl(videoId: string, youtubeUrl: string): string | null {
  const host = process.env.RAPIDAPI_HOST;
  if (!process.env.RAPIDAPI_KEY || !host) {
    return null;
  }

  const template =
    process.env.RAPIDAPI_TRANSCRIPT_URL ??
    `https://${host}/transcript?video_id={videoId}`;

  return template
    .replaceAll("{videoId}", encodeURIComponent(videoId))
    .replaceAll("{youtubeUrl}", encodeURIComponent(youtubeUrl));
}

async function fetchRapidApiTranscript(
  videoId: string,
  youtubeUrl: string,
): Promise<TranscriptProviderResult | null> {
  const apiKey = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_HOST;
  const url = buildRapidApiUrl(videoId, youtubeUrl);

  if (!apiKey || !host || !url) {
    return null;
  }

  const response = await fetch(url, {
    headers: {
      "x-rapidapi-host": host,
      "x-rapidapi-key": apiKey,
    },
    signal: AbortSignal.timeout(15000),
  });
  const payload = await readProviderPayload(response);

  if (!response.ok) {
    throw providerErrorFromResponse(response, payload);
  }

  return normalizeTranscriptPayload(payload);
}

export async function getYoutubeTranscript(youtubeUrl: string): Promise<TranscriptResult> {
  const videoId = extractYoutubeVideoId(youtubeUrl);

  if (!videoId) {
    throw new TranscriptApiError("Invalid YouTube URL.", 400);
  }

  const providers = [
    () => fetchSupadataTranscript(youtubeUrl),
    () => fetchRapidApiTranscript(videoId, youtubeUrl),
  ];
  let lastError: TranscriptApiError | null = null;
  let configuredProviderCount = 0;

  for (const fetchProvider of providers) {
    try {
      const result = await fetchProvider();
      if (!result) {
        continue;
      }

      configuredProviderCount += 1;
      return {
        subtitles: result.subtitles,
        videoInfo: {
          id: videoId,
          title: "Video",
          channel: "Unknown",
          duration: result.subtitles.at(-1)?.end ?? 0,
          language: result.language,
        },
      };
    } catch (error) {
      const normalized = toTranscriptApiError(error);
      lastError = normalized;
      configuredProviderCount += 1;

      if (normalized.status === 400 || normalized.status === 403) {
        throw normalized;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  if (configuredProviderCount === 0) {
    throw new TranscriptApiError(
      "No transcript provider is configured. Add SUPADATA_API_KEY or RapidAPI transcript credentials.",
      500,
    );
  }

  throw new TranscriptApiError(
    "No subtitles were found for this video. The video may not have captions enabled.",
    422,
  );
}
