# Exercise Types 参考手册

## 概述

Live Lesson 系统支持 7 种 exercise type，覆盖从选择题到 2D 坐标拖拽的多种互动形式。

### 系统架构简图

```
manifest.json (readingSteps[n].answerKey)
  ↓ lesson.service.ts seed → SQLite DB
  ↓ GET /api/lessons/:id/manifest → sanitizeManifest() 剥离答案
  ↓ 前端收到 ExerciseSpec（题目结构，无 correct/hint/walkthrough）
task-data.ts (TaskExercise 类型)
  ↓ 运行时注入到 Task.exercise
PracticePhase.tsx (条件渲染)
  ↓ 按 type 分发到对应组件
[Quiz|Match|Matrix|Stance|Order|SelectEvidence|Map]Exercise.tsx
  ↓ 用户交互 → ans 状态
formatSubmitData() → POST /api/classroom/:code/submit
  ↓ { studentId, step, data }
GradingService → [Type]Grader → GradeResult { total, byDimension }
```

### 共用概念

| 概念 | 说明 |
|------|------|
| `answerKey` | 位于 `manifest.readingSteps[n].answerKey`，`type` 字段决定渲染哪个组件 |
| `step` | 后端按 readingStep idx 标识学生提交的步骤 |
| `submit` | 前端 `formatSubmitData(type, ans, meta?)` 格式化后经 `ctx.submit(stepIdx, data)` 发送 |
| `GradeResult` | `{ total: number, byDimension: Record<string, boolean \| number>, attemptCounts?, llmFeedback?, llmItems? }` |
| `byDimension` | 各维度评分，key 风格因 type 而异（如 `q0`, `p1`, `place`, `position`） |

---

## 内容创作指南（面向课程设计者 / Agent）

### 通用规则

1. **answerKey 位置**：`manifest.readingSteps[n].answerKey`，每个 `type: "task"` 的 step 必须有
2. **`type` 字段**决定前端渲染哪个组件和后端使用哪个 Grader
3. **manifest API 已剥离答案**：`lesson.service.ts` 在返回前调用 `sanitizeManifest()`，前端只能看到 `ExerciseSpec`（题目结构，无 correct/hint/walkthrough）
4. **hint / hintZh**：每个 item 可选提供英文 hint + 中文翻译，错误时展示
5. **walkthrough / walkthroughZh**：可选，2 次错误后展示详细解析

---

### Quiz

多选一题，每题独立评分，错误可重试。

#### answerKey schema

```jsonc
{
  "type": "quiz",
  "answers": [
    {
      "questionIdx": 0,                    // 题目索引（0-based）
      "correct": 1,                        // 正确选项索引（0-based）
      "questionText": "问题文本",
      "questionTranslate": "问题中文翻译",
      "options": ["A", "B", "C", "D"],     // 选项列表
      "label": "Q1",                       // 可选，维度标签（用于 dashboard 展示）
      "hint": "英文提示",                   // 错误后显示
      "hintZh": "中文提示",
      "walkthrough": "详细解析（英文）",     // 2次错误后显示（可选）
      "walkthroughZh": "详细解析（中文）"    // 可选
    }
  ]
}
```

#### 实际示例

```json
{
  "type": "quiz",
  "answers": [
    {
      "questionIdx": 0,
      "correct": 1,
      "questionText": "What did Happiness Edem do to become \"beautiful\"?",
      "questionTranslate": "Happiness Edem 为了变\"美\"做了什么？",
      "options": [
        "Went on a diet to become slim",
        "Gained weight in a fattening room",
        "Got cosmetic surgery",
        "Started a fashion brand"
      ],
      "hint": "Look at ¶1: what happened to her **weight**? Did it go up or down?",
      "hintZh": "看 ¶1，她的**体重**发生了什么变化？增加还是减少？",
      "walkthrough": "Read the 2nd sentence of ¶1: *'She spent six months in a **fattening room**...'* → B",
      "walkthroughZh": "读 ¶1 第 2 句：*'She spent six months in a **fattening room**...'* → B"
    }
  ]
}
```

#### 创作注意事项

- 选项建议 3-4 个，确保干扰项合理但可排除
- `correct` 是 0-based 索引（0 = 第一个选项）
- hint 应指向具体段落位置，帮学生定位而非直接给答案
- hint 支持 `**bold**` markdown 语法
- walkthrough 是完整解析，包含引用原文 + 推理过程

