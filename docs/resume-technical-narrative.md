# 技术叙事：方法论驱动的 AI 教学系统

> 以"平方差公式"一堂课为主线，展开 Skill → MCP → Manifest Schema → Exercise Types → Socratic Discussion → Observer Engine → Teacher Dashboard 的完整链路。

**核心论点：** 壁垒不是平台基础设施（任何大团队都能重建 NestJS + SSE），而是"方法论驱动的领域建模"——把 Teachable Agent (Biswas et al., 2005)、Productive Failure (Kapur, 2008)、Protégé Effect (Chase et al., 2009) 等教育心理学研究编码为可执行的 JSON Schema + Skill + MCP Tool，让 AI 在方法论约束下与学生交互。

---

## 第零层：业务场景 — 为什么 ChatGPT 直接给答案不是教学

**痛点：** LLM 天然倾向"给出答案"，但教学需要"引导发现"。学生用 ChatGPT 做数学题，得到的是答案，而不是对概念的理解。

**Productive Failure 研究 (Kapur, 2008)：** 先让学生经历建设性失败，再给结构化指导，学习效果优于直接教学。实验表明，经历过失败的学生在迁移测试中表现显著优于直接接受指导的学生。

**核心矛盾：** 如何让 AI "知道答案但不直接给"？这需要：
1. 行为约束层 — 让 AI 在"有答案"的情况下主动选择不给
2. 交互协议 — 让 AI 只能通过"提问"而非"陈述"来推进教学
3. 兜底机制 — 学生确实无法前进时，以结构化方式揭示答案

**壁垒：** 需要同时理解教学法研究和 Agentic AI 工程。单纯的 NLP 工程师不懂 Productive Failure 的教学时机设计；单纯的教育研究者无法将其编码为 MCP 协议约束。

---

## 第一层：Manifest Schema — 方法论驱动的领域建模

以 `math-difference-of-squares/manifest.json` 为实例——一堂"平方差公式"的数学课。

### 关键结构

| 字段 | 作用 | 方法论来源 |
|------|------|------------|
| `readingSteps[]` | 教学环节序列（intro → explore-discover → apply-basic → …） | 教学设计序列化 |
| `phaseConfig[]` | 阶段流控（listen→practice→discuss→takeaway 顺序解锁） | Mastery Learning |
| `answerKey` | 11 种练习类型联合 schema（416 行 Zod） | 领域驱动设计 |
| `discoveryKey` | 引导发现 4 步 | 布鲁姆分类学认知层次 |
| `discuss` | 苏格拉底讨论配置 | Teachable Agent + Productive Failure |
| `observe` | 声明式可观测性（dimensions + issueRules） | 形成性评估 |

### 11 种练习题型（从教学场景逆推）

```
quiz / match / matrix / stance / order / select-evidence / map /
image-upload / rich-content-quiz / fill-blank / guided-discovery
```

每种题型不是"技术组件"，而是对应一种教学交互模式：
- `guided-discovery` — 4 步渐进发现（observation_choice → formula_blanks → derivation_blank → text_blanks）
- `rich-content-quiz` — 多小题 + 渐进脚手架（scaffold: threshold + levels）
- `stance` — 立场论证（validPositions + minEvidence）
- `select-evidence` — 文本证据标注（paragraphTokens + correctFunction）

### Guided Discovery 4 步对应布鲁姆分类学

| 步骤 | 类型 | 认知层次 | 教学目的 |
|------|------|----------|----------|
| 1 | `observation_choice` | 记忆/理解 | 观察计算结果，发现共同特征 |
| 2 | `formula_blanks` | 应用 | 用字母 a、b 表示规律 |
| 3 | `derivation_blank` | 分析 | 展开 (a+b)(a-b) 验证公式 |
| 4 | `text_blanks` | 综合/评价 | 用文字描述平方差公式 |

### `rejects` + `rejectHint` — 典型错误的领域编码

`formula_blanks` 中的 `rejects` 字段编码了学生的常见错误模式：
```json
{
  "accepts": ["a^2-b^2", "a²-b²"],
  "rejects": ["a^2+b^2", "ab"],
  "rejectHint": "注意运算符号：是减不是加哦"
}
```
这不是正则匹配，而是对"典型误解"的领域知识编码。

**关键文件：**
- `solutions/business/live-lesson/backend/src/schemas/answer-key.schema.ts` (416 行)
- `solutions/business/live-lesson/backend/src/schemas/manifest.schema.ts`
- `solutions/business/live-lesson/data/lessons/math-difference-of-squares/manifest.json`

---

## 第二层：Skill — 约束 AI 行为的教学法边界

Socratic Math Teacher SKILL.md（162 行）定义了 AI 的行为边界：

### 核心原则

