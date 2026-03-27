# Ideal Beauty — Jijian Solution 技术规格文档

## 项目概述

基于 Jijian 平台的读写结合课（Reading-to-Writing）教学解决方案。课题为 "Ideal Beauty"，面向高中英语课堂，40-45 分钟。

核心目标：学生能够运用"主题句 + 具体例证"的结构，使用过渡词，写出一段说明性语段阐述"审美标准的多样性"。

产品形态：学生端 + 教师端的实时协作课堂工具，Agentic AI 贯穿全流程。

---

## 1. 场景架构 (Scene Architecture)

课堂流程由 7 个场景组成，分两种类型交替进行：

| 序号 | ID | 类型 | 名称 | 中文 | 时长 | Agentic |
|------|-----|------|------|------|------|---------|
| 1 | L1 | lecture | Reading overview | 阅读导入 | 5 min | No |
| 2 | T1 | task | Highlight P-E-E | 标注结构 | 10 min | Yes |
| 3 | L2 | lecture | Structure & Transitions | 结构与过渡 | 5 min | No |
| 4 | T2 | task | Pick transitions | 采集过渡词 | 5 min | Yes |
| 5 | L3 | lecture | Writing task | 写作任务 | 5 min | No |
| 6 | T3 | task | Write & evaluate | 写作工坊 | 15 min | Yes |
| 7 | T4 | task | Final submit | 最终提交 | 5 min | No |

### 1.1 Lecture 场景 (L1, L2, L3)

布局：全屏 slide 风格，内容居中，大字体，无侧栏。

L1 内容：
- 完整原文 "Ideal Beauty"（6 段，关于 Happiness Edem、西方媒体、历史审美、Borneo 纹身、Myanmar 颈环、结尾设问）
- 审美标准汇总表（10 个跨文化例子：Nigeria, Western media, Egypt, Venus of Hohle Fels, Rubens, Elizabethan, Borneo, NZ Māori, Myanmar, Indonesia）

L2 内容：
- 主题句高亮展示（紫色边框卡片）
- P-E-E 结构彩色分块示范（蓝=Point, 绿=Evidence, 黄=Elaboration）
- 过渡词分类网格（Example/Contrast/Time-Culture/Cause 四类）

L3 内容：
- 写作任务说明（50-80 词段落）
- 四个句型支架模板
- 三维度评价标准（Topic sentence / Specific example / Transitions）

### 1.2 Task 场景 (T1, T2, T3, T4)

布局：左右双栏。左侧深色 workspace（#1e1d1b），右侧浅色参考面板（#fdfcfa）。两侧均可独立全屏展开。

T1 — Highlight P-E-E：
- 左侧：4 个颜色编码高亮工具（Topic/Point/Evidence/Elaboration），选择结果实时展示
- 右侧：原文按句子拆分，每句可点击高亮，hover 时预览对应工具颜色
- 提交后调 Agent 评估标注准确性

T2 — Pick transitions：
- 左侧：已采集的过渡词按类别（Example/Contrast/Temporal/Causal/Cultural/Addition）分组展示为 chip
- 右侧：原文中 17 个过渡词/短语预处理为可点击 chip，点击即采集/取消
- 提交后调 Agent 评估完整度

T3 — Write & evaluate：
- 左侧：写作编辑器（带词数统计）+ AI 评价按钮 + 版本时间线
- 右侧：原文参考
- 每次提交评价自动创建 version snapshot
- 支持多轮 write→eval→revise 循环
- AI 在修订版中会对比上一版指出改进点

T4 — Final submit：
- 左侧：扩展编辑器（80-100 词）+ 写作历程摘要（柱状图+维度序列）
- 右侧：原文参考

### 1.3 导航

顶部导航条展示 7 个场景按钮，颜色区分类型（橙色=讲授，紫色=任务），显示当前进度 (x/7)。学生自驱节奏，可回退查看之前的讲授内容。

---

## 2. 举手帮助中心 (Help Center)

### 2.1 形态

悬浮在右下角的圆形按钮（举手图标，紫色 #7c3aed），点击展开 360x460 的聊天面板。全场景统一入口，不抢占任何面板空间。

