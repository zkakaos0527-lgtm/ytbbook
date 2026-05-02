type SummaryPanelProps = {
  summary: string;
  isLoading?: boolean;
};

export function SummaryPanel({ summary, isLoading }: SummaryPanelProps) {
  if (isLoading) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          paddingTop: 4,
        }}
      >
        {[80, 60, 90, 50, 70].map((w, i) => (
          <div
            key={i}
            style={{
              height: 12,
              width: `${w}%`,
              background: "var(--border)",
              borderRadius: 6,
              animation: "pulse 1.4s ease-in-out infinite",
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
        <p
          style={{
            fontSize: 12,
            color: "var(--text-3)",
            marginTop: 8,
            textAlign: "center",
          }}
        >
          AI 正在生成摘要…
        </p>
      </div>
    );
  }

  if (!summary.trim()) {
    return (
      <p style={{ fontSize: 13, color: "var(--text-3)", textAlign: "center", paddingTop: 24 }}>
        摘要将在字幕加载后自动生成
      </p>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <div className="prose-summary">
        {summary.split("\n").map((line, i) => {
          if (line.startsWith("## ")) {
            return (
              <h2 key={i} style={{ fontSize: 14, marginTop: 16, marginBottom: 6 }}>
                {line.replace("## ", "")}
              </h2>
            );
          }
          if (line.startsWith("- ")) {
            return (
              <ul key={i} style={{ marginBottom: 4 }}>
                <li>{line.replace("- ", "")}</li>
              </ul>
            );
          }
          if (!line.trim()) return null;
          return <p key={i}>{line}</p>;
        })}
      </div>
    </div>
  );
}
