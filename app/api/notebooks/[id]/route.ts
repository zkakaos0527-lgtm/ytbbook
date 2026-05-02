import { NextResponse } from "next/server";

import { getNotebook } from "@/lib/supabase";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const notebook = await getNotebook(id);

    if (!notebook) {
      return NextResponse.json({ error: "Notebook not found." }, { status: 404 });
    }

    return NextResponse.json({ notebook });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch notebook." },
      { status: 500 },
    );
  }
}
