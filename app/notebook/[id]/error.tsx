"use client";

import Link from "next/link";
import { useEffect } from "react";

type NotebookErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function NotebookErrorPage({
  error,
  reset,
}: NotebookErrorPageProps) {
  useEffect(() => {
    console.error("Failed to render notebook detail page:", error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        padding: "48px 32px",
      }}
    >
      <section
        style={{
          maxWidth: 720,
          margin: "0 auto",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          boxShadow: "var(--shadow-card)",
          padding: 24,
        }}
      >
        <p
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--primary)",
            marginBottom: 8,
          }}
        >
          笔记详情加载失败
        </p>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "var(--text-1)",
            marginBottom: 10,
          }}
        >
          无法打开这份笔记
        </h1>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: "var(--text-2)",
            marginBottom: 16,
          }}
        >
          详情页读取数据库或字幕数据时发生错误。你可以重试，或返回首页选择其他笔记。
        </p>
        {error.message && (
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "var(--bg-inner)",
              border: "1px solid var(--border-light)",
              borderRadius: 8,
              color: "var(--text-2)",
              fontSize: 12,
              lineHeight: 1.6,
              padding: 12,
              marginBottom: 16,
            }}
          >
            {error.message}
          </pre>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: 8,
              background: "var(--primary)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            重试
          </button>
          <Link
            href="/"
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg-card)",
              color: "var(--text-2)",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            返回首页
          </Link>
        </div>
      </section>
    </main>
  );
}
