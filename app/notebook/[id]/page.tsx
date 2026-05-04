import { ExportPanel } from "@/components/ExportPanel";
import { SummaryPanel } from "@/components/SummaryPanel";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { VideoPlayer } from "@/components/VideoPlayer";
import { formatDuration } from "@/lib/format";
import { getNotebook } from "@/lib/supabase";
import { notFound } from "next/navigation";

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

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        padding: "28px 32px",
        maxWidth: 1400,
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "linear-gradient(135deg, var(--primary), var(--primary-dark))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 14,
            boxShadow: "0 4px 12px rgba(105,88,242,0.3)",
          }}
        >
          ▶
        </div>
        <span
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "var(--primary)",
            letterSpacing: "-0.04em",
          }}
        >
          notebook.
        </span>
      </div>

      {/* Two-column layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "380px 1fr",
          gap: 16,
          height: "calc(100vh - 120px)",
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
            title={notebook.videoTitle}
            thumbnailUrl={notebook.thumbnailUrl}
            youtubeUrl={notebook.youtubeUrl}
          />

          {/* Meta */}
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
              {notebook.videoTitle}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                📺 {notebook.channelName}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                ⏱ {formatDuration(notebook.durationSeconds)}
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
                {notebook.sourceLanguage.toUpperCase()} → {notebook.targetLanguage.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Summary / Export tabs */}
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
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  flex: 1,
                  padding: "10px 0",
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--primary)",
                  borderBottom: "2px solid var(--primary)",
                }}
              >
                AI 摘要
              </div>
              <div
                style={{
                  flex: 1,
                  padding: "10px 0",
                  textAlign: "center",
                  fontSize: 13,
                  color: "var(--text-3)",
                  borderBottom: "2px solid transparent",
                }}
              >
                导出
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
              <SummaryPanel timeline={[]} />
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", marginBottom: 10 }}>导出</p>
                <ExportPanel notebook={notebook} />
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <TranscriptPanel
          notebook={notebook}
          subtitles={notebook.subtitles}
          status="live"
        />
      </div>
    </main>
  );
}
