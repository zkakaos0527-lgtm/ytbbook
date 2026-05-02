import { NextResponse } from "next/server";

import { ClaudeApiError, summarizeWithClaude } from "@/lib/claude";
import type { TimelineSummaryApiResponse, TranslationInputSubtitle } from "@/types";

export const runtime = "nodejs";

function isValidSubtitleInput(subtitle: unknown): subtitle is TranslationInputSubtitle {
  return (
    typeof subtitle === "object" &&
    subtitle !== null &&
    "id" in subtitle &&
    "text" in subtitle &&
    typeof (subtitle as TranslationInputSubtitle).id === "string" &&
    typeof (subtitle as TranslationInputSubtitle).text === "string"
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      subtitles?: unknown;
      durationSeconds?: unknown;
    };

    if (!Array.isArray(body.subtitles) || body.subtitles.length === 0) {
      return NextResponse.json(
        { error: "A non-empty subtitles array is required." },
        { status: 400 },
      );
    }

    if (!body.subtitles.every(isValidSubtitleInput)) {
      return NextResponse.json(
        { error: "Each subtitle must include string id and text fields." },
        { status: 400 },
      );
    }

    const durationSeconds =
      typeof body.durationSeconds === "number" ? body.durationSeconds : 0;

    const segments = await summarizeWithClaude(body.subtitles, durationSeconds);

    return NextResponse.json({ segments } satisfies TimelineSummaryApiResponse);
  } catch (error) {
    if (error instanceof ClaudeApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Unexpected error while generating summary." },
      { status: 500 },
    );
  }
}
