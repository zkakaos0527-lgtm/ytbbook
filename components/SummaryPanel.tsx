import { formatDuration } from "@/lib/format";
import type { TopicSegment } from "@/types";

type SummaryPanelProps = {
  timeline: TopicSegment[];
  isLoading?: boolean;
};

export function SummaryPanel({ timeline, isLoading }: SummaryPanelProps) {
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
          AI 正在生成时间线…
        </p>
      </div>
    );
  }

  if (!timeline || timeline.length === 0) {
    return (
      <p
        style={{
          fontSize: 13,
          color: "var(--text-3)",
          textAlign: "center",
          paddingTop: 24,
        }}
      >
        摘要将在字幕加载后自动生成
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {timeline.map((segment, i) => (
        <div
          key={i}
          style={{
            borderLeft: "3px solid var(--primary)",
            paddingLeft: 12,
            paddingTop: 2,
            paddingBottom: 2,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
              flexWrap: "wrap",
            }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                color: "var(--primary)",
                background: "var(--primary-light)",
                padding: "2px 6px",
                borderRadius: 4,
                whiteSpace: "nowrap",
              }}
            >
              {formatDuration(segment.startTime)} – {formatDuration(segment.endTime)}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-1)",
              }}
            >
              {segment.title}
            </span>
          </div>
          <p
            style={{
              fontSize: 12,
              color: "var(--text-2)",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {segment.summary}
          </p>
        </div>
      ))}
    </div>
  );
}