---

### Match

左右匹配题，左侧为题干，右侧为选项，每对独立评分。

#### answerKey schema

> **注意**：当前没有 manifest 使用 match 类型的实例。以下 schema 参照 quiz 的 manifest 模式（既含展示字段又含评分字段）+ backend MatchGrader 的评分逻辑推导而成。首次使用时需验证前端注入逻辑是否完整。

```jsonc
{
  "type": "match",
  "options": ["选项A", "选项B", "选项C"],  // 可选：所有配对共享的右侧候选项
  "answers": [
    {
      "pairIdx": 0,                    // 配对索引（0-based）
      "left": "左侧题干文本",           // 前端展示用
      "options": ["选项A", "选项B", "选项C"],  // 可选：此配对专用的候选项（优先于顶层 options）
      "correct": "正确答案文本",         // 后端评分用（字符串，不区分大小写）
      "hint": "英文提示",
      "hintZh": "中文提示",
      "walkthrough": "详细解析",        // 可选
      "walkthroughZh": "中文解析"       // 可选
    }
  ]
}
```

> **options 来源规则**：每个 answer 优先使用自身的 `options`，如无则回退到顶层 `options`。Zod schema 要求至少其中一处必须有 `options`。

#### 前端数据结构

前端通过 `GET /api/classroom/:code/steps/:step/exercise` 获取 `ExerciseSpec`，其中 match 类型返回：

```typescript
// ExerciseSpec (student-safe, no answers)
{
  type: 'match',
  label: '...',
  pairs: [{ idx: 0, left: '左侧题干', options: ['选项A', '选项B', '选项C'] }]
}
```

前端提交时使用选项文本（不是索引），后端 `MatchGrader` 做大小写不敏感的文本匹配。

#### 创作注意事项

- **后端评分**使用文本匹配（`correct.toLowerCase()` vs 学生选项文本），不依赖索引
- 每对的 `options` 可以不同，也可以共享同一组选项
- 错误后自动展示 hint，2 次错误后展示 walkthrough
- **manifest 中务必同时写 `left`、`options`、`correct`**——缺少展示字段前端无法渲染

---

### Matrix

信息矩阵表，3 列结构：Where/When | What they do | Why。支持 demo 行（预填示例）。

#### answerKey schema

```jsonc
{
  "type": "matrix",
  "answers": [
    {
      "rowIdx": 0,
      "place": "Ancient Egypt",          // Where/When 列
      "practice": "slim dark-haired women in paintings",  // What 列
      "reason": "beauty ideal / normal practice",         // Why 列
      "isDemo": true,                    // 是否为示例行（不评分）
      "hint": "英文提示",                // isDemo=false 时可选
      "hintZh": "中文提示"
    },
    {
      "rowIdx": 1,
      "place": "1600s Europe",
      "practice": "plump and pale-skinned",
      "reason": "wealth",
      "hint": "In ¶4, what body type was \"**the most stunning**\" beauty?",
      "hintZh": "在 ¶4 中，什么体型是 \"**the most stunning**\" 的美？"
    }
  ]
}
```

#### 创作注意事项

- **isDemo 行**：第一行通常设为 `isDemo: true`，前端自动预填，不计入评分
- 非 demo 行必须提供 `place`、`practice`、`reason` 作为参考答案
- 后端评分使用模糊匹配（`includes` 双向），不要求精确一致
- 三列分别评分，各出百分比 → 取平均 = total
- hint 建议指向具体段落 + 关键短语

---

### Stance

立场选择 + 证据多选，考察观点论证能力。

#### answerKey schema

```jsonc
{
  "type": "stance",
  "validPositions": ["I agree", "I partly agree", "I disagree"],  // 合法立场列表
  "minEvidence": 2,           // 最少证据条数
  "stanceQ": "问题文本（英文）",
  "stanceQZh": "问题文本（中文）",
  "stanceOpts": ["I agree", "I partly agree", "I disagree"],  // 前端显示的立场按钮
  "evidence": [               // 前端显示的证据列表
    "Ancient Egypt: slim dark-haired women were the beauty ideal",
    "1600s Europe: plump + pale = beauty (different from today)",
    "Borneo: tattoos as a diary of life events"
  ]
}
```

#### 创作注意事项