### 2.2 持久对话

- 切换场景时对话**不清空**
- 新场景下首次发问时，自动插入灰色 section 分隔标记（"T1 Highlight P-E-E"）
- 学生可以往上滚动查看之前场景的问答

### 2.3 Starter pills

底部横向滚动的建议问题 pill 条，内容随当前场景自动切换：

```typescript
const STARTERS: Record<SceneId, string[]> = {
  L1: ["What does 'fattening room' mean?", "这篇文章主要讲什么？"],
  T1: ["What is a topic sentence?", "P-E-E 结构是什么？"],
  L2: ["Why is P-E-E important?", "过渡词有什么用？"],
  T2: ["\"while\" 和 \"but\" 有什么区别？", "What counts as a transition?"],
  L3: ["How should I start my paragraph?", "50 词够写什么内容？"],
  T3: ["Can you check my topic sentence?", "How do I add more detail?"],
  T4: ["How do I expand to 100 words?", "Can you suggest another example?"],
};
```

### 2.4 回复策略

两层回复机制，对学生透明（体验一致）：

1. **预设回复 (dummy replies)**：高频问题匹配预设答案，零延迟，不消耗 API。约覆盖 15-20 个常见问题（词汇释义、概念解释、工具使用方法）。
2. **AI 对话 (Claude API)**：无预设匹配时，带完整消息历史调 Claude API。System prompt 按场景区分，引导双语回答、给提示不给答案。

### 2.5 数据收集

每条问答记录需持久化：
- 学生 ID
- 场景 ID
- 是否命中预设
- 问题文本 + 回复文本
- 时间戳

教师端可用于：分析哪些预设被点击最多、学生自由提问的模式、帮助中心使用率。

---

## 3. 数据模型 (Data Model)

### 3.1 核心实体

```typescript
// 课堂会话
interface ClassSession {
  id: string;
  courseId: string;           // 固定为 "ideal-beauty-v1"（PoC 硬编码）
  teacherId: string;
  sessionCode: string;        // 学生加入用的 6 位码
  status: "waiting" | "active" | "ended";
  createdAt: DateTime;
  endedAt?: DateTime;
}

// 学生会话
interface StudentSession {
  id: string;
  classSessionId: string;
  studentId: string;
  studentName: string;
  currentSceneIdx: number;    // 0-6 对应 7 个场景
  joinedAt: DateTime;
}

// 场景产物 — T1 结构标注
interface T1Artifact {
  studentSessionId: string;
  highlights: Record<string, HighlightType>; // sentenceId → "topic"|"point"|"evidence"|"elaboration"
  evaluation?: T1Evaluation;                 // Agent 评估结果
  submittedAt?: DateTime;
}

interface T1Evaluation {
  topicSentence: { found: boolean; feedback: string };
  paragraphStructure: {
    point: { identified: boolean; feedback: string };
    evidence: { identified: boolean; feedback: string };
    elaboration: { identified: boolean; feedback: string };
  };
  overallTip: string;
}

// 场景产物 — T2 过渡词采集
interface T2Artifact {
  studentSessionId: string;
  pickedTransitions: string[];
  evaluation?: T2Evaluation;
  submittedAt?: DateTime;
}

interface T2Evaluation {
  found: string[];
  missed: string[];
  feedback: string;
  encouragement: string;
}

// 写作版本 (T3 + T4)
interface WritingVersion {
  id: string;
  studentSessionId: string;
  versionNumber: number;
  text: string;
  wordCount: number;
  evaluation?: WritingEvaluation; // null if not yet evaluated
  createdAt: DateTime;
  sceneId: "T3" | "T4";
}

interface WritingEvaluation {
  hasTopicSentence: { score: 0 | 1; comment: string };
  hasSpecificExample: { score: 0 | 1; comment: string };
  usesTransitions: { score: 0 | 1; comment: string };
  overallSuggestion: string;
  wordCount: number;
  improvementNote: string | null; // non-null for revisions
}

// 帮助中心消息
interface HelpMessage {
  id: string;
  studentSessionId: string;
  sceneId: string;
  role: "user" | "assistant";
  content: string;
  isDummyReply: boolean;
  createdAt: DateTime;
}

// 广播事件
interface BroadcastEvent {
  classSessionId: string;
  studentId: string;
  versionId?: string;          // 写作版本 ID
  artifactType?: "t1" | "t2" | "writing";
  teacherAnnotations?: string;
  broadcastAt: DateTime;
}
```

