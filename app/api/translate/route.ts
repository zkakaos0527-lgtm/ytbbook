import { NextResponse } from "next/server";

import { ClaudeApiError, translateWithClaude } from "@/lib/claude";
import type { TranslateApiResponse, TranslationInputSubtitle } from "@/types";

export const runtime = "nodejs";

function isValidSubtitleInput(
  subtitle: unknown,
): subtitle is TranslationInputSubtitle {
  return (
    typeof subtitle === "object" &&
    subtitle !== null &&
    "id" in subtitle &&
    "text" in subtitle &&
    typeof subtitle.id === "string" &&
    typeof subtitle.text === "string"
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      subtitles?: unknown;
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

    const translations = await translateWithClaude(body.subtitles);

    return NextResponse.json({
      translations,
    } satisfies TranslateApiResponse);
  } catch (error) {
    if (error instanceof ClaudeApiError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error: "Unexpected error while translating subtitles.",
      },
      { status: 500 },
    );
  }
}
