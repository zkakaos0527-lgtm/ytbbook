"use client";

import { useState } from "react";

import { ExportPanel } from "@/components/ExportPanel";
import { SummaryPanel } from "@/components/SummaryPanel";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { URLInput } from "@/components/URLInput";
import { VideoPlayer } from "@/components/VideoPlayer";
import { applyTranslationsToNotebook } from "@/lib/claude";
import { mapWithConcurrency, partitionResults, withTimeoutFallback } from "@/lib/async";
import { formatDuration } from "@/lib/format";
import { notebookDetailMock } from "@/lib/mock-data";
import { buildTranslationRequestBatches } from "@/lib/translation";
import { createNotebookDraftFromTranscript } from "@/lib/workspace";
import type {
  MergeApiResponse,
  Notebook,
  TimelineSummaryApiResponse,
  TopicSegment,
  TranscriptApiResponse,
  TranslateApiResponse,
  TranslationResult,
} from "@/types";

const MAX_CONCURRENT_TRANSLATION_REQUESTS = 5;

function isTranscriptApiResponse(
  payload: TranscriptApiResponse | { error?: string },
): payload is TranscriptApiResponse {
  return "subtitles" in payload && "videoInfo" in payload;
}

function isTranslateApiResponse(
  payload: TranslateApiResponse | { error?: string },
): payload is TranslateApiResponse {
  return "translations" in payload;
}

export function NotebookWorkspace() {
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [loadingPhase, setLoadingPhase] = useState<
    "idle" | "transcript" | "merging" | "translation" | "summarizing"
  >("idle");
  const [translationProgress, setTranslationProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [timeline, setTimeline] = useState<TopicSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "export">("summary");

  const activeNotebook = notebook ?? notebookDetailMock;
  const isLoading = loadingPhase !== "idle";

  async function fetchMergedSubtitles(
    subtitles: TranscriptApiResponse["subtitles"],
  ): Promise<TranscriptApiResponse["subtitles"]> {
    const mergeTask = fetch("/api/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subtitles }),
    })
      .then(async (mergeRes) => {
        if (!mergeRes.ok) {
          return subtitles;
        }

        const payload = (await mergeRes.json()) as MergeApiResponse;
        return Array.isArray(payload.subtitles) ? payload.subtitles : subtitles;
      })
      .catch(() => subtitles);

    return withTimeoutFallback(mergeTask, subtitles, 8000);
  }

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

      const mergedSubtitles = await fetchMergedSubtitles(
        transcriptPayload.subtitles,
      );

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

        const batchResults = await mapWithConcurrency(
          translationBatches,
          MAX_CONCURRENT_TRANSLATION_REQUESTS,
          async (batch) => {
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
          },
        );

        const { fulfilled: successfulBatches, rejected: failedBatches } =
          partitionResults(batchResults);
        const translations: TranslationResult[] = successfulBatches.flat();
        const translatedDraft = applyTranslationsToNotebook(draft, translations);
        setNotebook(translatedDraft);

        // Step 3: timeline summary (non-fatal)
        setLoadingPhase("summarizing");
        setTranslationProgress(null);

        try {
          const summarizeRes = await fetch("/api/summarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subtitles: draft.subtitles.map((s) => ({
                id: String(s.startTime),
                text: s.originalText,
              })),
              durationSeconds: draft.durationSeconds,
            }),
          });

          if (summarizeRes.ok) {
            const summarizePayload = (await summarizeRes.json()) as
              | TimelineSummaryApiResponse
              | { error?: string };

            if (
              "segments" in summarizePayload &&
              Array.isArray(summarizePayload.segments)
            ) {
              setTimeline(summarizePayload.segments);

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

  function handleNoteChange(subtitleId: string, note: string) {
    setNotebook((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        subtitles: prev.subtitles.map((s) =>
          s.id === subtitleId ? { ...s, userNote: note || null } : s,
        ),
      };
    });

    if (notebook) {
      fetch(`/api/notebooks/${notebook.id}/subtitles/${subtitleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userNote: note || null }),
      }).catch(() => {});
    }
  }

  const transcriptStatus =
    loadingPhase === "transcript"
      ? "loading"
      : loadingPhase === "merging" ||
          loadingPhase === "translation" ||
          loadingPhase === "summarizing"
        ? "translating"
        : notebook
          ? "live"
          : error
            ? "error"
            : "sample";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <URLInput
        initialValue={youtubeUrl}
        isLoading={isLoading}
        loadingPhase={loadingPhase}
        loadingDetail={
          loadingPhase === "merging"
            ? "整理字幕..."
            : translationProgress
              ? `${translationProgress.done} / ${translationProgress.total}`
              : undefined
        }
        error={error}
        onSubmit={handleSubmit}
      />

      {/* Two-column layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "380px 1fr",
          gap: 16,
          height: "calc(100vh - 220px)",
          minHeight: 500,
        }}
      >
        {/* Left panel */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            overflowY: "auto",
          }}
        >
          <VideoPlayer
            title={activeNotebook.videoTitle}
            thumbnailUrl={activeNotebook.thumbnailUrl}
            youtubeUrl={activeNotebook.youtubeUrl}
          />

          {/* Video meta */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "12px 14px",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <p
              className="font-serif"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-1)",
                lineHeight: 1.5,
                marginBottom: 8,
              }}
            >
              {activeNotebook.videoTitle}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                📺 {activeNotebook.channelName}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                ⏱ {formatDuration(activeNotebook.durationSeconds)}
              </span>
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  background: "var(--primary-light)",
                  color: "var(--primary)",
                  borderRadius: 10,
                  fontWeight: 600,
                }}
              >
                {activeNotebook.sourceLanguage.toUpperCase()} →{" "}
                {activeNotebook.targetLanguage.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Tab: Summary / Export */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "var(--shadow-sm)",
              flex: 1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Tab bar */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid var(--border)",
                flexShrink: 0,
              }}
            >
              {(["summary", "export"] as const).map((tab) => {
                const active = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      background: "transparent",
                      border: "none",
                      borderBottom: active
                        ? "2px solid var(--primary)"
                        : "2px solid transparent",
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      color: active ? "var(--primary)" : "var(--text-3)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {tab === "summary" ? "AI 摘要" : "导出"}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
              {activeTab === "summary" ? (
                <SummaryPanel
                  timeline={timeline}
                  isLoading={loadingPhase === "summarizing"}
                />
              ) : (
                <ExportPanel notebook={activeNotebook} />
              )}
            </div>
          </div>
        </div>

        {/* Right panel: transcript */}
        <TranscriptPanel
          notebook={activeNotebook}
          subtitles={activeNotebook.subtitles}
          status={transcriptStatus}
          translationProgress={translationProgress}
          onNoteChange={handleNoteChange}
        />
      </div>
    </div>
  );
}