### 3.2 关系图

```
ClassSession
  ├── 1:N StudentSession
  │     ├── 1:1 T1Artifact
  │     ├── 1:1 T2Artifact
  │     ├── 1:N WritingVersion
  │     │     └── 1:1 WritingEvaluation (optional)
  │     └── 1:N HelpMessage
  └── 1:N BroadcastEvent
```

---

## 4. API 设计

### 4.1 REST API

```
# Session management
POST   /api/sessions                    # 教师创建课堂
GET    /api/sessions/:id                # 获取课堂信息
POST   /api/sessions/:id/join           # 学生加入（带 sessionCode）
PATCH  /api/sessions/:id/status         # 教师结束课堂

# Student progress
GET    /api/sessions/:id/students       # 教师获取全班学生列表+进度
PATCH  /api/students/:sid/scene         # 学生更新当前场景

# T1 artifacts
PUT    /api/students/:sid/t1            # 保存/更新高亮标注
POST   /api/students/:sid/t1/evaluate   # 提交 Agent 评估

# T2 artifacts
PUT    /api/students/:sid/t2            # 保存/更新过渡词采集
POST   /api/students/:sid/t2/evaluate   # 提交 Agent 评估

# Writing versions
GET    /api/students/:sid/versions      # 获取所有写作版本
POST   /api/students/:sid/versions      # 创建新版本
POST   /api/students/:sid/versions/:vid/evaluate  # 提交 Agent 评估

# Help center
GET    /api/students/:sid/help-messages # 获取帮助消息历史
POST   /api/students/:sid/help-messages # 发送消息（后端判断 dummy/API）

# Broadcast
POST   /api/sessions/:id/broadcast      # 教师发起广播
GET    /api/sessions/:id/broadcast/active # 获取当前活跃广播

# Teacher insights
GET    /api/sessions/:id/insights/:sceneId # 获取某场景的 AI 汇总
```

### 4.2 实时同步 (SSE)

教师端需要实时感知学生状态变化。使用 SSE（Server-Sent Events）单向推送。

```
GET /api/sessions/:id/stream   # 教师端 SSE 连接

# 事件类型：
event: student_joined       # 学生加入
event: scene_changed         # 学生切换场景
event: t1_submitted          # 学生提交 T1 评估
event: t2_submitted          # 学生提交 T2 评估
event: version_created       # 学生创建新写作版本
event: version_evaluated     # 写作版本被评估完成
event: help_message          # 学生发了帮助消息

# 学生端 SSE（接收广播）
GET /api/students/:sid/stream
event: broadcast_start       # 教师开始广播
event: broadcast_end         # 教师结束广播
```

### 4.3 Agentic Evaluator 服务

统一的 Agent 调用入口，通过 `stepType` 分发不同的 system prompt：

```typescript
interface AgenticRequest {
  stepType: "t1_structure" | "t2_transitions" | "t3_writing" | "help_chat";
  studentInput: string;
  context?: {
    previousVersion?: string;
    previousEvaluation?: WritingEvaluation;
    revisionNumber?: number;
    conversationHistory?: Array<{ role: string; content: string }>;
  };
}

interface AgenticResponse {
  result: T1Evaluation | T2Evaluation | WritingEvaluation | string; // string for chat
  tokenUsage: { input: number; output: number };
}
```

后端实现要点：
- 所有 Agent 调用统一走 Jijian 平台的 agentic engine
- System prompt 按 stepType 从配置中读取（不硬编码在前端）
- 每次调用记录 token 消耗用于成本追踪
- 写作评估支持传入 previousVersion + previousEvaluation 实现"对比改进"功能

---

## 5. Agentic Prompt 详情

