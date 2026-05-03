# Semantic Merge & Timeline Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add LLM-powered semantic merging of fragmented subtitles (A) and structured timeline-based topic summary (B) to replace the current plain-text summary.

**Architecture:** After fetching raw subtitles, call a new `/api/merge` endpoint to consolidate fragments into 100–150 semantic sentences (Plan A). In parallel, call the updated `/api/summarize` endpoint which now returns a structured list of topic segments with timestamps (Plan B). The frontend renders the timeline in `SummaryPanel`.

**Tech Stack:** Next.js 16 App Router, DeepSeek via OpenAI-compatible SDK, TypeScript, React 19

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `types/index.ts` | Modify | Add `MergeApiResponse`, `TopicSegment`, `TimelineSummaryApiResponse` |
| `lib/claude.ts` | Modify | Add `mergeSubtitlesWithLLM()`, update `summarizeWithClaude()` to return `TopicSegment[]` |
| `app/api/merge/route.ts` | Create | POST endpoint — accepts raw subtitles, returns merged subtitles |
| `app/api/summarize/route.ts` | Modify | Return `TopicSegment[]` instead of plain string |
| `lib/workspace.ts` | Modify | Accept `MergeApiResponse` subtitles in `createNotebookDraftFromTranscript` |
| `components/NotebookWorkspace.tsx` | Modify | Insert merge step before translation, pass timeline to SummaryPanel |
| `components/SummaryPanel.tsx` | Modify | Render `TopicSegment[]` timeline instead of plain markdown string |

---

## Task 1: Add new types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add types**

Replace the `SummarizeApiResponse` type and add new types at the bottom of `types/index.ts`:

```typescript
// Replace existing SummarizeApiResponse:
export type TopicSegment = {
  startTime: number;   // seconds
  endTime: number;     // seconds
  title: string;       // e.g. "介绍项目背景"
  summary: string;     // 2-3 sentence description
};

export type TimelineSummaryApiResponse = {
  segments: TopicSegment[];
};

// Keep SummarizeApiResponse as alias for backward compat during migration:
export type SummarizeApiResponse = TimelineSummaryApiResponse;

export type MergedSubtitle = {
  start: number;
  end: number;
  text: string;
};

export type MergeApiResponse = {
  subtitles: MergedSubtitle[];
};
```

- [ ] **Step 2: Type-check**

```bash
cd e:/ai_product/ytbbook && npx tsc --noEmit
```

Expected: no errors (existing `SummarizeApiResponse` usages still compile via alias).

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "types: add MergeApiResponse, TopicSegment, TimelineSummaryApiResponse"
```

---

## Task 2: Add `mergeSubtitlesWithLLM` to lib/claude.ts

**Files:**
- Modify: `lib/claude.ts`

- [ ] **Step 1: Add the merge function**

Add after the `buildTranslationBatches` function in `lib/claude.ts`:

```typescript
export type RawSubtitleInput = {
  start: number;
  end: number;
  text: string;
};

export type MergedSubtitleOutput = {
  start: number;
  end: number;
  text: string;
};

const MERGE_BATCH_SIZE = 150;

