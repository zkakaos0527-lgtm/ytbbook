import { NextResponse } from "next/server";

import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { tags?: string[] };

    if (!Array.isArray(body.tags)) {
      return NextResponse.json(
        { error: "tags must be an array of strings." },
        { status: 400 },
      );
    }

    const db = getSupabaseClient();
    const { error } = await db
      .from("notebooks")
      .update({ tags: body.tags })
      .eq("id", id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update tags." },
      { status: 500 },
    );
  }
}