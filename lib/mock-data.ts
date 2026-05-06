import { DashboardNotebookCard, Notebook } from "@/types";

export const dashboardNotebookCards: DashboardNotebookCard[] = [
  {
    id: "atomic-habits-review",
    videoTitle: "How To Build A Reliable Learning System From Long Videos",
    channelName: "Deep Learning Journal",
    durationSeconds: 1468,
    subtitleCount: 84,
    noteCount: 13,
    createdAt: "2026-05-01T14:00:00.000Z",
    thumbnailUrl: "",
    summary: "把长视频拆成可检索的字幕单元，再叠加中文翻译和个人注释，学习内容才能真正进入长期知识系统。",
    tags: ["技术", "AI"],
  },
  {
    id: "ai-agent-system",
    videoTitle: "Building AI Agents That Keep Better Notes And Context",
    channelName: "Product Engineering Lab",
    durationSeconds: 2214,
    subtitleCount: 126,
    noteCount: 22,
    createdAt: "2026-04-28T09:30:00.000Z",
    thumbnailUrl: "",
    summary: "AI Agent 的核心能力在于持久化上下文管理和可检索的知识沉淀系统。",
    tags: ["AI", "产品"],
  },
  {
    id: "ux-research-memo",
    videoTitle: "Turning Video Research Into A Searchable Team Knowledge Base",
    channelName: "Design Systems Daily",
    durationSeconds: 1886,
    subtitleCount: 101,
    noteCount: 9,
    createdAt: "2026-04-22T18:15:00.000Z",
    thumbnailUrl: "",
    summary: "将视频研究内容转化为团队可搜索的知识库，需要结构化的标注和标签系统。",
    tags: ["产品", "通识"],
  },
];

export const notebookDetailMock: Notebook = {
  id: "video-notebook-demo",
  youtubeUrl: "https://www.youtube.com/watch?v=video-notebook-demo",
  videoTitle: "How To Build A Reliable Learning System From Long Videos",
  channelName: "Deep Learning Journal",
  durationSeconds: 1468,
  thumbnailUrl: "",
  sourceLanguage: "en",
  targetLanguage: "zh",
  summary: [
    "这是一份 Step 1 的示例摘要，用来承接后续真实 Claude 输出。",
    "## 核心论点",
    "把长视频拆成可检索的字幕单元，再叠加中文翻译和个人注释，学习内容才能真正进入长期知识系统。",
    "## 关键概念",
    "- **Atomic Notes**: 每条字幕都是一个最小知识片段。",
    "- **Review Surface**: 摘要、字幕和批注同时存在，降低复盘成本。",
    "## 可操作启发",
    "- 先搭建稳定归档流程，再优化翻译与导出细节。",
  ].join("\n"),
  tags: ["技术", "AI"],
  createdAt: "2026-05-01T14:00:00.000Z",
  updatedAt: "2026-05-01T16:20:00.000Z",
  subtitles: [
    {
      id: "sub-1",
      notebookId: "video-notebook-demo",
      sequence: 1,
      startTime: 0,
      endTime: 7,
      originalText:
        "If you treat a long video like a stream, you usually forget most of it by tomorrow.",
      translatedText:
        "如果你把长视频只当作一次性的信息流来看，通常到第二天就会忘掉大部分内容。",
      userNote: "关键问题不是有没有看过，而是看完之后有没有留下可复用的知识载体。",
      createdAt: "2026-05-01T14:00:00.000Z",
    },
    {
      id: "sub-2",
      notebookId: "video-notebook-demo",
      sequence: 2,
      startTime: 7,
      endTime: 14,
      originalText:
        "The real leverage comes from turning each spoken idea into a searchable note.",
      translatedText:
        "真正的杠杆点在于，把视频中说出的每一个观点都变成一条可搜索的笔记。",
      userNote: "这就是产品差异点: 不是即时翻译，而是学习后的知识沉淀。",
      createdAt: "2026-05-01T14:00:08.000Z",
    },
    {
      id: "sub-3",
      notebookId: "video-notebook-demo",
      sequence: 3,
      startTime: 14,
      endTime: 22,
      originalText:
        "Subtitles already provide a natural segmentation layer for this workflow.",
      translatedText:
        "字幕本身就为这套工作流提供了天然的分段层级。",
      userNote: null,
      createdAt: "2026-05-01T14:00:16.000Z",
    },
    {
      id: "sub-4",
      notebookId: "video-notebook-demo",
      sequence: 4,
      startTime: 22,
      endTime: 31,
      originalText:
        "Once you have the transcript, translation and summarization become repeatable system steps.",
      translatedText:
        "一旦拿到字幕，翻译与摘要就可以变成可重复执行的系统步骤。",
      userNote: null,
      createdAt: "2026-05-01T14:00:24.000Z",
    },
  ],
};