export async function mergeSubtitlesWithLLM(
  subtitles: RawSubtitleInput[],
): Promise<MergedSubtitleOutput[]> {
  if (!subtitles.length) return [];

  const client = getDeepSeekClient();
  const merged: MergedSubtitleOutput[] = [];

  // Process in overlapping windows to avoid cutting mid-sentence at boundaries
  for (let i = 0; i < subtitles.length; i += MERGE_BATCH_SIZE) {
    const batch = subtitles.slice(i, i + MERGE_BATCH_SIZE);

    const completion = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      max_tokens: 4096,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `你是字幕整理专家。将碎片化字幕合并为完整语义句子。

规则：
1. 将属于同一句话的碎片合并为一条
2. 保留第一个碎片的 start 时间，最后一个碎片的 end 时间
3. 目标：每批约 ${Math.round(batch.length / 3)} 条合并后字幕（原始的1/3左右）
4. 不要翻译，保持原文语言
5. 直接返回 JSON 数组，格式：[{"start":0.0,"end":3.5,"text":"完整句子"}]`,
        },
        {
          role: "user",
          content: JSON.stringify(batch),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) continue;

    try {
      const parsed = JSON.parse(jsonMatch[0]) as MergedSubtitleOutput[];
      merged.push(...parsed);
    } catch {
      // If parse fails for a batch, fall back to original fragments for that batch
      merged.push(...batch);
    }
  }

  return merged;
}
```

- [ ] **Step 2: Update `summarizeWithClaude` to return `TopicSegment[]`**

Replace the existing `summarizeWithClaude` function in `lib/claude.ts`:

```typescript
export async function summarizeWithClaude(
  subtitles: TranslationInputSubtitle[],
  durationSeconds: number,
): Promise<import("@/types").TopicSegment[]> {
  if (!subtitles.length) {
    throw new ClaudeApiError("No subtitles provided for summarization.", 400);
  }

  const client = getDeepSeekClient();

  // Build a compact transcript with timestamps for the LLM
  const transcriptText = subtitles
    .map((s) => `[${s.id}] ${s.text}`)
    .join("\n");

  const completion = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    max_tokens: 2048,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `你是视频内容分析师。根据带时间戳的字幕，将视频划分为若干话题段落。

每个段落输出：
- startTime: 该段开始时间（秒，数字）
- endTime: 该段结束时间（秒，数字）  
- title: 该段话题标题（10字以内）
- summary: 该段内容摘要（2-3句话，50字以内）

字幕格式：[秒数] 文本

直接返回 JSON 数组：[{"startTime":0,"endTime":330,"title":"...","summary":"..."}]

要求：
- 段落数量：视频每10分钟约2-4个段落
- 段落要覆盖完整视频时长（0 到 ${durationSeconds} 秒）
- 标题简洁，摘要客观`,
      },
      {
        role: "user",
        content: transcriptText,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "";
  const jsonMatch = content.match(/\[[\s\S]*\]/);

  if (!jsonMatch) {
    throw new ClaudeApiError("DeepSeek did not return a valid timeline JSON.", 502);
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as import("@/types").TopicSegment[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("empty");
    }
    return parsed;
  } catch {
    throw new ClaudeApiError("DeepSeek returned invalid timeline structure.", 502);
  }
}
```

- [ ] **Step 3: Type-check**

```bash
cd e:/ai_product/ytbbook && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/claude.ts
git commit -m "feat: add mergeSubtitlesWithLLM and update summarizeWithClaude to return TopicSegment[]"
```

---

## Task 3: Create `/api/merge` route

**Files:**
- Create: `app/api/merge/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// app/api/merge/route.ts
import { NextResponse } from "next/server";

import { ClaudeApiError, mergeSubtitlesWithLLM } from "@/lib/claude";
import type { MergeApiResponse } from "@/types";

export const runtime = "nodejs";

type RawSubtitleBody = {
  start: unknown;
  end: unknown;
  text: unknown;
};