- `validPositions` 用于后端评分验证（不区分大小写）
- `stanceOpts` 用于前端渲染按钮，通常与 `validPositions` 一致
- `evidence` 列表通常从前面步骤的矩阵/练习中提炼
- `minEvidence` 建议设为 2，确保学生至少用多条证据支撑
- 评分逻辑：立场合法 + 证据充足 = 100 分，只满足一个 = 50 分，都不满足 = 0 分
- 这是"软评分"类型——任何合法立场都算对，重点考察论证能力

---

### Order

排序题，将打乱的条目排成正确顺序。

#### answerKey schema

```jsonc
{
  "type": "order",
  "items": [
    "Scanning — find specific details",       // index 0
    "Predicting — read the title, ask questions", // index 1
    "Evaluating — form your own judgment",    // index 2
    "Skimming — find the structure quickly"   // index 3
  ],
  "correctOrder": [1, 3, 0, 2]  // 正确顺序：items[1], items[3], items[0], items[2]
}
```

#### 创作注意事项

- `items` 数组以**乱序**列出选项
- `correctOrder` 是索引数组，表示正确排列应为 `items[correctOrder[0]]`, `items[correctOrder[1]]`, ...
- 上例表示正确顺序是：Predicting → Skimming → Scanning → Evaluating
- 前端用点击选择方式排序，错误后清空重来
- 错误时自动显示全局 hint，不是逐题 hint
- 后端 Grader 使用文本匹配（将学生的 label 与 items 中的文本对比）

---

### Select Evidence

最复杂的题型——分段 function 识别 + 文本证据定位（token 点击），支持 TextPanel overlay 交互。

#### answerKey schema

```jsonc
{
  "type": "select-evidence",
  "functionOptions": ["History", "Culture", "Conclusion"],
  "sections": [
    {
      "id": "p34",                      // section 唯一标识
      "label": "¶3-4",                  // 前端显示标签
      "range": [3, 4],                  // 覆盖的段落编号
      "correctFunction": "History",     // 正确的 function 选择
      "hint": "英文提示",
      "hintZh": "中文提示",
      "aiCorrect": "全部正确时的 AI 反馈（支持 **markdown**）",
      "aiPartial": "部分正确时的 AI 反馈"
    }
  ],
  "paragraphTokens": {
    "1": [                              // 段落编号 → token 数组
      { "t": "In " },                  // 普通文本（不可点击）
      {
        "t": "many parts of Nigeria",
        "kind": "distractor",           // 可点击但选错了
        "why": "A place — but ¶1-2 isn't about places."
      },
      { "t": ", it is traditional..." },
      {
        "t": "\"fattening rooms\"",
        "kind": "pick"                  // 可点击，但不是关键证据
      },
      {
        "t": "being fat is a sign of wealth",
        "kind": "evidence",             // 正确证据
        "why": "Names ONE side of the conflict."
      }
    ]
  }
}
```

#### paragraphTokens 详解

每个段落的文本被切分为 token 数组，每个 token 有：

| 字段 | 类型 | 说明 |
|------|------|------|
| `t` | `string` | token 文本内容 |
| `kind` | `'evidence' \| 'pick' \| 'distractor'` | 可选。无 kind = 普通文本（不可点击） |
| `why` | `string` | 可选。评分后的解释（为什么是/不是证据） |

**kind 含义**：
- **`evidence`**：正确的信号/证据短语。学生应该点选
- **`pick`**：可点击但不是证据的内容（如具体细节）。选了不扣分但也不得分
- **`distractor`**：可点击的干扰项。选了会被标红并在反馈中解释为什么不对

#### sections 详解

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | section 唯一标识，用于提交数据的 key |
| `label` | `string` | 是 | 前端 strip 按钮上显示的标签 |
| `range` | `number[]` | 是 | 覆盖的段落编号数组 |
| `correctFunction` | `string` | 是 | 正确的 function（必须在 `functionOptions` 中） |
| `hint` | `string` | 否 | "Stuck?" 按钮展开的提示 |
| `hintZh` | `string` | 否 | 中文提示 |
| `aiCorrect` | `string` | 否 | 全部证据正确时的 AI 反馈（支持 `**bold**`） |
| `aiPartial` | `string` | 否 | 部分正确时的 AI 引导 |

#### 创作注意事项

