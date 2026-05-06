"use client";

import { useState } from "react";
import type { Notebook } from "@/types";

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

type TagEditorProps = {
  notebookId: string;
  initialTags: string[];
};

export function TagEditor({ notebookId, initialTags }: TagEditorProps) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [adding, setAdding] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveTags(newTags: string[]) {
    setSaving(true);
    try {
      await fetch(`/api/notebooks/${notebookId}/tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: newTags }),
      });
      setTags(newTags);
    } finally {
      setSaving(false);
    }
  }

  function removeTag(tag: string) {
    saveTags(tags.filter((t) => t !== tag));
  }

  function handleAddTag(tag: string) {
    if (tags.includes(tag)) return;
    saveTags([...tags, tag]);
    setAdding(false);
    setInputValue("");
  }

  function handleInputSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      saveTags([...tags, trimmed]);
    }
    setAdding(false);
    setInputValue("");
  }

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            background: "var(--primary-light)",
            color: "var(--primary)",
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--primary)",
              padding: 0,
              fontSize: 12,
              lineHeight: 1,
              opacity: 0.7,
            }}
          >
            ✕
          </button>
        </span>
      ))}

      {adding ? (
        <form onSubmit={handleInputSubmit} style={{ display: "flex", gap: 4 }}>
          <select
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            style={{
              padding: "2px 6px",
              border: "1px solid var(--primary)",
              borderRadius: 6,
              fontSize: 11,
              background: "var(--bg-card)",
              color: "var(--text-1)",
              outline: "none",
              minWidth: 80,
            }}
          >
            <option value="">选择标签</option>
            {ALL_TAGS.filter((t) => !tags.includes(t)).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!inputValue}
            style={{
              padding: "2px 8px",
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            添加
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setInputValue(""); }}
            style={{
              padding: "2px 8px",
              background: "transparent",
              color: "var(--text-3)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            取消
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{
            padding: "2px 10px",
            border: "1px dashed var(--border)",
            borderRadius: 10,
            fontSize: 11,
            color: "var(--text-3)",
            background: "transparent",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--primary)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)";
          }}
        >
          + 添加
        </button>
      )}
    </div>
  );
}