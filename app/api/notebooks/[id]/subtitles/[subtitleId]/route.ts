import { NextResponse } from "next/server";

import { updateSubtitleNote } from "@/lib/supabase";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string; subtitleId: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { subtitleId } = await params;
    const body = (await request.json()) as { userNote?: string | null };

    await updateSubtitleNote(subtitleId, body.userNote ?? null);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update note." },
      { status: 500 },
    );
  }
}