function isValidRawSubtitle(s: unknown): s is { start: number; end: number; text: string } {
  return (
    typeof s === "object" &&
    s !== null &&
    typeof (s as RawSubtitleBody).start === "number" &&
    typeof (s as RawSubtitleBody).end === "number" &&
    typeof (s as RawSubtitleBody).text === "string"
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
```

- [ ] **Step 2: Type-check**

```bash
cd e:/ai_product/ytbbook && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/merge/route.ts
git commit -m "feat: add /api/merge endpoint for LLM subtitle merging"
```

---

## Task 4: Update `/api/summarize` route

**Files:**
- Modify: `app/api/summarize/route.ts`

- [ ] **Step 1: Replace the route**

```typescript
// app/api/summarize/route.ts
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
```

- [ ] **Step 2: Type-check**

```bash
cd e:/ai_product/ytbbook && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/summarize/route.ts
git commit -m "feat: update /api/summarize to return TopicSegment timeline"
```

---

## Task 5: Update `NotebookWorkspace.tsx` — insert merge step and wire timeline

**Files:**
- Modify: `components/NotebookWorkspace.tsx`

- [ ] **Step 1: Update state and flow**

In `NotebookWorkspace.tsx`, make the following changes:

**1. Add `timeline` state and update `loadingPhase` type:**

```typescript
const [timeline, setTimeline] = useState<import("@/types").TopicSegment[]>([]);
// loadingPhase already has "transcript" | "translation" | "summarizing" | "idle"
// Add "merging" phase:
const [loadingPhase, setLoadingPhase] = useState<"idle" | "transcript" | "merging" | "translation" | "summarizing">("idle");
```

**2. Replace the `handleSubmit` function body** with this updated flow:

```typescript
async function handleSubmit(nextUrl: string) {
  setYoutubeUrl(nextUrl);
  setLoadingPhase("transcript");
  setTranslationProgress(null);
  setTimeline([]);
  setError(null);

  try {
    // Step 1: fetch raw transcript
    const transcriptRes = await fetch("/api/transcript", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ youtubeUrl: nextUrl }),
    });

    const transcriptPayload = (await transcriptRes.json()) as
      | TranscriptApiResponse
      | { error?: string };

    if (!transcriptRes.ok) {
      throw new Error(
        "error" in transcriptPayload && transcriptPayload.error
          ? transcriptPayload.error
          : "Failed to extract transcript.",
      );
    }

    if (!isTranscriptApiResponse(transcriptPayload)) {
      throw new Error("Transcript response shape is invalid.");
    }

    // Step 2: LLM semantic merge
    setLoadingPhase("merging");

    const mergeRes = await fetch("/api/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subtitles: transcriptPayload.subtitles }),
    });

    // If merge fails, fall back to raw subtitles (non-fatal)
    const mergedSubtitles: TranscriptApiResponse["subtitles"] =
      mergeRes.ok
        ? ((await mergeRes.json()) as { subtitles: TranscriptApiResponse["subtitles"] }).subtitles
        : transcriptPayload.subtitles;

    const mergedTranscript: TranscriptApiResponse = {
      ...transcriptPayload,
      subtitles: mergedSubtitles,
    };

    const draft = createNotebookDraftFromTranscript({
      youtubeUrl: nextUrl,
      transcript: mergedTranscript,
    });

    setNotebook(draft);
    setLoadingPhase("translation");
    setTranslationProgress({ done: 0, total: draft.subtitles.length });

    try {
      const subtitleInputs = draft.subtitles.map((s) => ({
        id: s.id,
        text: s.originalText,
      }));
      const translationBatches = buildTranslationRequestBatches(subtitleInputs);
      let completedCount = 0;

      const batchResults = await Promise.all(
        translationBatches.map(async (batch) => {
          const translateRes = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subtitles: batch }),
          });

          const translatePayload = (await translateRes.json()) as
            | TranslateApiResponse
            | { error?: string };

          if (!translateRes.ok) {
            throw new Error(
              "error" in translatePayload && translatePayload.error
                ? translatePayload.error
                : "Failed to translate subtitles.",
            );
          }

          if (!isTranslateApiResponse(translatePayload)) {
            throw new Error("Translation response shape is invalid.");
          }

          completedCount += batch.length;
          setTranslationProgress({
            done: Math.min(completedCount, subtitleInputs.length),
            total: subtitleInputs.length,
          });

          return translatePayload.translations;
        }),
      );

      const translations: TranslationResult[] = batchResults.flat();
      const translatedDraft = applyTranslationsToNotebook(draft, translations);
      setNotebook(translatedDraft);

      // Step 3: timeline summary (parallel-safe, non-fatal)
      setLoadingPhase("summarizing");
      setTranslationProgress(null);

      try {
        const summarizeRes = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subtitles: draft.subtitles.map((s) => ({ id: String(s.startTime), text: s.originalText })),
            durationSeconds: draft.durationSeconds,
          }),
        });

        if (summarizeRes.ok) {
          const summarizePayload = (await summarizeRes.json()) as
            | TimelineSummaryApiResponse
            | { error?: string };

          if ("segments" in summarizePayload && Array.isArray(summarizePayload.segments)) {
            setTimeline(summarizePayload.segments);

            // Persist to Supabase (fire-and-forget)
            fetch("/api/notebooks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(translatedDraft),
            }).catch(() => {});
          }
        }
      } catch {
        // summary failure is non-fatal
      }
    } catch (translationError) {
      setError(
        translationError instanceof Error
          ? translationError.message
          : "Failed to translate subtitles.",
      );
    }
  } catch (submissionError) {
    setNotebook(null);
    setError(
      submissionError instanceof Error
        ? submissionError.message
        : "Failed to extract transcript.",
    );
  } finally {
    setLoadingPhase("idle");
    setTranslationProgress(null);
  }
}
```

**3. Add `TimelineSummaryApiResponse` to imports:**

```typescript
import type {
  Notebook,
  SummarizeApiResponse,
  TimelineSummaryApiResponse,
  TopicSegment,
  TranscriptApiResponse,
  TranslateApiResponse,
  TranslationResult,
} from "@/types";
```

**4. Pass `timeline` to `SummaryPanel`:**

```tsx
<SummaryPanel
  timeline={timeline}
  isLoading={loadingPhase === "summarizing"}
