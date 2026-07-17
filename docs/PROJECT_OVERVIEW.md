# ytbbook 项目梳理

更新时间：2026-07-17

本项目是一个基于 Next.js 的 YouTube 视频学习笔记工具。核心流程是：输入 YouTube 链接，提取字幕，使用 LLM 合并碎片字幕、翻译成中文、生成时间线摘要，保存到 Supabase，并支持字幕检索、笔记批注、标签和导出。

## 技术栈

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4，加大量内联样式和 `app/globals.css` 变量
- Supabase JS 作为数据存储
- Vitest 测试
- OpenAI SDK 客户端用于 DeepSeek 兼容接口
- Gemini REST API 用于翻译

## 常用命令

```bash
npm install
npm run dev
npm test
npm run build
```

当前本地环境注意：依赖安装曾因磁盘空间不足失败，报错为 `ENOSPC: no space left on device`。清理磁盘后需要重新执行 `npm install`，再运行测试和构建。

## 环境变量

参考根目录 `.env.example`：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPADATA_API_KEY`
- `RAPIDAPI_KEY`
- `RAPIDAPI_HOST`
- `RAPIDAPI_TRANSCRIPT_URL`
- `TRANSLATION_PROVIDER`
- `GEMINI_API_KEY`
- `GEMINI_API_KEY_1`
- `GEMINI_API_KEY_2`
- `GEMINI_MODEL`
- `GEMINI_BASE_URL`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_API_KEY_1`
- `DEEPSEEK_API_KEY_2`

代码中目前会自动检查 Gemini 和 DeepSeek 的多 key 配置，并轮询可用 key。`TRANSLATION_PROVIDER` 当前没有实际分流逻辑，翻译会按已配置 key 池在 Gemini/DeepSeek 间轮转。

## 目录地图

- `app/page.tsx`：首页服务端组件，读取 Supabase 笔记卡片。
- `app/HomeClient.tsx`：首页客户端 UI，展示标签筛选、输入区和最近笔记。
- `app/notebook/[id]/page.tsx`：笔记详情页，读取单个 notebook 并展示视频信息、标签、摘要、导出和字幕列表。
- `components/NotebookWorkspace.tsx`：新建视频笔记的核心客户端流程。
- `components/TranscriptPanel.tsx`：字幕列表、搜索、语言筛选、仅笔记筛选、复制全部。
- `components/SubtitleItem.tsx`：单条字幕及用户批注编辑。
- `components/TagEditor.tsx`：笔记标签编辑。
- `components/ExportPanel.tsx`：复制 Markdown / NotebookLM 文档。
- `components/SummaryPanel.tsx`：时间线摘要展示。
- `components/URLInput.tsx`：YouTube URL 输入和加载状态。
- `lib/youtube.ts`：YouTube URL 解析、字幕 provider 调用、字幕 payload 归一化、错误归一化。
- `lib/claude.ts`：实际是 LLM 聚合模块，包含 DeepSeek 合并字幕、Gemini/DeepSeek 翻译、时间线摘要。
- `lib/supabase.ts`：Supabase client、notebook/subtitle 保存和读取。
- `lib/workspace.ts`：从字幕接口响应创建 Notebook 草稿。
- `lib/export.ts`：Markdown / NotebookLM 导出文本。
- `lib/async.ts`：并发 map、结果分区、超时 fallback。
- `lib/translation.ts`：前端请求分批大小。
- `types/index.ts`：Notebook、Subtitle、API response 等共享类型。
- `supabase/migrations/001_initial_schema.sql`：初始数据库 schema。
- `app/api/*`：Next.js API routes。

## 主要业务流程

