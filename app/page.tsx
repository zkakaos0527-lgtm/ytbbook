import Link from "next/link";

import { NotebookWorkspace } from "@/components/NotebookWorkspace";
import { listNotebookCards } from "@/lib/supabase";
import { formatNotebookDate } from "@/lib/format";
import type { DashboardNotebookCard } from "@/types";

export default async function Home() {
  let cards: DashboardNotebookCard[] = [];
  let error = false;

  try {
    cards = await listNotebookCards();
  } catch {
    error = true;
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
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
      </div>

      {/* Workspace */}
      <NotebookWorkspace />

      {/* Dashboard */}
      <section style={{ marginTop: 32 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <h2
            style={{ fontSize: 17, fontWeight: 700, color: "var(--text-1)" }}
          >
            最近笔记
          </h2>
        </div>

        {error ? (
          <div
            style={{
              padding: "24px",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              textAlign: "center",
              color: "var(--text-3)",
              fontSize: 14,
            }}
          >
            无法加载笔记数据，请检查网络连接
          </div>
        ) : cards.length === 0 ? (
          <div
            style={{
              padding: "40px 24px",
              background: "var(--bg-card)",
              border: "1px dashed var(--border)",
              borderRadius: 12,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-1)", marginBottom: 6 }}>
              开始你的第一份视频笔记
            </p>
            <p style={{ fontSize: 13, color: "var(--text-3)" }}>
              在上方输入 YouTube 链接，即可生成带翻译和摘要的学习笔记
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
            }}
          >
            {cards.map((nb) => (
              <Link
                key={nb.id}
                href={`/notebook/${nb.id}`}
                style={{ textDecoration: "none" }}
              >
                <div
                  className="card-hover"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-light)",
                    borderRadius: 12,
                    overflow: "hidden",
                    boxShadow: "var(--shadow-sm)",
                    cursor: "pointer",
                  }}
                >
                  {/* Card top: gradient bg */}
                  <div
                    style={{
                      height: 100,
                      background:
                        "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", gap: 6 }}>
                      <span
                        style={{
                          padding: "3px 8px",
                          background: "rgba(255,255,255,0.2)",
                          borderRadius: 20,
                          fontSize: 11,
                          color: "#fff",
                        }}
                      >
                        📝 {nb.noteCount} 笔记
                      </span>
                      <span
                        style={{
                          padding: "3px 8px",
                          background: "rgba(255,255,255,0.2)",
                          borderRadius: 20,
                          fontSize: 11,
                          color: "#fff",
                        }}
                      >
                        💬 {nb.subtitleCount} 条
                      </span>
                    </div>
                    <div>
                      <p
                        style={{
                          fontSize: 9,
                          color: "rgba(255,255,255,0.7)",
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          marginBottom: 3,
                        }}
                      >
                        NOTEBOOK
                      </p>
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#fff",
                          lineHeight: 1.3,
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {nb.videoTitle}
                      </p>
                    </div>
                  </div>

                  {/* Card bottom */}
                  <div
                    style={{
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                      {nb.channelName}
                    </span>
                    <span
                      className="font-mono"
                      style={{ fontSize: 11, color: "var(--text-4)" }}
                    >
                      {formatNotebookDate(nb.createdAt)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