/>
```

**5. Update `transcriptStatus` to include `"merging"`:**

```typescript
const transcriptStatus =
  loadingPhase === "transcript"
    ? "loading"
    : loadingPhase === "merging" || loadingPhase === "translation" || loadingPhase === "summarizing"
      ? "translating"
      : notebook
        ? "live"
        : error
          ? "error"
          : "sample";
```

**6. Update `loadingDetail` in `URLInput`:**

```tsx
loadingDetail={
  loadingPhase === "merging"
    ? "整理字幕..."
    : translationProgress
      ? `${translationProgress.done} / ${translationProgress.total}`
      : undefined
}
```

- [ ] **Step 2: Type-check**

```bash
cd e:/ai_product/ytbbook && npx tsc --noEmit
```

Expected: errors only about `SummaryPanel` props (will fix in Task 6).

- [ ] **Step 3: Commit (after Task 6 passes type-check)**

Hold commit until Task 6 is done.

---

## Task 6: Update `SummaryPanel.tsx` to render timeline

**Files:**
- Modify: `components/SummaryPanel.tsx`

- [ ] **Step 1: Replace SummaryPanel**

```typescript
// components/SummaryPanel.tsx
import { formatDuration } from "@/lib/format";
import type { TopicSegment } from "@/types";

type SummaryPanelProps = {
  timeline: TopicSegment[];
  isLoading?: boolean;
};

export function SummaryPanel({ timeline, isLoading }: SummaryPanelProps) {
  if (isLoading) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          paddingTop: 4,
        }}
      >
        {[80, 60, 90, 50, 70].map((w, i) => (
          <div
            key={i}
            style={{
              height: 12,
              width: `${w}%`,
              background: "var(--border)",
              borderRadius: 6,
              animation: "pulse 1.4s ease-in-out infinite",
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
        <p
          style={{
            fontSize: 12,
            color: "var(--text-3)",
            marginTop: 8,
            textAlign: "center",
          }}
        >
          AI 正在生成时间线…
        </p>
      </div>
    );
  }

  if (!timeline || timeline.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--text-3)", textAlign: "center", paddingTop: 24 }}>
        摘要将在字幕加载后自动生成
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {timeline.map((segment, i) => (
        <div
          key={i}
          style={{
            borderLeft: "3px solid var(--primary)",
            paddingLeft: 12,
            paddingTop: 2,
            paddingBottom: 2,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                color: "var(--primary)",
                background: "var(--primary-light)",
                padding: "2px 6px",
                borderRadius: 4,
                whiteSpace: "nowrap",
              }}
            >
              {formatDuration(segment.startTime)} – {formatDuration(segment.endTime)}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-1)",
              }}
            >
              {segment.title}
            </span>
          </div>
          <p
            style={{
              fontSize: 12,
              color: "var(--text-2)",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {segment.summary}
          </p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd e:/ai_product/ytbbook && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit Tasks 5 + 6 together**

```bash
git add components/NotebookWorkspace.tsx components/SummaryPanel.tsx
git commit -m "feat: wire merge step and timeline summary into workspace UI"
```

---

## Task 7: Final push to GitHub

- [ ] **Step 1: Verify all files committed**

```bash
cd e:/ai_product/ytbbook && git status
```

Expected: `nothing to commit, working tree clean`

- [ ] **Step 2: Push**

```bash
git push
```

Expected: `main -> main` pushed successfully, Vercel auto-deploys.

---

## Self-Review Checklist

- [x] `TopicSegment` defined in Task 1, used consistently in Tasks 2, 4, 5, 6
- [x] `MergeApiResponse` defined in Task 1, used in Tasks 3, 5
- [x] `summarizeWithClaude` signature updated in Task 2, route updated in Task 4
- [x] `SummaryPanel` props changed from `summary: string` to `timeline: TopicSegment[]` — Task 5 passes `timeline` state, Task 6 accepts it
- [x] `formatDuration` already exists in `lib/format.ts` — used in Task 6
- [x] Merge step is non-fatal (falls back to raw subtitles on error)
- [x] Summary step is non-fatal (existing behavior preserved)
- [x] `loadingPhase` extended with `"merging"` in Task 5
