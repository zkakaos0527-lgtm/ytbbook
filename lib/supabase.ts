import { createClient, SupabaseClient } from "@supabase/supabase-js";

import type { DashboardNotebookCard, Notebook, Subtitle } from "@/types";

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables.",
    );
  }

  client = createClient(url, key);
  return client;
}

// ── Row types (snake_case, matching DB columns) ──────────────────────────────

type NotebookRow = {
  id: string;
  youtube_url: string;
  video_title: string;
  channel_name: string;
  duration_seconds: number;
  thumbnail_url: string;
  source_language: string;
  target_language: string;
  summary: string;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

type SubtitleRow = {
  id: string;
  notebook_id: string;
  sequence: number;
  start_time: number;
  end_time: number;
  original_text: string;
  translated_text: string | null;
  user_note: string | null;
  created_at: string;
};

// ── Mappers ──────────────────────────────────────────────────────────────────

function rowToNotebook(row: NotebookRow, subtitleRows: SubtitleRow[]): Notebook {
  return {
    id: row.id,
    youtubeUrl: row.youtube_url,
    videoTitle: row.video_title,
    channelName: row.channel_name,
    durationSeconds: row.duration_seconds,
    thumbnailUrl: row.thumbnail_url,
    sourceLanguage: row.source_language,
    targetLanguage: row.target_language,
    summary: row.summary,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    subtitles: subtitleRows.map(rowToSubtitle),
  };
}

function rowToSubtitle(row: SubtitleRow): Subtitle {
  return {
    id: row.id,
    notebookId: row.notebook_id,
    sequence: row.sequence,
    startTime: row.start_time,
    endTime: row.end_time,
    originalText: row.original_text,
    translatedText: row.translated_text,
    userNote: row.user_note,
    createdAt: row.created_at,
  };
}

// ── DB helpers ───────────────────────────────────────────────────────────────

export async function saveNotebook(notebook: Notebook): Promise<void> {
  const db = getSupabaseClient();

  const { error: notebookError } = await db.from("notebooks").upsert({
    id: notebook.id,
    youtube_url: notebook.youtubeUrl,
    video_title: notebook.videoTitle,
    channel_name: notebook.channelName,
    duration_seconds: notebook.durationSeconds,
    thumbnail_url: notebook.thumbnailUrl,
    source_language: notebook.sourceLanguage,
    target_language: notebook.targetLanguage,
    summary: notebook.summary,
    tags: notebook.tags ?? [],
    created_at: notebook.createdAt,
    updated_at: notebook.updatedAt,
  });

  if (notebookError) throw new Error(notebookError.message);

  if (notebook.subtitles.length > 0) {
    const { error: subtitleError } = await db.from("subtitles").upsert(
      notebook.subtitles.map((s) => ({
        id: s.id,
        notebook_id: s.notebookId,
        sequence: s.sequence,
        start_time: s.startTime,
        end_time: s.endTime,
        original_text: s.originalText,
        translated_text: s.translatedText,
        user_note: s.userNote,
        created_at: s.createdAt,
      })),
    );

    if (subtitleError) throw new Error(subtitleError.message);
  }
}

export async function getNotebook(id: string): Promise<Notebook | null> {
  const db = getSupabaseClient();

  const { data: notebookRow, error: notebookError } = await db
    .from("notebooks")
    .select("*")
    .eq("id", id)
    .single<NotebookRow>();

  if (notebookError) {
    if (notebookError.code === "PGRST116") return null; // not found
    throw new Error(notebookError.message);
  }

  if (!notebookRow) return null;

  const { data: subtitleRows, error: subtitleError } = await db
    .from("subtitles")
    .select("*")
    .eq("notebook_id", id)
    .order("sequence", { ascending: true })
    .returns<SubtitleRow[]>();

  if (subtitleError) throw new Error(subtitleError.message);

  return rowToNotebook(notebookRow, subtitleRows ?? []);
}

export async function listNotebooks(): Promise<Notebook[]> {
  const db = getSupabaseClient();

  const { data: rows, error } = await db
    .from("notebooks")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<NotebookRow[]>();

  if (error) throw new Error(error.message);

  return (rows ?? []).map((row) => rowToNotebook(row, []));
}

export async function updateSubtitleNote(
  subtitleId: string,
  userNote: string | null,
): Promise<void> {
  const db = getSupabaseClient();

  const { error } = await db
    .from("subtitles")
    .update({ user_note: userNote || null })
    .eq("id", subtitleId);

  if (error) throw new Error(error.message);
}

type NotebookCardRow = NotebookRow & {
  subtitle_count: number;
  note_count: number;
};

export async function listNotebookCards(): Promise<DashboardNotebookCard[]> {
  const db = getSupabaseClient();

  // Fetch notebooks with per-notebook subtitle/note counts via a view-style query
  const { data: rows, error } = await db
    .from("notebooks")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<NotebookRow[]>();

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) return [];

  const notebookIds = rows.map((r) => r.id);

  const { data: subtitleRows, error: subError } = await db
    .from("subtitles")
    .select("notebook_id, user_note")
    .in("notebook_id", notebookIds)
    .returns<{ notebook_id: string; user_note: string | null }[]>();

  if (subError) throw new Error(subError.message);

  const countMap = new Map<string, { subtitleCount: number; noteCount: number }>();
  for (const id of notebookIds) {
    countMap.set(id, { subtitleCount: 0, noteCount: 0 });
  }
  for (const s of subtitleRows ?? []) {
    const entry = countMap.get(s.notebook_id);
    if (entry) {
      entry.subtitleCount += 1;
      if (s.user_note) entry.noteCount += 1;
    }
  }

  return rows.map((row) => {
    const counts = countMap.get(row.id) ?? { subtitleCount: 0, noteCount: 0 };
    return {
      id: row.id,
      videoTitle: row.video_title,
      channelName: row.channel_name,
      durationSeconds: row.duration_seconds,
      thumbnailUrl: row.thumbnail_url,
      subtitleCount: counts.subtitleCount,
      noteCount: counts.noteCount,
      createdAt: row.created_at,
      summary: row.summary ?? "",
      tags: row.tags ?? [],
    };
  });
}
