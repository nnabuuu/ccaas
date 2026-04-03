# 交互式提示（Interactive Prompting）

## 什么是交互式提示

交互式提示允许 Agent Engine **在工作流执行过程中暂停，向用户提出结构化问题**。用户通过单选/多选卡片（或自定义向导）回答后，Agent 继续执行。

适用于 Agent 在执行过程中需要用户澄清、确认或做出选择的场景——例如选择主题范围、从生成的选项中选择、或确认参数。

## 工作原理

```
Agent Engine 调用 AskUserQuestion → 暂停
  → 后端发送 tool_activity(start) SSE 事件，携带问题 payload
  → 前端渲染问题 UI（默认卡片或自定义向导）
  → 用户回答
  → 前端调用 POST /sessions/:sessionId/control-response
  → 后端将结构化答案传回 Agent Engine，恢复执行
  → Agent 带着 JSON 格式的答案继续工作流
```

### 事件流程

1. **Agent 暂停** — Agent Engine 调用 `AskUserQuestion`，传入 `questions` 数组。执行自动暂停。
2. **SSE 事件推送** — 后端发送 `tool_activity` 事件，`phase: 'start'`，`toolName: 'AskUserQuestion'`。`toolInput` 包含问题 payload（问题、选项、元数据）和 `requestId`。
3. **前端渲染 UI** — 如果 Solution 注册了 `AskUserQuestion` 的 ToolRenderer，则渲染交互式问题卡片。如果匹配的 Skill 注册了自定义向导，则由向导接管。
4. **用户提交答案** — 前端调用 `POST /sessions/:sessionId/control-response`，传入 `requestId` 和用户的答案。
5. **Agent 恢复** — Agent Engine 收到结构化 JSON 答案，继续执行工作流。

### 对接层次

| 层级 | 包 | 受众 | 你能获得什么 |
|------|---|------|-------------|
| **Core 协议** | `@kedge-agentic/backend` | 自建前端的开发者（原生 App、小程序等） | SSE 事件 + REST 端点——可构建任意 UI |
| **Chat Interface** | `@kedge-agentic/chat-interface` | 使用平台聊天 UI 的 Solution 开发者 | 默认问题卡片 + 自定义向导框架 |
| **Skill 定义** | SKILL.md | Skill 编写者 | 指导 Agent 何时/如何提问 |

---

## Core 协议

> **受众**：构建自定义前端（原生 App、微信小程序、嵌入式 WebView 等）、不依赖 `@kedge-agentic/chat-interface` 的开发者。

Core 协议是传输层级的：SSE 事件携带问题 payload，REST 端点接收用户答案。你可以基于这个协议构建任何 UI。

### SSE 事件：`tool_activity`

当 Agent 调用 `AskUserQuestion` 时，后端发送：

```
event: tool_activity
data: {
  "toolName": "AskUserQuestion",
  "toolId": "req_abc123",        // ← 提交时用作 requestId
  "phase": "start",
  "toolInput": {
    "questions": [ ... ]          // ← 问题 payload（见下文）
  }
}
```

用户提交答案、Agent 恢复后，会发送第二个事件：

```
event: tool_activity
data: {
  "toolName": "AskUserQuestion",
  "toolId": "req_abc123",
  "phase": "end",
  "toolOutput": {
    "answers": { "问题文本": "选中的值" }
  }
}
```

### 问题 Payload 结构

```typescript
interface Question {
  question: string           // 完整问题文本（同时作为答案的 key）
  header?: string            // 短标签（最多 12 字符）
  hint?: string              // 问题下方的提示文本
  options: QuestionOption[]  // 2-4 个选项
  multiSelect?: boolean      // false = 单选，true = 多选
  preview?: boolean          // true = 选项旁显示预览内容
}

interface QuestionOption {
  label: string              // 选项显示文本
  description?: string       // 说明文字
  recommended?: boolean      // 标记为推荐 / 预选
  value?: string             // 提交的答案值（不填则默认使用 label）
  previewContent?: string    // 选中此选项时在预览面板中显示的内容
}
```

