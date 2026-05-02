import { NextResponse } from "next/server";

import { ClaudeApiError, mergeSubtitlesWithLLM } from "@/lib/claude";
import type { MergeApiResponse } from "@/types";

export const runtime = "nodejs";

function isValidRawSubtitle(
  s: unknown,
): s is { start: number; end: number; text: string } {
  return (
    typeof s === "object" &&
    s !== null &&
    typeof (s as { start: unknown }).start === "number" &&
    typeof (s as { end: unknown }).end === "number" &&
    typeof (s as { text: unknown }).text === "string"
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { subtitles?: unknown };

    if (!Array.isArray(body.subtitles) || body.subtitles.length === 0) {
      return NextResponse.json(
        { error: "A non-empty subtitles array is required." },
        { status: 400 },
      );
    }

    if (!body.subtitles.every(isValidRawSubtitle)) {
      return NextResponse.json(
        { error: "Each subtitle must have numeric start/end and string text." },
        { status: 400 },
      );
    }

    const merged = await mergeSubtitlesWithLLM(body.subtitles);

    return NextResponse.json({ subtitles: merged } satisfies MergeApiResponse);
  } catch (error) {
    if (error instanceof ClaudeApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Unexpected error while merging subtitles." },
      { status: 500 },
    );
  }
}