- **Token 切分原则**：按语义单元切分，每个 evidence/distractor/pick 是一个独立 token，其余文本合并为普通 token
- **evidence 是必选项**：前端统计 hit/total 基于 evidence 数量
- **distractor 要写好 why**：这是教学的核心——解释为什么它看起来对但不是结构信号
- **pick 是中性项**：可点击但选了没有惩罚，也没有收益
- **每个 section 的 range 中的段落**必须在 `paragraphTokens` 中有对应条目
- **functionOptions** 全局共享，所有 section 从中选择
- 这个题型有**两步流程**：先选 function → 再点选证据。两步都正确才算完成
- overlay 机制：前端通过 `onOverlayChange` 将 token 状态同步到 TextPanel，实现文本面板的高亮交互

---

### Map

2D 坐标平面拖拽 + 理由论述，考察多维分类与批判性思维。学生将 item chip 拖到二维坐标平面上，并为每个放置写理由。

#### answerKey schema

```jsonc
{
  "type": "map",
  "prompt": "Each chip below is one beauty practice from the text. Drag it onto the plane based on **two questions**, then explain *why* you placed it where you did.",
  "axes": {
    "x": { "neg": "Just appearance", "pos": "Cultural meaning", "label": "Why is it done?" },
    "y": { "neg": "Temporary", "pos": "Permanent", "label": "How lasting is it?" }
  },
  "items": [
    { "id": "kohl", "label": "Egyptian kohl", "hint": "¶3", "refs": [3] },
    { "id": "plump", "label": "1600s plump & pale", "hint": "¶4", "refs": [4] }
  ],
  "expected": {                          // 教师预设的参考坐标（仅后端评分用，不发给学生）
    "kohl": [0.55, -0.2],               // [x, y]，范围 [-1, 1]
    "plump": [-0.4, -0.5]
  },
  "minReasonLength": 8                  // 每条理由最少字符数（默认 8）
}
```

#### 实际示例

见 `data/lessons/ideal-beauty-reading/manifest.json` Task 4（readingStep idx 8）的 answerKey。使用 `cultural_permanence` 预设：X 轴 = 外表/文化含义，Y 轴 = 临时/永久。

#### 前端数据结构

前端收到的 `ExerciseSpec`（经 `sanitizeMap()` 剥离后）：

```typescript
{
  type: 'map',
  label: '...',
  prompt: '...',                           // 支持 **bold** 和 *italic*
  axes: {
    x: { neg: 'Just appearance', pos: 'Cultural meaning', label: 'Why is it done?' },
    y: { neg: 'Temporary', pos: 'Permanent', label: 'How lasting is it?' }
  },
  mapItems: [                              // 注意：schema 层 items → ExerciseSpec 层 mapItems
    { id: 'kohl', label: 'Egyptian kohl', hint: '¶3', refs: [3] },
    ...
  ],
  minReasonLength: 8
}
// 注意：expected 字段被 sanitizeMap() 剥离，学生看不到参考坐标
```

#### 交互流程

1. **Chip 托盘**：未放置的 item 显示为水平排列的 chip 按钮
2. **放置**：点击 chip → 点击坐标平面放置；或直接拖拽已放置的 chip 移动位置
3. **坐标平面**：`aspect-ratio: 1/1`，4×4 网格 + 十字线 + 四端轴标签。坐标归一化为 `[-1, 1]`，Y 轴向上为正
4. **理由卡片**：每个已放置 chip 下方出现理由卡片，包含：
   - 轴象限摘要（X: Cultural meaning, Y: Temporary）
   - 文本输入框 + 字符计数
   - "Return ↩" 按钮可撤回放置
5. **完成条件**：所有 item 均已放置 **且** 每条理由 ≥ `minReasonLength` 字符
6. **进度条**：显示 `{reasonedCount}/{totalItems}` 的完成进度

#### 提交数据格式

```typescript
{
  placements: { "kohl": { x: 0.55, y: -0.2 }, "plump": { x: -0.4, y: -0.5 }, ... },
  reasons: { "kohl": "Kohl had spiritual meaning in ancient Egypt...", ... }
}
```

#### 评分算法