#### 字段参考

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `question` | `string` | 是 | 完整问题文本；同时作为答案映射的 key |
| `header` | `string` | 否 | 短标签（最多 12 字符） |
| `hint` | `string` | 否 | 问题下方的提示文本（如"可多选"） |
| `options` | `QuestionOption[]` | 是 | 2–4 个选项 |
| `multiSelect` | `boolean` | 否 | `false` = 单选（默认），`true` = 多选 |
| `preview` | `boolean` | 否 | `true` = 选项包含 `previewContent` 用于并排展示 |

| 选项字段 | 类型 | 必填 | 说明 |
|----------|------|------|------|
| `label` | `string` | 是 | 选项显示文本 |
| `description` | `string` | 否 | 说明文字 |
| `recommended` | `boolean` | 否 | 预选该选项并标记为推荐 |
| `value` | `string` | 否 | 提交的答案值；不填则默认使用 `label` |
| `previewContent` | `string` | 否 | 选中时显示的预览内容（需要问题设置 `preview: true`） |

### Payload 示例

```json
{
  "questions": [
    {
      "question": "希望生成哪种题型？",
      "header": "题型",
      "multiSelect": false,
      "options": [
        { "label": "混合出题", "description": "选择题 + 填空题 + 解答题，题型多样", "recommended": true, "value": "混合出题" },
        { "label": "选择题", "description": "全部单选，适合快速作答和批改", "value": "选择题" },
        { "label": "填空题", "description": "考查计算和推理能力", "value": "填空题" }
      ]
    },
    {
      "question": "出多少题？",
      "header": "题量",
      "multiSelect": false,
      "options": [
        { "label": "5 题", "description": "课堂小测，约 15 分钟", "recommended": true, "value": "5 题" },
        { "label": "10 题", "description": "单元练习，约 30 分钟", "value": "10 题" },
        { "label": "20 题", "description": "正式测试，约 45 分钟", "value": "20 题" }
      ]
    }
  ]
}
```

### REST 端点：提交答案

```
POST /api/v1/sessions/:sessionId/control-response
Content-Type: application/json

{
  "requestId": "req_abc123",
  "answers": {
    "希望生成哪种题型？": "混合出题",
    "出多少题？": "5 题"
  }
}
```

**`ControlResponseDto`**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `requestId` | `string` | `tool_activity(start)` 事件中的 `toolId` |
| `answers` | `Record<string, string>` | 问题文本 → 选中答案值的映射 |

提交后，Agent Engine 恢复执行，发送 `tool_activity(end)` 事件，答案在 `toolOutput` 中。

### 构建自定义前端

基于 Core 协议，你可以构建任意问题 UI：

1. **监听** `tool_activity` SSE 事件，筛选 `toolName === 'AskUserQuestion'` 且 `phase === 'start'`
2. **解析** `toolInput.questions`，渲染你自己的 UI（原生控件、表单、聊天气泡等）
3. **收集** 用户的选择
4. **POST** 到 `/api/v1/sessions/:sessionId/control-response`，传入 `requestId` + `answers`
5. **监听** `phase === 'end'` 的 `tool_activity` 事件，确认 Agent 已恢复

无需依赖 `@kedge-agentic/chat-interface` 或 `@kedge-agentic/react-sdk`。

---

## Chat Interface 集成

> **受众**：使用 `@kedge-agentic/chat-interface` 作为聊天 UI 层的 Solution 开发者。

chat-interface 包为 AskUserQuestion 提供了开箱即用的渲染：默认问题卡片和自定义向导框架。通过注册 `ToolRenderer` 来集成。

### 默认问题卡片

内置的问题卡片 UI 支持：

- **单选问题** — 单选按钮风格的选项卡片，用户选择一项
- **多选问题** — 复选框风格的选项卡片，用户选择一项或多项
- **每次最多 4 个问题** — 每个问题 2–4 个选项
- **"其他"选项** — 自动追加，允许用户输入自定义答案
- **预览面板** — 当 `preview: true` 时，左右分栏显示内容预览
- **推荐标记** — 当 `recommended: true` 时，预选该选项并显示推荐徽章

### 实现 ToolRenderer

