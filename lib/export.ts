import type { Notebook } from "@/types";

export function exportAsMarkdown(notebook: Notebook): string {
  const lines: string[] = [];

  lines.push(`# ${notebook.videoTitle}`);
  lines.push(`> 频道：${notebook.channelName}  |  来源：${notebook.youtubeUrl}`);
  lines.push("");

  if (notebook.summary.trim()) {
    lines.push("## AI 摘要");
    lines.push("");
    lines.push(notebook.summary.trim());
    lines.push("");
  }

  lines.push("## 字幕与笔记");
  lines.push("");

  for (const s of notebook.subtitles) {
    const ts = formatTimestamp(s.startTime);
    lines.push(`### \`${ts}\``);
    lines.push("");
    lines.push(`**原文：** ${s.originalText}`);
    if (s.translatedText) {
      lines.push("");
      lines.push(`**译文：** ${s.translatedText}`);
    }
    if (s.userNote) {
      lines.push("");
      lines.push(`> 📝 ${s.userNote}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function exportForNotebookLM(notebook: Notebook): string {
  const lines: string[] = [];

  lines.push(`视频标题：${notebook.videoTitle}`);
  lines.push(`频道：${notebook.channelName}`);
  lines.push(`来源：${notebook.youtubeUrl}`);
  lines.push("");

  if (notebook.summary.trim()) {
    lines.push("【摘要】");
    lines.push(notebook.summary.trim());
    lines.push("");
  }

  lines.push("【字幕全文】");
  lines.push("");

  for (const s of notebook.subtitles) {
    const ts = formatTimestamp(s.startTime);
    const note = s.userNote ? `  [笔记: ${s.userNote}]` : "";
    if (s.translatedText) {
      lines.push(`[${ts}] ${s.originalText}`);
      lines.push(`       ${s.translatedText}${note}`);
    } else {
      lines.push(`[${ts}] ${s.originalText}${note}`);
    }
  }

  return lines.join("\n");
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
