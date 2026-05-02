"use client";

import { useState } from "react";

import { ExportPanel } from "@/components/ExportPanel";
import { SummaryPanel } from "@/components/SummaryPanel";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { URLInput } from "@/components/URLInput";
import { VideoPlayer } from "@/components/VideoPlayer";
import { applyTranslationsToNotebook } from "@/lib/claude";
import { formatDuration } from "@/lib/format";
import { notebookDetailMock } from "@/lib/mock-data";
import { buildTranslationRequestBatches } from "@/lib/translation";
import { createNotebookDraftFromTranscript } from "@/lib/workspace";
import type {
  Notebook,
  SummarizeApiResponse,
  TranscriptApiResponse,
  TranslateApiResponse,
  TranslationResult,
} from "@/types";

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

function isSummarizeApiResponse(
  payload: SummarizeApiResponse | { error?: string },
): payload is SummarizeApiResponse {
  return "summary" in payload;
}

export function NotebookWorkspace() {
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [loadingPhase, setLoadingPhase] = useState<"idle" | "transcript" | "translation" | "summarizing">("idle");
  const [translationProgress, setTranslationProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "export">("summary");

  const activeNotebook = notebook ?? notebookDetailMock;
  const isLoading = loadingPhase !== "idle";

  async function handleSubmit(nextUrl: string) {
    setYoutubeUrl(nextUrl);
    setLoadingPhase("transcript");
    setTranslationProgress(null);
    setError(null);

    try {
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

      const draft = createNotebookDraftFromTranscript({
        youtubeUrl: nextUrl,
        transcript: transcriptPayload,
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
        setNotebook(applyTranslationsToNotebook(draft, translations));

        const translatedDraft = applyTranslationsToNotebook(draft, translations);

        // Step 5: summarize
        setLoadingPhase("summarizing");
        setTranslationProgress(null);
        try {
          const summarizeRes = await fetch("/api/summarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subtitles: draft.subtitles.map((s) => ({ id: s.id, text: s.originalText })),
            }),
          });

          const summarizePayload = (await summarizeRes.json()) as
            | SummarizeApiResponse
            | { error?: string };

          if (summarizeRes.ok && isSummarizeApiResponse(summarizePayload)) {
            setNotebook((prev) =>
              prev ? { ...prev, summary: summarizePayload.summary } : prev,
            );

            // Step 7: persist to Supabase (fire-and-forget, non-fatal)
            const notebookToSave = { ...translatedDraft, summary: summarizePayload.summary };
            fetch("/api/notebooks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(notebookToSave),
            }).catch(() => {});
          }
        } catch {
          // summary failure is non-fatal — leave summary empty
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

    // Persist note to Supabase if we have a real notebook (not mock)
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
      : loadingPhase === "translation" || loadingPhase === "summarizing"
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
          translationProgress
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
                {activeNotebook.sourceLanguage.toUpperCase()} → {activeNotebook.targetLanguage.toUpperCase()}
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
                  summary={activeNotebook.summary}
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
          onNoteChange={handleNoteChange}
        />
      </div>
    </div>
  );
}
