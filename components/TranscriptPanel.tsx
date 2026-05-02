"use client";

import { useState } from "react";

import { SubtitleItem } from "@/components/SubtitleItem";
import { Notebook, Subtitle } from "@/types";

type TranscriptPanelProps = {
  notebook: Notebook;
  subtitles: Subtitle[];
  status?: "sample" | "loading" | "translating" | "live" | "error";
  onNoteChange?: (id: string, note: string) => void;
};

export function TranscriptPanel({
  notebook,
  subtitles,
  status = "sample",
  onNoteChange,
}: TranscriptPanelProps) {
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState<"both" | "en" | "zh">("both");
  const [notesOnly, setNotesOnly] = useState(false);

  const noteCount = subtitles.filter((s) => s.userNote).length;

  const filtered = subtitles.filter((s) => {
    if (notesOnly && !s.userNote) return false;
    if (langFilter === "en" && !s.originalText.trim()) return false;
    if (langFilter === "zh" && !s.translatedText?.trim()) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    if (langFilter === "en") return s.originalText.toLowerCase().includes(q);
    if (langFilter === "zh") return (s.translatedText ?? "").toLowerCase().includes(q);
    return (
      s.originalText.toLowerCase().includes(q) ||
      (s.translatedText ?? "").toLowerCase().includes(q)
    );
  });

  function handleCopyAll() {
    const text = subtitles
      .map(
        (s) =>
          `[${s.startTime}s] ${s.originalText}\n${s.translatedText ?? ""}${s.userNote ? `\n📝 ${s.userNote}` : ""}`,
      )
      .join("\n\n");
    navigator.clipboard.writeText(text).catch(() => {});
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>
          字幕总览
        </span>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="font-mono" style={{ fontSize: 12, color: "var(--text-3)" }}>
            字幕 {subtitles.length}
          </span>
          <span className="font-mono" style={{ fontSize: 12, color: "var(--text-3)" }}>
            笔记 {noteCount}
          </span>
          {(status === "loading" || status === "translating") && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="spinner" />
              <span className="pulse-text" style={{ fontSize: 12, color: "var(--primary)" }}>
                {status === "loading" ? "提取字幕..." : "翻译中..."}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div
        style={{
          padding: "10px 20px",
          borderBottom: "1px solid var(--border-light)",
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索字幕..."
          style={{
            flex: 1,
            minWidth: 120,
            height: 30,
            padding: "0 10px",
            background: "var(--bg-input)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 12,
            color: "var(--text-1)",
            outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
        />

        {(["both", "en", "zh"] as const).map((lang) => {
          const active = langFilter === lang;
          const label = lang === "both" ? "全部" : lang === "en" ? "EN" : "中文";
          const activeBg = lang === "zh" ? "var(--green-bg)" : "var(--primary-light)";
          const activeColor = lang === "zh" ? "var(--green)" : "var(--primary)";
          return (
            <button
              key={lang}
              type="button"
              onClick={() => setLangFilter(lang)}
              style={{
                padding: "4px 12px",
                borderRadius: 20,
                border: `1px solid ${active ? "transparent" : "var(--border)"}`,
                background: active ? activeBg : "transparent",
                color: active ? activeColor : "var(--text-3)",
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {active && (
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: activeColor,
                    display: "inline-block",
                  }}
                />
              )}
              {label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setNotesOnly((v) => !v)}
          style={{
            padding: "4px 12px",
            borderRadius: 20,
            border: `1px solid ${notesOnly ? "transparent" : "var(--border)"}`,
            background: notesOnly ? "var(--orange-bg)" : "transparent",
            color: notesOnly ? "var(--orange)" : "var(--text-3)",
            fontSize: 12,
            fontWeight: notesOnly ? 600 : 400,
            cursor: "pointer",
            transition: "all 0.15s",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          {notesOnly && (
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "var(--orange)",
                display: "inline-block",
              }}
            />
          )}
          📝 仅笔记
        </button>
      </div>

      {/* Subtitle list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {status === "loading" ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: 200,
              gap: 12,
            }}
          >
            <span className="spinner" style={{ width: 28, height: 28 }} />
            <p className="pulse-text" style={{ fontSize: 13, color: "var(--text-3)" }}>
              正在提取字幕...
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 120,
            }}
          >
            <p style={{ fontSize: 13, color: "var(--text-4)" }}>
              {notesOnly ? "还没有笔记" : search ? "没有匹配的字幕" : "暂无字幕"}
            </p>
          </div>
        ) : (
          filtered.map((subtitle) => (
            <SubtitleItem
              key={subtitle.id}
              subtitle={subtitle}
              onNoteChange={onNoteChange}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "10px 20px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          background: "var(--bg-card)",
        }}
      >
        <span className="font-mono" style={{ fontSize: 12, color: "var(--text-3)" }}>
          {filtered.length < subtitles.length
            ? `${filtered.length} / ${subtitles.length} 条`
            : `共 ${subtitles.length} 条`}
        </span>
        <button
          type="button"
          onClick={handleCopyAll}
          style={{
            padding: "5px 12px",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 12,
            color: "var(--text-2)",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--primary)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)";
          }}
        >
          📋 复制全部
        </button>
      </div>
    </div>
  );
}
