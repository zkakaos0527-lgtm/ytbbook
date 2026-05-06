import Link from "next/link";
import { ExportPanel } from "@/components/ExportPanel";
import { SummaryPanel } from "@/components/SummaryPanel";
import { TagEditor } from "@/components/TagEditor";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { formatDuration } from "@/lib/format";
import { getNotebook } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { extractYoutubeVideoId } from "@/lib/youtube";

type NotebookDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function NotebookDetailPage({
  params,
}: NotebookDetailPageProps) {
  const { id } = await params;
  const notebook = await getNotebook(id);

  if (!notebook) {
    notFound();
  }

  const videoId = extractYoutubeVideoId(notebook.youtubeUrl);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        padding: "0",
        margin: "0",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Left panel */}
      <div
        style={{
          position: "fixed",
          left: 56,
          top: 0,
          bottom: 0,
          width: 380,
          background: "var(--bg-inner)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRight: "1px solid var(--border-light)",
          zIndex: 50,
        }}
      >
        {/* Nav bar */}
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--border-light)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--text-2)",
              textDecoration: "none",
              transition: "all 0.15s",
            }}
          >
            ← 返回
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
            <span style={{ fontSize: 12, color: "var(--text-4)" }}>笔记 /</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-2)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {notebook.videoTitle}
            </span>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {/* Video thumbnail with play overlay */}
          <div
            style={{
              position: "relative",
              borderRadius: 12,
              overflow: "hidden",
              aspectRatio: "16/10",
              background: "linear-gradient(135deg, #e8edf4, #dce3ed)",
              marginBottom: 16,
            }}
          >
            {notebook.thumbnailUrl ? (
              <img
                src={notebook.thumbnailUrl}
                alt={notebook.videoTitle}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : videoId ? (
              <img
                src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                alt={notebook.videoTitle}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : null}
            {/* Dark overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {videoId ? (
                <a
                  href={`https://www.youtube.com/watch?v=${videoId}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.95)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    color: "var(--text-1)",
                    textDecoration: "none",
                    transition: "transform 0.15s",
                  }}
                >
                  ▶
                </a>
              ) : (
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.9)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    color: "var(--text-1)",
                  }}
                >
                  ▶
                </div>
              )}
            </div>
            {/* Open original link */}
            {videoId && (
              <a
                href={`https://www.youtube.com/watch?v=${videoId}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  padding: "4px 10px",
                  background: "rgba(255,255,255,0.9)",
                  borderRadius: 20,
                  fontSize: 10,
                  color: "var(--text-2)",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                打开原视频 ↗
              </a>
            )}
          </div>

          {/* Video info */}
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 12,
              padding: "14px",
              marginBottom: 12,
              boxShadow: "var(--shadow-card)",
              border: "1px solid var(--border-light)",
            }}
          >
            <p
              className="font-serif"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-1)",
                lineHeight: 1.5,
                marginBottom: 10,
              }}
            >
              {notebook.videoTitle}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>📺 {notebook.channelName}</span>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>⏱ {formatDuration(notebook.durationSeconds)}</span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
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
                {notebook.sourceLanguage.toUpperCase()} → {notebook.targetLanguage.toUpperCase()}
              </span>
              <TagEditor notebookId={notebook.id} initialTags={notebook.tags ?? []} />
            </div>
          </div>

          {/* AI Summary tab */}
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "var(--shadow-card)",
              border: "1px solid var(--border-light)",
              flex: 1,
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid var(--border-light)",
                display: "flex",
                gap: 20,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--primary)",
                  borderBottom: "2px solid var(--primary)",
                  paddingBottom: 6,
                }}
              >
                AI 摘要
              </div>
              <div style={{ fontSize: 13, color: "var(--text-3)" }}>导出</div>
            </div>
            <div style={{ padding: "14px" }}>
              <SummaryPanel timeline={[]} />
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-light)" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", marginBottom: 10 }}>导出</p>
                <ExportPanel notebook={notebook} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel: transcript */}
      <div
        style={{
          marginLeft: 436,
          padding: "24px 32px",
          minHeight: "100vh",
        }}
      >
        <TranscriptPanel
          notebook={notebook}
          subtitles={notebook.subtitles}
          status="live"
        />
      </div>
    </main>
  );
}