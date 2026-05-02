import { NextResponse } from "next/server";

import { getNotebook, listNotebooks, saveNotebook } from "@/lib/supabase";
import type { Notebook } from "@/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const notebooks = await listNotebooks();
    return NextResponse.json({ notebooks });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list notebooks." },
      { status: 500 },
    );
  }
}

function isNotebook(value: unknown): value is Notebook {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "youtubeUrl" in value &&
    "subtitles" in value &&
    Array.isArray((value as Notebook).subtitles)
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;

    if (!isNotebook(body)) {
      return NextResponse.json(
        { error: "Request body must be a valid Notebook object." },
        { status: 400 },
      );
    }

    await saveNotebook(body);

    const saved = await getNotebook(body.id);
    return NextResponse.json({ notebook: saved }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save notebook." },
      { status: 500 },
    );
  }
}
