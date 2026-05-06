"use client";

import { useState } from "react";

import { exportAsMarkdown, exportForNotebookLM } from "@/lib/export";
import type { Notebook } from "@/types";

type ExportPanelProps = {
  notebook: Notebook;
};

type CopyState = "idle" | "copied" | "error";

function useCopyButton() {
  const [state, setState] = useState<CopyState>("idle");

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  }

  return { state, copy };
}

export function ExportPanel({ notebook }: ExportPanelProps) {
  const markdown = useCopyButton();
  const notebooklm = useCopyButton();

  const noteCount = notebook.subtitles.filter((s) => s.userNote).length;
  const subtitleCount = notebook.subtitles.length;

  function labelFor(state: CopyState, idle: string) {
    if (state === "copied") return "✅ 已复制";
    if (state === "error") return "复制失败";
    return idle;
  }

  function colorFor(state: CopyState) {
    if (state === "copied") return "var(--green)";
    if (state === "error") return "#c0392b";
    return "var(--text-4)";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Stats */}
      <div
        style={{
          display: "flex",
          gap: 12,
          padding: "8px 12px",
          background: "var(--primary-light)",
          borderRadius: 8,
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 12, color: "var(--text-2)" }}>
          字幕 <strong style={{ color: "var(--primary)" }}>{subtitleCount}</strong> 条
        </span>
        <span style={{ fontSize: 12, color: "var(--text-2)" }}>
          笔记 <strong style={{ color: "var(--orange)" }}>{noteCount}</strong> 条
        </span>
      </div>

      {/* Markdown copy */}
      <button
        type="button"
        onClick={() => markdown.copy(exportAsMarkdown(notebook))}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: "var(--bg-input)",
          border: `1px solid ${markdown.state === "copied" ? "var(--green)" : "var(--border)"}`,
          borderRadius: 8,
          textAlign: "left",
          cursor: "pointer",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          if (markdown.state === "idle") {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--primary)";
            (e.currentTarget as HTMLButtonElement).style.background = "var(--primary-lighter)";
          }
        }}
        onMouseLeave={(e) => {
          if (markdown.state === "idle") {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-input)";
          }
        }}
      >
        <span style={{ fontSize: 16 }}>📋</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>
            Markdown 复制
          </p>
          <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>
            含摘要、双语字幕、批注
          </p>
        </div>
        <span
          className="font-mono"
          style={{ fontSize: 11, color: colorFor(markdown.state), transition: "color 0.2s" }}
        >
          {labelFor(markdown.state, "复制")}
        </span>
      </button>

      {/* NotebookLM copy */}
      <button
        type="button"
        onClick={() => notebooklm.copy(exportForNotebookLM(notebook))}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: "var(--bg-input)",
          border: `1px solid ${notebooklm.state === "copied" ? "var(--green)" : "var(--border)"}`,
          borderRadius: 8,
          textAlign: "left",
          cursor: "pointer",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          if (notebooklm.state === "idle") {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--primary)";
            (e.currentTarget as HTMLButtonElement).style.background = "var(--primary-lighter)";
          }
        }}
        onMouseLeave={(e) => {
          if (notebooklm.state === "idle") {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-input)";
          }
        }}
      >
        <span style={{ fontSize: 16 }}>📄</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>
            NotebookLM 文档
          </p>
          <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>
            纯文本格式，适合上传到 NotebookLM
          </p>
        </div>
        <span
          className="font-mono"
          style={{ fontSize: 11, color: colorFor(notebooklm.state), transition: "color 0.2s" }}
        >
          {labelFor(notebooklm.state, "复制")}
        </span>
      </button>

      {/* PDF — coming soon */}
      <button
        type="button"
        disabled
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: "var(--bg-input)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          textAlign: "left",
          cursor: "not-allowed",
          opacity: 0.5,
        }}
      >
        <span style={{ fontSize: 16 }}>📑</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>
            PDF 导出
          </p>
          <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>
            导出为 PDF 文件
          </p>
        </div>
        <span className="font-mono" style={{
            fontSize: 11,
            color: "var(--text-4)",
            padding: "2px 8px",
            background: "var(--bg-inner)",
            border: "1px solid var(--border-light)",
            borderRadius: 4,
          }}>
          Soon
        </span>
      </button>

      {/* Notion — coming soon */}
      <button
        type="button"
        disabled
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: "var(--bg-input)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          textAlign: "left",
          cursor: "not-allowed",
          opacity: 0.5,
        }}
      >
        <span style={{ fontSize: 16 }}>🔗</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", margin: 0 }}>
            Notion 同步
          </p>
          <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>
            同步到 Notion 页面
          </p>
        </div>
        <span className="font-mono" style={{
            fontSize: 11,
            color: "var(--text-4)",
            padding: "2px 8px",
            background: "var(--bg-inner)",
            border: "1px solid var(--border-light)",
            borderRadius: 4,
          }}>
          Soon
        </span>
      </button>
    </div>
  );
}
