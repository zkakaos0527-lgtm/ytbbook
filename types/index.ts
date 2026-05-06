export type Subtitle = {
  id: string;
  notebookId: string;
  sequence: number;
  startTime: number;
  endTime: number;
  originalText: string;
  translatedText: string | null;
  userNote: string | null;
  createdAt: string;
};

export type Notebook = {
  id: string;
  youtubeUrl: string;
  videoTitle: string;
  channelName: string;
  durationSeconds: number;
  thumbnailUrl: string;
  sourceLanguage: string;
  targetLanguage: string;
  summary: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  subtitles: Subtitle[];
};

export type DashboardNotebookCard = {
  id: string;
  videoTitle: string;
  channelName: string;
  durationSeconds: number;
  subtitleCount: number;
  noteCount: number;
  createdAt: string;
  thumbnailUrl: string;
  summary: string;
  tags: string[];
};

export type TranscriptApiSubtitle = {
  start: number;
  end: number;
  text: string;
};

export type TranscriptApiVideoInfo = {
  id: string;
  title: string;
  channel: string;
  duration: number;
  language: string;
};

export type TranscriptApiResponse = {
  subtitles: TranscriptApiSubtitle[];
  videoInfo: TranscriptApiVideoInfo;
};

export type TranslationInputSubtitle = {
  id: string;
  text: string;
};

export type TranslationResult = {
  id: string;
  translated_text: string;
};

export type TranslateApiResponse = {
  translations: TranslationResult[];
};

export type TopicSegment = {
  startTime: number;
  endTime: number;
  title: string;
  summary: string;
};

export type TimelineSummaryApiResponse = {
  segments: TopicSegment[];
};

export type SummarizeApiResponse = TimelineSummaryApiResponse;

export type MergedSubtitle = {
  start: number;
  end: number;
  text: string;
};

export type MergeApiResponse = {
  subtitles: MergedSubtitle[];
};
