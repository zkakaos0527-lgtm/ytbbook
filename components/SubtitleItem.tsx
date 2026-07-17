"use client";

import { useEffect, useRef, useState } from "react";

import { formatTimestamp } from "@/lib/format";
import { Subtitle } from "@/types";

type NoteEditorProps = {
  note?: string | null;
  onSave?: (note: string) => void;
};

export function NoteEditor({ note, onSave }: NoteEditorProps) {
  const [value, setValue] = useState(note ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(next: string) {
    setValue(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSave?.(next);
    }, 400);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 10,
        borderTop: "1px dashed var(--border)",
      }}
    >
      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="在这里写下你的笔记..."
        rows={2}
        style={{
          width: "100%",
          padding: "8px 10px",
          background: "var(--bg-input)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          fontSize: 13,
          color: "var(--orange)",
          lineHeight: 1.6,
          resize: "vertical",
          outline: "none",
          transition: "border-color 0.15s",
          fontFamily: "inherit",
        }}
        onFocus={(e) => (e.target.style.borderColor = "var(--orange)")}
        onBlur={(e) => {
          e.target.style.borderColor = "var(--border)";
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          onSave?.(value);
        }}
      />
      <p style={{ fontSize: 10, color: "var(--text-4)", marginTop: 4 }}>
        笔记随字幕导出
      </p>
    </div>
  );
}

type SubtitleItemProps = {
  subtitle: Subtitle;
  isActive?: boolean;
  onNoteChange?: (id: string, note: string) => void;
};

export function SubtitleItem({
  subtitle,
  isActive = false,
  onNoteChange,
}: SubtitleItemProps) {
  const [expanded, setExpanded] = useState(isActive);

  return (
    <div
      onClick={() => setExpanded((v) => !v)}
      style={{
        padding: "12px 20px",
        borderLeft: `3px solid ${expanded ? "var(--primary)" : "transparent"}`,
        background: expanded ? "var(--primary-light)" : "transparent",
        cursor: "pointer",
        transition: "all 0.15s",
        borderBottom: "1px solid var(--border-light)",
      }}
      onMouseEnter={(e) => {
        if (!expanded) {
          (e.currentTarget as HTMLDivElement).style.background = "var(--primary-light)";
        }
      }}
      onMouseLeave={(e) => {
        if (!expanded) {
          (e.currentTarget as HTMLDivElement).style.background = "transparent";
        }
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span
          className="font-mono"
          style={{ fontSize: 11, color: "var(--primary)", opacity: 0.7 }}
        >
          {formatTimestamp(subtitle.startTime)}
        </span>
        {subtitle.userNote && (
          <span
            style={{
              fontSize: 9,
              padding: "2px 6px",
              background: "var(--orange-bg)",
              color: "var(--orange)",
              borderRadius: 10,
              fontWeight: 600,
            }}
          >
            📝 已标注
          </span>
        )}
      </div>

      <p style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.6, marginBottom: 4 }}>
        {subtitle.originalText}
      </p>

      <p
        className="font-serif"
        style={{ fontSize: 14, color: "var(--text-1)", lineHeight: 1.7 }}
      >
        {subtitle.translatedText ?? (
          <span style={{ color: "var(--text-4)", fontStyle: "italic", fontFamily: "inherit" }}>
            翻译中...
          </span>
        )}
      </p>

      {expanded && (
        <div onClick={(e) => e.stopPropagation()}>
          <NoteEditor
            key={subtitle.userNote ?? ""}
            note={subtitle.userNote}
            onSave={(note) => onNoteChange?.(subtitle.id, note)}
          />
        </div>
      )}
    </div>
  );
}