| 维度 | 算法 |
|------|------|
| Completion | `bothCount / totalItems × 100`。`bothCount` = 同时放置 + 理由达标的 item 数 |
| Position | 每个已放置 item 与 `expected` 的欧氏距离，归一化为 0-100（最大距离 2√2 ≈ 2.83）。无 expected → 100 |
| **ruleTotal** | `(completion + avgPosition) / 2`，四舍五入 |
| LLM relevance | 对每条达标理由调用 GLM 评估相关性（`relevant: true/false`）。relevanceRate = 相关条目数 / 总条目数 |
| **total** | LLM 可用时：`ruleTotal × 0.7 + relevanceRate × 100 × 0.3`。LLM 不可用时：`ruleTotal` |

`byDimension` key 格式：

| Key | Type | 说明 |
|-----|------|------|
| `{id}_placed` | `boolean` | 该 item 是否已放置 |
| `{id}_reasoned` | `boolean` | 该 item 理由是否 ≥ minReasonLength |
| `{id}_positionScore` | `number` | 该 item 位置得分 0-100 |

#### 创作注意事项

- **坐标范围**：`expected` 中每个值必须在 `[-1, 1]` 范围内（schema 强制验证）
- **prompt** 支持 `**bold**` 和 `*italic*` markdown 语法（前端用 React 节点渲染，非 dangerouslySetInnerHTML）
- **refs** 可选——用于标记 item 关联的段落号，将来可实现 TextPanel 高亮联动
- **hint** 可选——显示在 chip 旁的段落引用（如 "¶3"），帮助学生定位原文
- **minReasonLength** 默认 8，建议不低于 5。太长会阻碍低水平学生
- **expected 不发给学生**——`sanitizeMap()` 会剥离此字段。如果不提供 expected，位置评分全部给 100（只考察完成度）
- 这是"软评分"类型——与 matrix/stance 一样，submit 即完成，不会要求重做
- 设计参考文件：`design/surfaces/practice-map-app.jsx`

---

## 技术架构（面向开发者）

### 数据流

```
manifest.json
  ↓ lesson.service.ts seed → SQLite DB
  ↓ GET /api/lessons/:id/manifest
  ↓ LessonService → sanitizeManifest() → 剥离 correct/hint/walkthrough
  ↓ 前端收到 ExerciseSpec（题目结构，无答案）
task-data.ts (TaskExercise interface)
  ↓ useClassroom.ts 将 sanitized answerKey 注入 Task.exercise
PracticePhase.tsx
  ↓ 按 ex.type 条件渲染对应组件
[Type]Exercise.tsx (用户交互)
  ↓ ans 状态 → formatSubmitData(type, ans, meta?)
POST /api/classroom/:code/submit { studentId, step, data }
  ↓ ClassroomService → GradingService.grade(rawAnswerKey, data)
  ↓ AnswerKeySchema.safeParse() → 类型窄化 → graders/[type].grader.ts
  ↓ GradeResult → 存入 reading_submissions 表 + SSE broadcast
```

### 组件映射表

| type | Component | Has TextPanel Overlay | Grading Split | Submit Button |
|------|-----------|----------------------|---------------|---------------|
| `quiz` | `QuizExercise` | No | Frontend `gradeItemSet` + Backend `QuizGrader` | PracticePhase 统一按钮 |
| `match` | `MatchExercise` | No | Frontend `gradeItemSet` + Backend `MatchGrader` | PracticePhase 统一按钮 |
| `matrix` | `MatrixExercise` | No | Backend `MatrixGrader` only | PracticePhase 统一按钮 |
| `stance` | `StanceExercise` | No | Backend `StanceGrader` only | PracticePhase 统一按钮 |
| `order` | `OrderExercise` | No | Frontend order check + Backend `OrderGrader` | PracticePhase 统一按钮 |
| `select-evidence` | `SelectEvidenceExercise` | **Yes** (token overlay) | Frontend visual + Backend `SelectEvidenceGrader` | 组件内部按钮（`canSub()` 返回 false） |
| `map` | `MapExercise` | No | Backend `MapGrader` only | PracticePhase 统一按钮（全放置+全理由达标后可提交） |

### 提交格式对照表

