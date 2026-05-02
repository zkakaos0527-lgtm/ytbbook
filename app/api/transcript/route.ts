import { NextResponse } from "next/server";

import { getYoutubeTranscript, TranscriptApiError, extractYoutubeVideoId } from "@/lib/youtube";

export const runtime = "nodejs";

async function fetchVideoMeta(videoId: string): Promise<{ title: string; channel: string }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return { title: "Untitled Video", channel: "Unknown" };
    const data = (await res.json()) as { title?: string; author_name?: string };
    return {
      title: data.title ?? "Untitled Video",
      channel: data.author_name ?? "Unknown",
    };
  } catch {
    return { title: "Untitled Video", channel: "Unknown" };
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { youtubeUrl?: unknown };

    if (typeof body.youtubeUrl !== "string" || !body.youtubeUrl.trim()) {
      return NextResponse.json(
        { error: "A valid youtubeUrl is required." },
        { status: 400 },
      );
    }

    const videoId = extractYoutubeVideoId(body.youtubeUrl);
    if (!videoId) {
      return NextResponse.json(
        { error: "Invalid YouTube URL." },
        { status: 400 },
      );
    }

    const [transcript, meta] = await Promise.all([
      getYoutubeTranscript(body.youtubeUrl),
      fetchVideoMeta(videoId),
    ]);

    return NextResponse.json({
      ...transcript,
      videoInfo: {
        ...transcript.videoInfo,
        title: meta.title !== "Untitled Video" ? meta.title : transcript.videoInfo.title,
        channel: meta.channel !== "Unknown" ? meta.channel : transcript.videoInfo.channel,
      },
    });
  } catch (error) {
    if (error instanceof TranscriptApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      "status" in error &&
      typeof (error as { status: unknown }).status === "number"
    ) {
      return NextResponse.json(
        { error: (error as { message: string }).message },
        { status: (error as { status: number }).status },
      );
    }

    return NextResponse.json(
      { error: "Unexpected error while extracting subtitles." },
      { status: 500 },
    );
  }
}