1. **被动等待模型（Passive Waitress）** — AI 不主动教学，等待 `/explain` 命令。课程内容由前端播放系统自动展示。
2. **每次回应 ≤3 句 + 1 引导问题** — 强制苏格拉底式对话结构。
3. **禁止给答案** — "你知道正确答案，但绝对不能直接告诉学生"。
4. **禁止推进 beat** — 学生通过 UI 按钮控制课程进度，AI 无权推进。
5. **语言风格约束** — "有意思，那…" 而非 "对/错"，用「你认为…」「如果…」「为什么…」。

### 方法论基础

基于 **Teachable Agent** 研究 (Biswas et al., 2005) — AI 扮演"可教导同伴"比"全知教师"更能提升学生的元认知能力。当 AI 表现得"不知道答案但愿意一起探索"时，学生的解释行为（explaining behavior）增加，而解释是深度学习的关键机制。

**Protégé Effect** (Chase et al., 2009) 进一步证实：当学生认为自己在"教别人"时，投入度和学习效果均显著提升。Skill 的被动等待设计让 AI 成为"等待被教导的同伴"而非"全知教师"。

**关键文件：**
- `solutions/business/live-lesson/skills/socratic-teacher/SKILL.md` (162 行)

---

## 第三层：MCP Tools — AI 操控课堂的物理接口

8 个 MCP 工具（611 行），定义了 AI 能对课堂做什么：

| 工具 | 作用 | 教学法意义 |
|------|------|------------|
| `load_lesson` | 加载课程 manifest 并初始化状态机 | 课程生命周期 |
| `reveal_nodes` | 渐进式节点披露 | **Progressive Disclosure** |
| `highlight_nodes` | 闪烁/高亮特定节点 | 注意力引导 |
| `set_phase` | 更新教学阶段标签 | 阶段感知 |
| `advance_beat` | 原子教学节拍推进 | 微粒度教学控制 |
| `execute_dynamic_board` | 7 种黑板动作 | 个性化可视化解释 |
| `suggest_questions` | 困惑点推荐 | **Confusion-Point Priming** |
| `write_output` | 通用前端状态同步 | 平台机制 |

### 工具粒度是教学法驱动的

- `reveal_nodes` 实现 **Progressive Disclosure** — 信息渐进披露，防止认知过载
- `advance_beat` 返回 `beatState + narratorText + expectedQuestions + dynamicBoardActions` — 原子教学单元
- `execute_dynamic_board` 支持 7 种动作：`write / draw_line / draw_arc / highlight_box / erase / clear / pause`
- `suggest_questions` 实现 **Confusion-Point Priming** — 预设困惑点降低提问门槛（Zod: min 1 max 10, single/multi 模式）

### 状态管理

`state-manager.ts` — Factory-based 状态机 + SQLite 持久化 + session restore on startup。每个 MCP tool call 都是原子操作，失败时状态不变。

**关键文件：**
- `solutions/business/live-lesson/mcp-server/src/index.ts` (611 行)
- `solutions/business/live-lesson/mcp-server/src/state-manager.ts`

---

## 第四层：AI Prompt Builder — 6 层上下文栈

`ai-prompt-builder.ts`（705 行 + 644 行测试）构建 AI 调用的完整上下文：

### 上下文层级

| 层 | 内容 | 作用 |
|----|------|------|
| L1 | Role | 基于 `lessonType` 自适应（reading/math），动态切换角色定义 |
| L2 | Article 全文 | `¶N` 段落引用格式，学生端渲染为可点击高亮链接 |
| L3 | Step Context | label / strategy / focusParagraphs / description |
| L4 | Student Performance | score + byDimension 维度分析 + 学生作答数据 |
| L4.5 | Prior Observations | 该学生在本步骤的历史观察事件（**关键创新**） |
| L5 | Pedagogical Intent | manifest discuss 的教学意图 / systemPrompt |
| L6-L8 | Output format + rules | JSON schema + interaction type + depth 判断 |

### L4.5 Prior Observations — 关键创新

讨论环节的 AI 能看到"这个学生之前哪道题错了"：

```typescript
// L4.5: Prior observation context (if student has events in this step)
if (priorObservationContext) {
  layers.push(`【L4.5: Prior Observations for This Student】\n${priorObservationContext}`);
}
```

这实现了**个性化引导** — AI 不是对所有学生问同样的问题，而是基于"这个学生具体哪里有困难"来定制引导策略。

### `buildContinueChatPrompt` — 模式切换

讨论结束后，AI 从"先不给答案"切换到"答案揭示后深化"模式：

```typescript
layers[0] = `你是${subject}教学助手，学生已完成练习并看到了答案，现在在做延伸讨论。
你的目标是帮助学生深入理解。`;
```

### depth 判断对应布鲁姆分类学

```json
{"depth": "surface | partial | deep"}
```
- `surface` — 记忆/复述层
- `partial` — 理解/应用层
- `deep` — 分析/评价/创造层