1. 首页 `NotebookWorkspace` 接收 YouTube URL。
2. `POST /api/transcript` 调用 `getYoutubeTranscript`。
3. `lib/youtube.ts` 优先使用 Supadata，失败或未配置时使用 RapidAPI。
4. `/api/transcript` 同时通过 YouTube oEmbed 补充标题和频道。
5. 前端调用 `POST /api/merge`，由 DeepSeek 将碎片字幕合并成更完整语义句。
6. `createNotebookDraftFromTranscript` 生成本地 Notebook 草稿。
7. 前端按 50 条一批调用 `POST /api/translate`。
8. `translateWithClaude` 在 Gemini/DeepSeek key 池中轮询，最多重试 3 轮。
9. 前端调用 `POST /api/summarize` 生成时间线摘要。
10. 摘要成功后，前端调用 `POST /api/notebooks` 保存 notebook 和 subtitles。
11. 首页和详情页通过 Supabase 读取历史笔记。

## API 路由

- `POST /api/transcript`：入参 `{ youtubeUrl }`，返回字幕和视频信息。
- `POST /api/merge`：入参 `{ subtitles: [{ start, end, text }] }`，返回合并后的字幕。
- `POST /api/translate`：入参 `{ subtitles: [{ id, text }] }`，最多 50 条，返回 translations。
- `POST /api/summarize`：入参 `{ subtitles, durationSeconds }`，返回时间线 segments。
- `GET /api/notebooks`：返回所有 notebooks。
- `POST /api/notebooks`：保存 Notebook。
- `GET /api/notebooks/[id]`：读取单个 Notebook。
- `PATCH /api/notebooks/[id]/tags`：更新 tags。
- `PATCH /api/notebooks/[id]/subtitles/[subtitleId]`：更新单条字幕 userNote。

## 数据模型

核心类型在 `types/index.ts`：

- `Notebook`：视频笔记主对象，包含 URL、标题、频道、时长、缩略图、语言、摘要、标签和字幕数组。
- `Subtitle`：单条字幕，包含顺序、开始/结束时间、原文、译文、用户笔记。
- `TopicSegment`：时间线摘要段落。

Supabase migration 当前包含：

- `notebooks`
- `subtitles`

## 已发现的重点风险

1. `supabase/migrations/001_initial_schema.sql` 缺少 `notebooks.tags` 字段，但代码里多处读写 `tags`，包括 `saveNotebook`、`listNotebookCards`、`TagEditor`。部署到新 Supabase 时会报列不存在。
2. `NotebookWorkspace` 中失败翻译重试逻辑按字幕 index 过滤 failed batch，逻辑上容易错配，因为 failed batch index 是批次 index，不是字幕 index。
3. 新建笔记保存只在摘要成功后触发；如果摘要失败，字幕和翻译结果不会保存。
4. `summary` 字段现在保存的是草稿占位文案，时间线摘要只存在前端 state，没有写回 notebook summary 或独立表。
5. `AGENTS.md` 在 PowerShell 默认输出中有编码乱码，需要确认文件本身编码或重新保存为 UTF-8。
6. `lib/claude.ts` 命名与实际职责不一致，当前包含 Gemini、DeepSeek、合并、翻译、摘要，后续维护时建议拆分。
7. `TRANSLATION_PROVIDER` 在 `.env.example` 里存在，但代码未按该变量选择 provider。
8. 详情页 `SummaryPanel` 传入空数组，所以历史笔记详情页不会显示之前生成的时间线摘要。

## 后续优先级建议

1. 修 Supabase schema：补 `tags text[] not null default '{}'`，并考虑给时间线摘要建表或 JSONB 字段。
2. 修保存策略：即使摘要失败，也保存已生成的字幕和翻译。
3. 修翻译失败重试的批次映射。
4. 明确摘要持久化方式，并让详情页可展示历史摘要。
5. 清理/拆分 `lib/claude.ts`，把 provider、prompt、merge、summary 分开。
6. 清理 README，把默认 Next.js 模板替换为项目实际说明。
7. 磁盘空间释放后执行 `npm install`、`npm test`、`npm run build`。

## Git 与部署状态

- 本地仓库已从 `https://github.com/zkakaos0527-lgtm/ytbbook.git` 克隆。
- 当前分支：`main`，跟踪 `origin/main`。
- 后续推送 GitHub 前建议先完成测试和构建。
- Vercel 部署需要配置上述环境变量，并确保 Supabase migration 已应用。
