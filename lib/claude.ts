import OpenAI from "openai";

import type {
  Notebook,
  TopicSegment,
  TranslationInputSubtitle,
  TranslationResult,
} from "@/types";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_MODEL = "deepseek-chat";
const TRANSLATION_BATCH_SIZE = 50;
const MERGE_BATCH_SIZE = 150;

export class ClaudeApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ClaudeApiError";
    this.status = status;
  }
}

let deepseekClient: OpenAI | null = null;

function getDeepSeekClient(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new ClaudeApiError(
      "DEEPSEEK_API_KEY is not configured in the environment.",
      500,
    );
  }

  if (!deepseekClient) {
    deepseekClient = new OpenAI({
      apiKey,
      baseURL: DEEPSEEK_BASE_URL,
    });
  }

  return deepseekClient;
}

export type RawSubtitleInput = {
  start: number;
  end: number;
  text: string;
};

export async function mergeSubtitlesWithLLM(
  subtitles: RawSubtitleInput[],
): Promise<RawSubtitleInput[]> {
  if (!subtitles.length) return [];

  const client = getDeepSeekClient();
  const merged: RawSubtitleInput[] = [];

  for (let i = 0; i < subtitles.length; i += MERGE_BATCH_SIZE) {
    const batch = subtitles.slice(i, i + MERGE_BATCH_SIZE);
    const targetCount = Math.round(batch.length / 3);

    const completion = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      max_tokens: 4096,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `你是字幕整理专家。将碎片化字幕合并为完整语义句子。

规则：
1. 将属于同一句话的碎片合并为一条
2. 保留第一个碎片的 start 时间，最后一个碎片的 end 时间
3. 目标：约 ${targetCount} 条合并后字幕
4. 不要翻译，保持原文语言
5. 直接返回 JSON 数组，格式：[{"start":0.0,"end":3.5,"text":"完整句子"}]`,
        },
        {
          role: "user",
          content: JSON.stringify(batch),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      merged.push(...batch);
      continue;
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as RawSubtitleInput[];
      merged.push(...parsed);
    } catch {
      merged.push(...batch);
    }
  }

  return merged;
}

export function buildTranslationBatches(
  subtitles: TranslationInputSubtitle[],
  batchSize = TRANSLATION_BATCH_SIZE,
): TranslationInputSubtitle[][] {
  const batches: TranslationInputSubtitle[][] = [];

  for (let index = 0; index < subtitles.length; index += batchSize) {
    batches.push(subtitles.slice(index, index + batchSize));
  }

  return batches;
}

export function parseTranslationResponse(content: string): TranslationResult[] {
  const jsonMatch = content.match(/\[[\s\S]*\]/);

  if (!jsonMatch) {
    throw new ClaudeApiError(
      "DeepSeek did not return a valid JSON translation array.",
      502,
    );
  }

  let parsed: TranslationResult[];

  try {
    parsed = JSON.parse(jsonMatch[0]) as TranslationResult[];
  } catch {
    throw new ClaudeApiError(
      "DeepSeek did not return a valid JSON translation array.",
      502,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new ClaudeApiError(
      "DeepSeek did not return a valid JSON translation array.",
      502,
    );
  }

  return parsed.map((t) => ({
    id: t.id,
    translated_text: t.translated_text,
  }));
}

export async function translateWithClaude(
  subtitles: TranslationInputSubtitle[],
): Promise<TranslationResult[]> {
  if (!subtitles.length) {
    throw new ClaudeApiError("No subtitles were provided for translation.", 400);
  }

  const client = getDeepSeekClient();
  const batches = buildTranslationBatches(subtitles);
  const translations: TranslationResult[] = [];

  for (const batch of batches) {
    const completion = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      max_tokens: 4096,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            '你是专业翻译。将以下字幕逐句翻译为中文。保持原文的语序和段落划分。专业术语附英文原词。直接返回 JSON 数组，每项格式为 {"id":"...","translated_text":"..."}。',
        },
        {
          role: "user",
          content: JSON.stringify(batch, null, 2),
        },
      ],
    });

    const textContent = completion.choices[0]?.message?.content ?? "";
    translations.push(...parseTranslationResponse(textContent));
  }

  return translations;
}

export function applyTranslationsToNotebook(
  notebook: Notebook,
  translations: TranslationResult[],
): Notebook {
  const translationMap = new Map(
    translations.map((t) => [t.id, t.translated_text]),
  );

  return {
    ...notebook,
    updatedAt: new Date().toISOString(),
    subtitles: notebook.subtitles.map((subtitle) => ({
      ...subtitle,
      translatedText:
        translationMap.get(subtitle.id) ?? subtitle.translatedText,
    })),
  };
}

export async function summarizeWithClaude(
  subtitles: TranslationInputSubtitle[],
  durationSeconds: number,
): Promise<TopicSegment[]> {
  if (!subtitles.length) {
    throw new ClaudeApiError("No subtitles provided for summarization.", 400);
  }

  const client = getDeepSeekClient();

  const transcriptText = subtitles
    .map((s) => `[${s.id}] ${s.text}`)
    .join("\n");

  const completion = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    max_tokens: 2048,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `你是视频内容分析师。根据带时间戳的字幕，将视频划分为若干话题段落。

每个段落输出：
- startTime: 该段开始时间（秒，数字）
- endTime: 该段结束时间（秒，数字）
- title: 该段话题标题（10字以内）
- summary: 该段内容摘要（2-3句话，50字以内）

字幕格式：[秒数] 文本

直接返回 JSON 数组：[{"startTime":0,"endTime":330,"title":"...","summary":"..."}]

要求：
- 段落数量：视频每10分钟约2-4个段落
- 段落要覆盖完整视频时长（0 到 ${durationSeconds} 秒）
- 标题简洁，摘要客观`,
      },
      {
        role: "user",
        content: transcriptText,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "";
  const jsonMatch = content.match(/\[[\s\S]*\]/);

  if (!jsonMatch) {
    throw new ClaudeApiError("DeepSeek did not return a valid timeline JSON.", 502);
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as TopicSegment[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("empty");
    }
    return parsed;
  } catch {
    throw new ClaudeApiError("DeepSeek returned invalid timeline structure.", 502);
  }
}