### 5.1 T1 — 结构分析评估

```
System: You are an English reading teacher for Chinese high school students.
The student highlighted sentences in "Ideal Beauty" and labeled them as topic sentence, point, evidence, or elaboration.

Reference answers:
- Topic sentence: "Ideas about physical beauty change over time and different periods of history reveal different views of beauty, particularly of women."
- P-E-E (paragraph 3):
  - Point: Beauty ideals change across historical periods
  - Evidence: Egyptian slim women, Venus of Hohle Fels, Rubens' plump pale women, Elizabethan pale skin = wealth
  - Elaboration: Each era's standard tied to cultural values

Be encouraging and precise. Respond ONLY with JSON.
```

输出 schema: `T1Evaluation`

### 5.2 T2 — 过渡词评估

```
System: You are an English teacher helping Chinese high school students find transitional expressions in "Ideal Beauty".

Key transitions (17 total): However, while (×3), but (×2), So, because, also, for instance, like, Today, In the early 1600s, In Elizabethan England, Within different cultures around the world, through the ages and across different cultures, Whether, over time

Respond ONLY with JSON.
```

输出 schema: `T2Evaluation`

### 5.3 T3 — 写作评估

```
System: You are a writing coach for Chinese high school students. Evaluate a 50-80 word paragraph about a beauty standard.

Criteria:
1. hasTopicSentence: Clear topic sentence stating the main idea
2. hasSpecificExample: At least one concrete cultural/historical example
3. usesTransitions: Appropriate transitional expressions

If this is a REVISION (previous feedback provided), comment on what improved and what still needs work.
Be encouraging but specific. Respond ONLY with JSON.
```

输入需附加 context（上一版文本+评分+修改建议），输出 schema: `WritingEvaluation`

### 5.4 Help Center — 对话

```
System: You are a friendly bilingual AI tutor for a Chinese high school English lesson on "Ideal Beauty" (beauty standards across cultures). Answer in 2-3 sentences, mix English and Chinese when helpful. Be encouraging and give hints rather than full answers for task questions.
```

输入: 完整消息历史。输出: 纯文本回复。

---

## 6. 教师端功能详情

### 6.1 Pulse bar（始终可见）

- 实时状态灯（绿色呼吸动画）
- 课程名 + "Teacher" 标签
- 全班场景分布条形图（每个颜色段显示人数）
- 总学生数

### 6.2 场景导航

与学生端相同的 7 场景导航，但教师可以自由跳转（不受进度限制）。

### 6.3 教学内容 + 教师专属 Hints（左侧）

每个场景的左侧展示**同样的教学内容**（与学生在 Lecture 场景看到的一致），加上**橙色 Teacher Hint 卡片**：

| 场景 | Hint 内容 |
|------|----------|
| L1 | "关注第 3 段 — P-E-E 结构最清晰，后面分析会用到" |
| T1 | "常见错误：学生把反问句当主题句。真正的主题句在第 3 段。如果很多人选错，broadcast 参考答案" |
| L2 | "学生常漏掉 'because' 作为过渡词 — 强调它的因果信号功能。'Today' 作为时间转换也容易被忽略" |
| T2 | "赵欣然只找到 2 个，需要提示。张雨桐找到 7/8，适合 broadcast 展示'完成态'" |
| L3 | "预期张雨桐类学生 5 分钟内拿到 3/3 — 用她的作品 broadcast 激励。0/3 的学生通常缺主题句" |
| T3 | "王浩然修改 3 次 (0→1→2) — 适合 broadcast 展示修改策略。考虑 v1 vs v3 对比展示" |
| T4 | "陈思远 (Mauritania+Western 对比)、林嘉怡 (白幼瘦本土视角)、吴佳琪 (纹身跨文化) — 不同角度的好范例" |

### 6.4 AI Insights（右侧面板顶部）

每个场景自动生成的自然语言总结，从学生交互数据中提炼：