| type | `formatSubmitData` 输出 | 示例 |
|------|------------------------|------|
| `quiz` | `{ answers: [0, 1, 2], attemptCounts: { 0: 1, 1: 2 } }` | answers[i] = 学生选的选项索引 |
| `match` | `{ pairs: ['skimming', 'scanning'], attemptCounts: { 0: 1 } }` | pairs[i] = 学生选的选项文本（字符串） |
| `matrix` | `{ rows: [...] }` | 来自 ans.rows |
| `stance` | `{ position: 'I agree', evidence: [0, 2, 5] }` | position = 立场文本（字符串），evidence = 证据索引数组 |
| `order` | `{ order: ['Predicting', 'Skimming', ...] }` | 学生排列的 items 文本标签（字符串数组或 `{label}` 对象数组） |
| `select-evidence` | `{ sections: { "p34": { function: "History", picked: ["3:1", "3:3"] } } }` | key=sectionId, picked=`paraNum:tokenIdx` 数组 |
| `map` | `{ placements: { "kohl": { x: 0.55, y: -0.2 } }, reasons: { "kohl": "..." } }` | placements=坐标对象, reasons=理由文本 |

### 评分对照表

| type | Grader 类 | 算法摘要 |
|------|-----------|----------|
| `quiz` | `QuizGrader` | 逐题比较 `studentAnswers[questionIdx] === correct`。byDimension key 格式 `q{idx}`，值为 boolean。total = correctCount / totalCount × 100 |
| `match` | `MatchGrader` | 逐对比较 `studentPair.toLowerCase() === correct.toLowerCase()`。接受 `data.pairs` 或 `data.answers`（兼容），每项可以是 `string` 或 `{value: string}`。byDimension key 格式 `p{idx}`。total = correctCount / totalCount × 100 |
| `matrix` | `MatrixGrader` | 跳过 `isDemo` 行。place 列用**单向** `includes`（学生输入须包含答案文本），practice/reason 列用**双向** `includes` 模糊匹配。byDimension = `{ place: %, practice: %, reason: % }`。total = 三列平均 |
| `stance` | `StanceGrader` | 检查 position ∈ validPositions（学生侧 `toLowerCase()`，但 validPositions 不转换——见已知限制 #6）+ evidence.length ≥ minEvidence。byDimension = `{ position: bool, evidence: bool }`。total: 都满足=100，一项=50，都不=0 |
| `order` | `OrderGrader` | 先将 `correctOrder` 索引解析为 `items[idx]` 标签，再逐位与学生提交的文本对比（不区分大小写）。全对=100，否则=0。byDimension = `{ correct: bool }` |
| `select-evidence` | `SelectEvidenceGrader` | 逐 section 评分。function 正确时 `0.3 + 0.7 * evidenceScore`，错误时 `0.3 * evidenceScore`（function 错则 evidence 也被惩罚到 30% 权重）。evidenceScore = recall × precisionFactor，precision = `max(0, 1 - wrongPicks/totalEvidence)`。byDimension 包含 `{secId}_func`, `{secId}_hit`, `{secId}_total`, `{secId}_wrong`, `sectionsCompleted`, `sectionsTotal`。total = 所有 section 均分 × 100 |
| `map` | `MapGrader` | completion = 同时放置+理由达标的 item 占比 × 100。position = 每个已放置 item 与 expected 的欧氏距离归一化 0-100 的均值（无 expected → 100）。ruleTotal = (completion + position) / 2。**LLM 评估**（可选）：对每条理由评估相关性，relevanceRate = 相关条目数 / 总条目数，adjustedTotal = ruleTotal × 0.7 + relevanceRate × 100 × 0.3。LLM 不可用时 fallback 为 ruleTotal。byDimension = `{id}_placed: bool`, `{id}_reasoned: bool`, `{id}_positionScore: number`。llmFeedback / llmItems 仅在 LLM 成功时填充 |

### 前端评分 vs 后端评分

| type | 前端评分 | 后端评分 |
|------|----------|----------|
| `quiz` | `gradeItemSet()` — 即时反馈对错，支持重试 | `QuizGrader` — 持久化最终分数 |
| `match` | `gradeItemSet()` — 同 quiz | `MatchGrader` — 持久化 |
| `matrix` | 无前端评分（开放题） | `MatrixGrader` — 模糊匹配 |
| `stance` | 无前端评分（软提交） | `StanceGrader` — 验证立场+证据数 |
| `order` | `PracticePhase` 内直接比较 `correctOrder` | `OrderGrader` — 持久化 |
| `select-evidence` | 组件内 `feedback` 计算（visual feedback） | `SelectEvidenceGrader` — 持久化 |
| `map` | 无前端评分（全放置+理由达标后软提交） | `MapGrader` — 持久化 |