Solution 前端需要提供一个 `ToolRenderer` 函数来处理 AskUserQuestion。
渲染器接收 `ToolUseBlock`，根据 `phase` 返回不同的 JSX：

```tsx
import type { ToolRenderer } from '@kedge-agentic/chat-interface'

export const askUserQuestionRenderer: ToolRenderer = (block) => {
  const questions = block.toolInput?.questions

  if (block.phase === 'end') {
    // 展示只读的已提交视图，答案来自 block.toolOutput
    return <SubmittedView questions={questions} answers={block.toolOutput.answers} />
  }

  if (block.phase === 'start') {
    // Agent 已暂停——渲染交互 UI，收集答案，
    // 然后 POST 到 /sessions/:sessionId/control-response
    return <QuestionUI questions={questions} requestId={block.toolId} />
  }

  return null
}
```

### 注册渲染器

```tsx
<ChatInterfaceProvider value={{ toolRenderers: { AskUserQuestion: askUserQuestionRenderer } }}>
  {children}
</ChatInterfaceProvider>
```

如果不注册，AskUserQuestion 事件将渲染为通用的工具活动卡片（可折叠行，显示工具名和输入/输出）。

### 自定义向导框架

对于多步骤或复杂输入流程，可以注册**自定义向导**替代默认卡片 UI。

向导框架提供：

- **多步骤导航** — 进度指示器、上一步/下一步按钮
- **4 种步骤类型** — `form`、`tree-select`、`data-review`、`summary`
- **步骤依赖** — 步骤可声明 `dependsOn` 控制推进顺序
- **自动答案收集** — 所有步骤的答案会被聚合，作为单次响应提交
- **通过 `registerWizard()` 注册** — 将 `WizardConfig` 与 Skill slug 关联，支持 header 匹配作为回退

#### 步骤类型

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| `form` | 文本/下拉/数字输入字段 | 输入参数、从下拉菜单选择 |
| `tree-select` | 从 API 加载的多选树 | 选择章节、主题等层级结构 |
| `data-review` | 数据表格，支持强调切换 | 查看学情数据、薄弱点分析 |
| `summary` | 只读的全部答案汇总 | 提交前的最终确认 |

#### 注册向导

```tsx
import { registerWizard } from '@kedge-agentic/chat-interface'

registerWizard('lesson-plan-designer', {
  id: 'lesson-plan',
  title: 'Lesson Plan Wizard',
  steps: [
    { id: 'scope', type: 'form', title: 'Scope', fields: [
      { key: 'subject', label: 'Subject', type: 'select', options: [...], contextKey: 'subject' },
      { key: 'grade', label: 'Grade', type: 'select', options: [...], contextKey: 'grade' },
    ]},
    { id: 'chapters', type: 'tree-select', title: 'Chapters', dependsOn: ['scope'] },
    { id: 'gaps', type: 'data-review', title: 'Student Gaps', dependsOn: ['scope', 'chapters'] },
    { id: 'confirm', type: 'summary', title: 'Confirm', dependsOn: ['scope', 'chapters', 'gaps'] },
  ],
}, {
  triggerHeaders: ['Subject', 'Lesson'],  // 通过问题 header 回退匹配
})
```

当 Agent 触发 `AskUserQuestion` 时，渲染器按以下顺序检查：
1. **直接 slug 匹配** — 第一个问题的 `header` 与注册的向导 slug 匹配
2. **触发 header 匹配** — 任何问题的 `header` 出现在向导的 `triggerHeaders` 列表中

如果匹配成功，`WizardRenderer` 接管渲染，替代默认问题卡片。

#### 类型定义

```typescript
interface WizardConfig {
  id: string
  title: string
  steps: WizardStep[]
}

interface WizardStep {
  id: string
  title: string
  type: 'form' | 'tree-select' | 'data-review' | 'summary'
  fields?: FormFieldConfig[]       // 用于 'form' 类型
  dataEndpoint?: string            // 动态数据的 API URL（tree-select、data-review）
  dependsOn?: string[]             // 必须先完成的步骤 ID
}

interface FormFieldConfig {
  key: string
  label: string
  type: 'select' | 'text' | 'number'
  options?: { label: string; value: string }[]
  defaultValue?: string
  contextKey?: string              // 从 sessionContext[contextKey] 自动填充
}

interface RegisterWizardOptions {
  triggerHeaders?: string[]        // 触发此向导的额外问题 header 值
}
```