- L1: 谁还卡在阅读阶段
- T1: 多少人完成、常见错误模式、具体学生举例
- L2: 过渡衔接建议
- T2: 平均采集数、最常被遗漏的词、薄弱学生
- L3: 写作前的预期管理建议
- T3: 评价总览、修改成功率、班级最弱维度、推荐 broadcast 候选人
- T4: 最终提交情况、适合讲评的角度

**PoC 阶段用 mock 数据硬编码，后续接 Jijian engine 实时生成。**

### 6.5 学生监控面板（右侧）

- Metrics: "At step" / "Evaluated" 人数
- 学生列表：按当前场景筛选，展示该场景的作品摘要
  - T1 场景：展示 Topic/Point/Evidence/Elaboration 的标注内容 + 分数
  - T2 场景：展示找到的过渡词列表 + 遗漏项
  - T3/T4 场景：展示写作版本时间线 + 每版三维度评分
- 每个学生行有 ⤢ 展开按钮 → 进入全屏学生详情面板
- 每个版本有 Broadcast 按钮

### 6.6 全屏学生详情

- 得分趋势柱状图（每次评价的分数变化）
- 三维度逐版本达标序列（TS: ✗→✓, Ex: ✗→✗→✓, Tr: ✗→✗→✗）
- 完整版本时间线：每版原文（大字衬线体）+ AI 三维度反馈 + 修改建议 + 进步备注
- 每个版本独立 Broadcast 按钮
- "← Back" 收起回到列表

### 6.7 Broadcast（广播讲评）

全屏遮罩层：
- 深色头部：学生姓名 + 版本号
- 中间：大字展示段落原文（适合投影）
- 底部：AI 三维度诊断三列卡片 + 修改建议

实现：教师端发 `broadcast` REST 请求 → 后端通过 SSE 推送到所有学生端 → 学生端弹出 overlay 展示。

---

## 7. 技术栈建议

### 7.1 前端

```
Framework: Next.js 14+ (App Router)
Language: TypeScript
Styling: Tailwind CSS
State: React hooks + Context（学生端）/ Zustand（教师端如需跨组件状态）
SSE Client: EventSource API
```

### 7.2 后端

```
Runtime: Node.js
Framework: Hono / Express
Database: PostgreSQL (生产) / SQLite (PoC)
ORM: Drizzle
Cache/SSE state: Redis (生产) / in-memory Map (PoC)
Agentic: Jijian engine API (或直接 Anthropic API for PoC)
```

### 7.3 项目结构建议

```
/
├── apps/
│   ├── web/                          # Next.js 前端
│   │   ├── app/
│   │   │   ├── student/              # 学生端页面
│   │   │   │   ├── [sessionCode]/    # 加入课堂
│   │   │   │   └── classroom/        # 课堂主界面
│   │   │   └── teacher/              # 教师端页面
│   │   │       ├── create/           # 创建课堂
│   │   │       └── dashboard/        # 教师 dashboard
│   │   ├── components/
│   │   │   ├── scenes/               # 7 个场景组件
│   │   │   │   ├── LectureL1.tsx
│   │   │   │   ├── TaskT1.tsx
│   │   │   │   ├── ...
│   │   │   ├── shared/
│   │   │   │   ├── HelpCenter.tsx    # 举手帮助中心
│   │   │   │   ├── NavBar.tsx        # 场景导航条
│   │   │   │   ├── RefPanel.tsx      # 参考面板（原文+交互）
│   │   │   │   └── Broadcast.tsx     # 广播 overlay
│   │   │   └── teacher/
│   │   │       ├── TeachContent.tsx   # 教学内容+hints
│   │   │       ├── StudentPanel.tsx   # 学生监控面板
│   │   │       ├── AIInsights.tsx     # AI 洞察
│   │   │       └── FullDetail.tsx     # 全屏学生详情
│   │   ├── hooks/
│   │   │   ├── useSSE.ts             # SSE 连接管理
│   │   │   ├── useAgent.ts           # Agent 调用封装
│   │   │   └── useHelpCenter.ts      # 帮助中心状态
│   │   └── lib/
│   │       ├── scenes.ts             # 场景配置
│   │       ├── prompts.ts            # Agentic prompts
│   │       ├── dummyReplies.ts       # 预设回复
│   │       └── types.ts              # TypeScript 类型定义
│   │
│   └── api/                          # 后端 API
│       ├── routes/
│       │   ├── sessions.ts
│       │   ├── students.ts
│       │   ├── artifacts.ts          # T1/T2 产物
│       │   ├── versions.ts           # 写作版本
│       │   ├── help.ts               # 帮助中心
│       │   ├── broadcast.ts
│       │   └── insights.ts
│       ├── services/
│       │   ├── agenticEvaluator.ts   # 统一 Agent 调用
│       │   ├── sseManager.ts         # SSE 连接管理
│       │   └── insightGenerator.ts   # AI 洞察生成
│       └── db/
│           ├── schema.ts             # Drizzle schema
│           └── migrations/
│
├── packages/
│   └── shared/                       # 前后端共享类型
│       └── types.ts
│
└── content/
    ├── reading-text.ts               # 原文内容
    ├── beauty-examples.ts            # 审美标准表
    ├── transitions.ts                # 过渡词列表+分类
    ├── highlights.ts                 # 高亮工具配置
    └── rubric.ts                     # 评价标准
```

