"use client";

import Link from "next/link";
import { useState } from "react";
import { NotebookWorkspace } from "@/components/NotebookWorkspace";
import { formatNotebookDate } from "@/lib/format";
import type { DashboardNotebookCard } from "@/types";

const ALL_TAGS = ["建筑", "技术", "AI", "产品", "前端", "通识", "其他"];

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  "建筑":   { bg: "var(--primary-light)", color: "var(--primary)" },
  "技术":   { bg: "var(--green-bg)",      color: "var(--green)" },
  "AI":     { bg: "#f3e8ff",              color: "#7c3aed" },
  "产品":   { bg: "var(--orange-bg)",      color: "var(--orange)" },
  "前端":   { bg: "#e0f2fe",              color: "#0284c7" },
  "通识":   { bg: "var(--pink-bg)",        color: "var(--pink)" },
};

function getTagStyle(tag: string) {
  const entry = TAG_COLORS[tag];
  if (entry) return { background: entry.bg, color: entry.color };
  return { background: "var(--bg-inner)", color: "var(--text-3)" };
}

type HomeClientProps = {
  cards: DashboardNotebookCard[];
  error: boolean;
};

function NotebookCard({ card }: { card: DashboardNotebookCard }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="notebook-card" style={{ position: "relative" }}>
      {/* Thumbnail */}
      <div style={{ position: "relative", aspectRatio: "16/10", overflow: "hidden", background: "linear-gradient(135deg, #e8edf4, #dce3ed)" }}>
        {card.thumbnailUrl ? (
          <img
            src={card.thumbnailUrl}
            alt={card.videoTitle}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-4)", fontSize: 28 }}>
            ▶
          </div>
        )}
        {/* Three-dot menu */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 24,
            height: 24,
            borderRadius: 6,
            background: "rgba(255,255,255,0.9)",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: 14,
            color: "var(--text-4)",
            transition: "all 0.15s",
          }}
        >
          ⋮
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: "12px 14px 0", flex: 1 }}>
        {/* Title */}
        <p
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--text-1)",
            lineHeight: 1.4,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            marginBottom: 6,
          }}
        >
          {card.videoTitle}
        </p>

        {/* AI summary preview */}
        {card.summary && (
          <p
            style={{
              fontSize: 11,
              color: "var(--text-3)",
              lineHeight: 1.5,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              marginBottom: 8,
            }}
          >
            {card.summary}
          </p>
        )}

        {/* Tags */}
        {card.tags && card.tags.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
            {card.tags.map((tag) => (
              <span key={tag} className="tag-pill" style={getTagStyle(tag)}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "8px 14px",
          borderTop: "1px solid var(--border-light)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)", display: "inline-block" }} />
          <span className="font-mono" style={{ fontSize: 11, color: "var(--text-4)" }}>
            {formatNotebookDate(card.createdAt)}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>💬 {card.subtitleCount}</span>
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>📝 {card.noteCount}</span>
        </div>
      </div>
    </div>
  );
}

function TagFilter({
  selectedTags,
  onToggle,
}: {
  selectedTags: string[];
  onToggle: (tag: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {ALL_TAGS.map((tag) => {
        const active = selectedTags.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            style={{
              padding: "4px 12px",
              borderRadius: 20,
              border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
              background: active ? "var(--primary)" : "var(--bg-card)",
              color: active ? "#fff" : "var(--text-2)",
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}

export function HomeClient({ cards, error }: HomeClientProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  const filteredCards =
    selectedTags.length === 0
      ? cards
      : cards.filter((c) => c.tags && selectedTags.some((t) => c.tags.includes(t)));

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
          marginBottom: 20,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.04em" }}>
          Notebooks
        </h1>
      </div>

      {/* Tag filter row */}
      <div style={{ marginBottom: 20 }}>
        <TagFilter selectedTags={selectedTags} onToggle={toggleTag} />
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
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-1)" }}>
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
        ) : filteredCards.length === 0 ? (
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
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            {filteredCards.map((card) => (
              <Link
                key={card.id}
                href={`/notebook/${card.id}`}
                style={{ textDecoration: "none" }}
              >
                <NotebookCard card={card} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}