### 添加新 exercise type 的步骤

1. **TaskExercise interface**（`frontend/src/components/student/task-data.ts`）
   - 在 `type` union 加入新类型名
   - 添加该类型需要的字段

2. **新建组件**（`frontend/src/components/student/exercises/XxxExercise.tsx`）
   - 实现交互 UI，接收 exercise 数据和 `ans`/`setAns` 等 props

3. **PracticePhase 挂载**（`frontend/src/components/student/PracticePhase.tsx`）
   - 添加 `{ex.type === 'xxx' && <XxxExercise ... />}`
   - 更新 `canSub()` 逻辑
   - 如需特殊提交流程（如 select-evidence 的内部提交），在 `handleSubmit` 中添加分支

4. **formatSubmitData**（`frontend/src/components/student/exercises/gradeItemSet.ts`）
   - 在 switch 中添加 case，定义提交数据格式

5. **Zod Schema**（`backend/src/schemas/answer-key.schema.ts`）
   - 添加新类型的 Zod schema（如 `XxxAnswerKeySchema`）
   - 加入 `AnswerKeySchema` 的 `z.union` 数组
   - 导出类型 `XxxAnswerKey`

6. **Backend Grader**
   - 新建 `backend/src/classroom/graders/xxx.grader.ts`，实现 `Grader` 接口，key 参数使用具体子类型
   - 在 `backend/src/classroom/grading.service.ts` 的构造函数中注册

7. **Sanitizer**（`backend/src/schemas/manifest.utils.ts`）
   - 添加新类型的 sanitize 函数，剥离答案字段
   - 在 `sanitizers` map 中注册
   - 同步更新 `ExerciseSpecSchema`（`exercise-spec.schema.ts`）

8. **Manifest answerKey**
   - 在 manifest 的 readingStep 中写入对应格式的 answerKey

9. **可选：TextPanel overlay**
   - 如需文本面板交互，参考 `SelectEvidenceExercise` 的 `onOverlayChange` 模式

### Grader 接口

```typescript
// backend/src/schemas/grade-result.schema.ts (Zod schema)
export type GradeResult = {
  total: number;                                    // 0-100 总分
  byDimension: Record<string, boolean | number>;    // 各维度评分
  attemptCounts?: Record<string, number>;           // 各题尝试次数
  llmFeedback?: string;                             // AI 生成的反馈（预留）
  llmItems?: Array<{ index: number; relevant: boolean; reason: string }>;
};

// backend/src/classroom/graders/grader.interface.ts
export interface Grader {
  grade(key: AnswerKey, data: Record<string, unknown>): GradeResult | Promise<GradeResult>;
}
// 每个 grader 的 key 参数类型化为具体子类型（如 QuizGrader.grade(key: QuizAnswerKey, ...)）
```

### 已知限制

1. **manifest API 已剥离答案**：`sanitizeManifest()` 会移除 correct/hint/walkthrough 等字段，前端只能获取 `ExerciseSpec`（题目结构）。如需查看完整 answerKey 须直接读数据库
2. **select-evidence overlay 是特殊路径**：其他题型不使用 TextPanel overlay，如需类似交互需参考其实现
3. **Matrix 评分是模糊匹配**：开放填空题无法精确评分，`includes` 匹配可能误判
4. **Match 无现有 manifest 示例**：当前课程中没有使用 match 类型的题目，但代码路径完全可用
5. **Stance 评分不考虑证据质量**：只检查数量 ≥ minEvidence，不评估选择了哪些证据
6. **Stance 位置匹配区分大小写**：`StanceGrader` 对 student position 做 `toLowerCase()`，但 `validPositions` 直接 `includes` 比较，如果 answerKey 中 validPositions 含大写会不匹配（潜在 bug）
7. **Map LLM 评估需要 API key**：MapGrader 使用 GLM API 评估理由质量（相关性 + 解释合理性）。若 `ZHIPU_API_KEY` 未配置或 LLM 调用失败，自动 fallback 为纯规则评分（仅检查理由长度），不影响基本功能
8. **Map 无 expected 时位置满分**：如果 answerKey 不提供 `expected`，所有已放置 item 的 positionScore 直接给 100，仅考察完成度
