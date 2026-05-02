import { extractYoutubeVideoId } from "@/lib/youtube";
import { buildYoutubeEmbedUrl } from "@/lib/workspace";

type VideoPlayerProps = {
  title: string;
  thumbnailUrl: string;
  youtubeUrl: string;
};

export function VideoPlayer({ title, thumbnailUrl, youtubeUrl }: VideoPlayerProps) {
  const videoId = extractYoutubeVideoId(youtubeUrl);
  const embedUrl = videoId ? buildYoutubeEmbedUrl(videoId) : null;

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {embedUrl ? (
        <div style={{ aspectRatio: "16/9" }}>
          <iframe
            title={title}
            src={embedUrl}
            style={{ width: "100%", height: "100%", display: "block" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div
          style={{
            aspectRatio: "16/9",
            background: thumbnailUrl
              ? `url(${thumbnailUrl}) center/cover`
              : "linear-gradient(135deg, var(--primary-light), var(--bg-input))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              background: "rgba(105,88,242,0.85)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 18,
            }}
          >
            ▶
          </div>
        </div>
      )}

      <div
        style={{
          padding: "12px 14px",
          borderTop: "1px solid var(--border-light)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <p
          className="font-serif"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-1)",
            lineHeight: 1.4,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {title}
        </p>
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            flexShrink: 0,
            padding: "5px 12px",
            background: "var(--bg-input)",
            border: "1px solid var(--border)",
            borderRadius: 20,
            fontSize: 11,
            color: "var(--text-2)",
            whiteSpace: "nowrap",
            transition: "all 0.15s",
          }}
        >
          打开原视频
        </a>
      </div>
    </div>
  );
}
