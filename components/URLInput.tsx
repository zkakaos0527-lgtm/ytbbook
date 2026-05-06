"use client";

import { FormEvent, useState } from "react";

type URLInputProps = {
  initialValue?: string;
  isLoading?: boolean;
  loadingPhase?: "transcript" | "merging" | "translation" | "summarizing" | "idle";
  loadingDetail?: string;
  error?: string | null;
  onSubmit?: (youtubeUrl: string) => Promise<void> | void;
};

export function URLInput({
  initialValue = "",
  isLoading = false,
  loadingPhase = "idle",
  loadingDetail,
  error = null,
  onSubmit,
}: URLInputProps) {
  const [value, setValue] = useState(initialValue);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim() || !onSubmit) return;
    await onSubmit(value.trim());
  }

  const buttonLabel =
    loadingPhase === "transcript"
      ? "提取字幕中..."
      : loadingPhase === "merging"
        ? loadingDetail ?? "整理字幕中..."
        : loadingPhase === "translation"
          ? loadingDetail
            ? `翻译中... ${loadingDetail}`
            : "翻译中..."
          : loadingPhase === "summarizing"
            ? "生成摘要中..."
            : "生成笔记";

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "16px 20px",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", gap: 10, alignItems: "center" }}
      >
        <div style={{ position: "relative", flex: 1 }}>
          <span
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-4)",
              fontSize: 14,
              pointerEvents: "none",
            }}
          >
            ▶
          </span>
          <input
            type="url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="粘贴 YouTube 链接..."
            disabled={isLoading}
            style={{
              width: "100%",
              height: 40,
              paddingLeft: 34,
              paddingRight: 12,
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 14,
              color: "var(--text-1)",
              outline: "none",
              transition: "border-color 0.15s",
              boxShadow: "var(--shadow-card)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !value.trim()}
          style={{
            height: 40,
            padding: "0 20px",
            background: isLoading ? "var(--text-4)" : "var(--primary)",
            color: "#fff",
            border: "none",
            borderRadius: 24,
            fontSize: 13,
            fontWeight: 600,
            cursor: isLoading ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
            boxShadow: isLoading ? "none" : "0 4px 16px rgba(45,156,219,0.3)",
            transition: "all 0.15s",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
          onMouseEnter={(e) => {
            if (!isLoading) (e.currentTarget as HTMLButtonElement).style.background = "var(--primary-dark)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = isLoading ? "var(--text-4)" : "var(--primary)";
          }}
        >
          {isLoading && <span className="spinner" style={{ width: 14, height: 14 }} />}
          <span className={isLoading ? "pulse-text" : ""}>{buttonLabel}</span>
        </button>
      </form>

      {error && (
        <p
          style={{
            marginTop: 10,
            padding: "8px 12px",
            background: "#fff0f0",
            border: "1px solid #ffd0d0",
            borderRadius: 8,
            fontSize: 13,
            color: "#c0392b",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