---

## Skill 编写：使用 AskUserQuestion

> **受众**：在 SKILL.md 中定义 Agent 行为的 Skill 编写者。

要在 Skill 中启用交互式提示，在工作流的适当步骤中指示 Agent 使用 `AskUserQuestion`。Skill 编写者不需要编写前端代码——Skill 只定义**何时**和**问什么**。

### SKILL.md 中的示例

```markdown
# 工作流程

## 步骤 1：了解需求
使用 AskUserQuestion 向用户确认需求：

- 问题 1："请选择学科领域"（选项：数学、科学、语文、社会）
- 问题 2："请选择年级段"（选项：1-3年级、4-6年级、7-9年级）

使用 AskUserQuestion 工具，传入 `questions` 数组。每个问题包含：
- `question`：完整问题文本
- `header`：短标签（最多 12 字符）
- `options`：2-4 个选项，每个包含 `label` 和 `description`
- `multiSelect`：true/false

等待用户回答后再进入步骤 2。
```

### questions 数组格式

```json
{
  "questions": [
    {
      "question": "课程应覆盖哪个学科领域？",
      "header": "学科",
      "multiSelect": false,
      "options": [
        { "label": "数学", "description": "算术、代数、几何" },
        { "label": "科学", "description": "物理、化学、生物" },
        { "label": "语文", "description": "阅读、写作、语法" }
      ]
    }
  ]
}
```

Agent 收到的答案是 JSON 对象，将问题文本映射到用户选择的选项值。

---

## API 参考

- **SSE 事件**：`tool_activity`，`toolName: 'AskUserQuestion'` — 参见 [SSE Transport](../api/sse.md#tool_activity)
- **提交答案**：`POST /sessions/:sessionId/control-response` — 参见 [SSE Transport](../api/sse.md#post-control-response--提交向导答案)
- **REST 端点**：`POST /sessions/:sessionId/control-response` — 参见 [REST API](../api/rest.md#post-sessionssessionidcontrol-response)

## 示例：教案向导

一个 4 步向导，用于创建教案：

| 步骤 | 类型 | 用途 |
|------|------|------|
| 1. 范围 | `form` | 通过表单字段选择学科、年级、班级、课型 |
| 2. 章节 | `tree-select` | 从 API 加载的教材树中选择章节 |
| 3. 学情 | `data-review` | 查看学情分析数据，切换强调项 |
| 4. 确认 | `summary` | 查看所有选择并提交 |

用户完成全部 4 步并确认后，向导通过 `POST /control-response` 提交聚合答案。Agent 随即获得生成教案所需的全部上下文。

```tsx
import { registerWizard } from '@kedge-agentic/chat-interface'

registerWizard('备课向导', {
  id: 'lesson-plan',
  title: '备课向导',
  steps: [
    {
      id: 'scope',
      title: '选择范围',
      type: 'form',
      fields: [
        { key: 'subject', label: '学科', type: 'select', options: [...], contextKey: 'subject' },
        { key: 'grade', label: '年级学期', type: 'select', options: [...], contextKey: 'grade' },
        { key: 'class_id', label: '班级', type: 'select', options: [...], contextKey: 'classId' },
        { key: 'lessonType', label: '课型', type: 'select', options: [...] },
        { key: 'duration', label: '课时', type: 'select', options: [...] },
      ],
    },
    { id: 'chapters', title: '选择章节', type: 'tree-select', dependsOn: ['scope'] },
    { id: 'gaps', title: '学情分析', type: 'data-review', dependsOn: ['scope', 'chapters'] },
    { id: 'confirm', title: '确认生成', type: 'summary', dependsOn: ['scope', 'chapters', 'gaps'] },
  ],
}, {
  triggerHeaders: ['学科', '备课', '备课参数', '科目'],
})
```