---

## 8. 实现优先级

### Phase 1: 最小可运行闭环

1. 数据库 schema + migration
2. Session CRUD API (创建/加入/列表)
3. 学生端 7 场景 UI（已有 PoC JSX 可参考）
4. T3 写作 + 评估 Agent 调用（核心 agentic 闭环）
5. 写作版本 CRUD API

### Phase 2: 教师端基础

6. 教师端场景导航 + 教学内容
7. SSE 推送学生进度到教师端
8. 学生列表 + 写作版本查看
9. Broadcast API + 学生端 overlay

### Phase 3: 完整 Agentic

10. T1 结构分析 Agent
11. T2 过渡词评估 Agent
12. 帮助中心（预设 + AI 对话）
13. AI Insights 实时生成

### Phase 4: 打磨

14. Teacher hints 配置化
15. 预设问答管理后台
16. 帮助中心使用数据分析
17. 移动端适配（iPad 课堂场景）
18. 课型模板系统（从硬编码 → 可配置）

---

## 9. PoC 现有代码说明

### 9.1 文件清单

| 文件 | 说明 | 行数 |
|------|------|------|
| `ideal-beauty-student.jsx` | 学生端完整 React 组件 | ~344 |
| `ideal-beauty-teacher.jsx` | 教师端完整 React 组件 | ~256 |
| `student.html` | 学生端独立 HTML（浏览器直接打开） | ~360 |
| `teacher.html` | 教师端独立 HTML（浏览器直接打开） | ~270 |

### 9.2 PoC 限制

- 所有状态在内存（无持久化）
- 教师端用 mock 数据（18 个模拟学生）
- 无实时同步（学生和教师独立运行）
- Agent 调用直接从前端请求 Anthropic API（生产应走后端）
- 帮助中心的 dummy replies 硬编码
- 无认证/授权
- AI Insights 硬编码文本

### 9.3 从 PoC 迁移要点

1. 将 `callAgent()` 从前端移到后端 API
2. 将 mock 学生数据替换为数据库查询
3. 将内存状态替换为 API 调用 + SSE 推送
4. 将场景配置从硬编码提取到 `content/` 目录
5. 将 HelpCenter 的 dummy replies 移到配置文件

---

## 10. 阅读材料原文

完整原文 "Ideal Beauty" 见 PoC 代码中的 `FULL_TEXT_PARAS` 数组。包含 6 段：
1. Happiness Edem + 非洲增肥
2. 西方媒体的瘦身标准
3. 历史审美变迁（埃及→Venus→Rubens→伊丽莎白）
4. 跨文化身体改造（Borneo 纹身、Māori、纹身西方观感变化）
5. Myanmar 颈环、Indonesia 磨牙、鼻环/整形
6. 结尾总结：通过历史和文化，人们一直在改变身体和面孔

原文中可提取的 17 个过渡词/短语和分类见 `TRANS` + `TCAT` 变量。

句子级拆分（用于 T1 高亮交互）见 `SENTS` 数组。
