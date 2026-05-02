import { TranscriptApiResponse, Notebook } from "@/types";

export function buildYoutubeEmbedUrl(videoId: string) {
  return `https://www.youtube.com/embed/${videoId}`;
}

export function buildYoutubeThumbnailUrl(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function createNotebookDraftFromTranscript({
  youtubeUrl,
  transcript,
}: {
  youtubeUrl: string;
  transcript: TranscriptApiResponse;
}): Notebook {
  const now = new Date().toISOString();
  const notebookId = `draft-${transcript.videoInfo.id}`;

  return {
    id: notebookId,
    youtubeUrl,
    videoTitle: transcript.videoInfo.title,
    channelName: transcript.videoInfo.channel,
    durationSeconds: transcript.videoInfo.duration,
    thumbnailUrl: buildYoutubeThumbnailUrl(transcript.videoInfo.id),
    sourceLanguage: transcript.videoInfo.language,
    targetLanguage: "zh",
    summary:
      "Step 5 会在这里生成结构化中文摘要。当前阶段先打通视频信息与字幕展示。",
    createdAt: now,
    updatedAt: now,
    subtitles: transcript.subtitles.map((subtitle, index) => ({
      id: `${notebookId}-${index + 1}`,
      notebookId,
      sequence: index + 1,
      startTime: subtitle.start,
      endTime: subtitle.end,
      originalText: subtitle.text,
      translatedText: null,
      userNote: null,
      createdAt: now,
    })),
  };
}