**关键文件：**
- `solutions/business/live-lesson/backend/src/classroom/ai-prompt-builder.ts` (705 行)
- `solutions/business/live-lesson/backend/src/classroom/ai-prompt-builder.spec.ts` (644 行)

---

## 第五层：苏格拉底讨论 — Teachable Agent + Productive Failure 工程化

### 讨论配置（manifest `discuss` 字段）

以平方差公式"探索发现"步骤为例：

```json
{
  "openingQ": "观察这三道算式和结果，你发现了什么特征？",
  "goal": "学生能归纳出平方差公式 (a+b)(a-b)=a²-b²",
  "maxRounds": 6,
  "maxTimeSeconds": 240,
  "clusters": [
    { "id": "pattern-observe", "label": "特征观察" },
    { "id": "symbolic", "label": "符号归纳" },
    { "id": "verify", "label": "多项式验证" },
    { "id": "verbal", "label": "文字描述" }
  ],
  "targetPoints": [
    { "id": "tp_1_1", "label": "特征观察", "description": "发现一和一差、平方减平方" },
    { "id": "tp_1_2", "label": "符号归纳", "description": "能用 a、b 表示：(a+b)(a-b)=a²-b²" },
    { "id": "tp_1_3", "label": "多项式验证", "description": "展开验证等式成立" },
    { "id": "tp_1_4", "label": "文字描述", "description": "用文字描述规律" }
  ],
  "fallbackMC": { "question": "...", "options": [...], "correctIndex": 1, "explanation": "..." }
}
```

### ClusterClassifier（125 行）— LLM 实时分类

对每轮学生发言进行实时认知分类：

```typescript
{
  cluster_id: "pattern-observe" | "symbolic" | "verify" | "verbal" | "other",
  confidence: "high" | "medium" | "low",
  evidence_span: "学生原话片段",
  event_type: "new_signal" | "reinforcing" | "state_change",
  is_highlight: boolean,
  target_point_hits: [{ target_point_id, confidence, evidence_span }]
}
```

- `event_type: "state_change"` — 追踪"认知转变"（对应 Conceptual Change Theory），替代传统 Bayesian Knowledge Tracing
- `target_point_hits` — 一条发言可命中多个目标点，实现多维认知追踪
- `is_highlight` — 思考质量判断（"用自己的话解释核心概念"而非"简单复述"）

### Productive Failure 兜底机制

`fallbackMC` — 超时（240s）或超轮次（6轮）后触发选择题 + 完整解析：

> "先让学生尝试归纳，实在归纳不出来再给答案，但一定要给且给完整解析"

这正是 Productive Failure 的工程化实现：失败是允许的，但不能让学生在失败中结束——必须有结构化的知识揭示。

### DiscussPhase.tsx（719 行）

前端组件编排：StatusBar + ClusterTracker + ScaffoldChips + FallbackMC + ContinueChat

**关键文件：**
- `solutions/business/live-lesson/backend/src/classroom/socratic-discuss/cluster-classifier.ts` (125 行)
- `solutions/business/live-lesson/frontend/src/components/student/discuss/DiscussPhase.tsx` (719 行)

---

## 第六层：Observer Engine + 教师仪表盘

### Observer Engine（平台层 `@kedge-agentic/observer-engine`）

平台级可观测引擎，通过声明式配置驱动：

- `@ObserverHandler` 装饰器自动发现事件处理器（NestJS module integration）
- `HandlerContext` 注入：getObservations / getAllObservations / llm / notify / logger
- `ObservationOp` 原子操作：append / update
- 事件级联（cascade）：handler 可 emit 新事件触发其他 handler

### 声明式可观测性

manifest 声明 `dimensions[]` + `issueRules[]`，新增题型不改引擎代码：

```typescript
// observation.schema.ts
ObservationDefSchema = z.object({
  dimensions: z.array(ObserveDimensionSchema),   // 观测维度
  issueRules: z.array(ObserveIssueRuleSchema),   // 问题规则
  surfaces: z.array(ObserveSurfaceSchema),       // 展示面
});

// issueRules 示例
{ dimension: "Q1", condition: "wrong_pct_gte", threshold: 40, template: "Q1 错误偏高" }
```

### Live-Lesson 6 个事件处理器

| Handler | 触发事件 |
|---------|----------|
| `JoinHandler` | 学生加入 |
| `ExerciseHandler` | 提交练习 |
| `ChatTurnHandler` | AI 对话轮次 |
| `StatusChangeHandler` | 状态变化（stuck/idle） |
| `StepCompleteHandler` | 步骤完成 |
| `SystemEventHandler` | 系统事件 |

### MetricsAggregator 实时聚合

