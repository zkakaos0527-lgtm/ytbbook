import OpenAI from "openai";

import type {
  Notebook,
  TranslationInputSubtitle,
  TranslationResult,
} from "@/types";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_MODEL = "deepseek-chat";
const TRANSLATION_BATCH_SIZE = 50;

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
            '你是专业翻译。将以下英文字幕逐句翻译为中文。保持原文的语序和段落划分。专业术语附英文原词。直接返回 JSON 数组，每项格式为 {"id":"...","translated_text":"..."}。',
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

const SUMMARY_SYSTEM_PROMPT = `你是专业的视频内容分析师。根据提供的视频字幕，生成结构化的中文摘要。

输出格式（严格遵守）：
## 核心主题
一句话概括视频的核心内容。

## 主要观点
- 观点1
- 观点2
- 观点3（最多5条）

## 关键信息
- 重要细节、数据、案例等
- 每条简洁，不超过30字

## 学习收获
用2-3句话总结观看此视频的价值和行动建议。`;

export async function summarizeWithClaude(
  subtitles: TranslationInputSubtitle[],
): Promise<string> {
  if (!subtitles.length) {
    throw new ClaudeApiError("No subtitles provided for summarization.", 400);
  }

  const client = getDeepSeekClient();

  const transcriptText = subtitles
    .map((s) => s.text)
    .join(" ");

  const completion = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    max_tokens: 1024,
    temperature: 0.3,
    messages: [
      { role: "system", content: SUMMARY_SYSTEM_PROMPT },
      { role: "user", content: transcriptText },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "";

  if (!content.trim()) {
    throw new ClaudeApiError("DeepSeek returned an empty summary.", 502);
  }

  return content;
}