```typescript
{
  completionRate, avgScore, byDimension: Record<string, {good, partial, wrong}>,
  alertTag: "Q1 错误偏高" | "5 人卡住",
  issues: ["7 人Q1 选了 C（应为 B）"]
}
```

### 教师仪表盘三 tab

| Tab | 组件 | 数据源 |
|-----|------|--------|
| 讨论洞察 | `DiscussInsightTab` | ClusterAggregator 统计 + 观察日志 |
| 学生分析 | `SummaryTab` | 象限分析、薄弱维度、候选学生 |
| 课堂状态 | `ClassroomStatusTab` | 实时告警 + 教练提示 + LLM 洞察 |

### ClusterAggregator — 实时观点分布统计

聚合所有学生的 cluster 分类结果，教师实时看到"全班有多少人达到了 symbolic 层次"。

**关键文件：**
- `packages/observer-engine/src/core/interfaces.ts` (142 行)
- `solutions/business/live-lesson/backend/src/schemas/observation.schema.ts` (57 行)
- `solutions/business/live-lesson/backend/src/classroom/socratic-discuss/cluster-aggregator.ts`

---

## 第七层：平台基础设施 — 让领域模型可执行

### 量化概览

| 维度 | 数据 |
|------|------|
| 平台 DB entities | 32 |
| 平台 services | 50 |
| 平台 controllers | 30 |
| Agent Engine | subprocess + stream-json + MCP tool call 检测 + SSE 广播 |
| React SDK | 17 hooks |
| Vue SDK | 30+ composables |
| 安全 | API Key SHA-256 + 10 scopes + RPM/RPD 限流 + monthly token quota |
| 断连恢复 | SSE sequence-based replay |
| 文档编辑 | entity-document Block↔Markdown 双向变换 + TransformRegistry 插件 |
| AI 编辑抽象 | DocumentEditProvider 基类 |
| 质量门 | Harness 12-check ratchet |

### 平台与领域分离

| 平台层（可复制） | 领域层（难复制） |
|------------------|------------------|
| Agent Engine 生命周期 | Skill 定义（socratic-teacher, 162 行） |
| MCP tool call 检测 + SSE | 8 个具体工具实现（611 行教学语义） |
| Observer Engine 引擎 | 6 个事件处理器 + 声明式 observe 配置 |
| SSE sequence replay | Manifest Schema + Answer Key（11 题型 416 行 Zod） |
| API Key / multi-tenant | Grading Service（11 graders） |
| entity-document Block↔MD | AI Prompt Builder（705 行 6 层上下文栈） |

---

## 总结：两层护城河

### 护城河一（平台，可复制但成本高）

Agent Engine 生命周期 + MCP 协议集成 + Observer Engine + SSE replay + entity-document + 12-check harness + 32 entities / 50 services / 30 controllers

→ 任何足够大的团队投入 6-12 个月可以重建。

### 护城河二（领域编码，极难复制）

- 11 种题型 Zod schema — 从教学场景逆推的交互模式
- Socratic Teacher Skill — 行为约束编码
- 6 层 Prompt 架构 — L4.5 Prior Observations 实现个性化引导
- ClusterClassifier 认知追踪 — LLM + 领域约束替代传统 BKT
- 声明式可观测性 — dimensions + issueRules 可扩展教学观测
- Productive Failure 兜底机制 — fallbackMC 工程化"建设性失败"
- Guided Discovery 4 步 — 布鲁姆分类学认知层次的代码映射

→ 需要同时理解教学法研究（Teachable Agent / Productive Failure / Protégé Effect / Bloom's Taxonomy / Conceptual Change Theory）**和** Agentic AI 工程（Skill / MCP / Observer Engine），并把前者编码为后者可执行的领域模型。

**这种交叉能力的稀缺性才是真正的技术壁垒。**

---

## 参考文献

- Biswas, G., Leelawong, K., Schwartz, D., Vye, N., & The Teachable Agents Group at Vanderbilt (2005). Learning by teaching: A new agent paradigm for educational software. *Applied Artificial Intelligence*, 19(3-4), 363-392.
- Kapur, M. (2008). Productive failure. *Cognition and Instruction*, 26(3), 379-424.
- Chase, C. C., Chin, D. B., Oppezzo, M. A., & Schwartz, D. L. (2009). Teachable agents and the protégé effect: Increasing the effort towards learning. *Journal of Science Education and Technology*, 18(4), 334-352.
- Anderson, L. W., & Krathwohl, D. R. (Eds.) (2001). *A Taxonomy for Learning, Teaching, and Assessing: A Revision of Bloom's Taxonomy of Educational Objectives.* Longman.
- Posner, G. J., Strike, K. A., Hewson, P. W., & Gertzog, W. A. (1982). Accommodation of a scientific conception: Toward a theory of conceptual change. *Science Education*, 66(2), 211-227.
