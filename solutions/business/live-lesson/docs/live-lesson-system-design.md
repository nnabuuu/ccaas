# Live Lesson 系统设计文档 — CCAAS 驱动架构

> 版本：v1.0 | 更新日期：2026-05-22

## §1 系统总览

Live Lesson 由三个子系统组成，均运行于同一 CCAAS tenant `live-lesson` 下：

| 子系统 | 定位 | 用户 | CCAAS 关系 |
|--------|------|------|-----------|
| **Creator** | 备课端 — 课程项目创作 | 教师（课前） | Session Template: `creator` |
| **Classroom** | 课堂端 — 实时教学 | 教师 + 学生（课中） | Session Template: `teaching` |
| **CCAAS** | 平台层 — Agent 引擎 & 工具编排 | — | 基础设施 |

**一句话关系**：Creator 和 Classroom 是两种不同的 CCAAS 会话模式（session template），共享同一个 tenant `live-lesson`，通过 manifest 文件衔接前后流程。

### 部署视图

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │ Creator Frontend  │  │ Classroom Frontend                │ │
│  │ :5283            │  │ :5283                             │ │
│  └────────┬─────────┘  └───────────┬──────────────────────┘ │
└───────────┼─────────────────────────┼───────────────────────┘
            │                         │
            ▼                         ▼
┌───────────────────────┐  ┌──────────────────────────────────┐
│ Solution Backend      │  │ CCAAS Backend                     │
│ :3007                 │  │ :3001                             │
│                       │  │                                    │
│ • Lesson CRUD         │  │ • Agent Engine lifecycle           │
│ • Student REST API    │  │ • Session persistence              │
│ • Observation Engine  │  │ • Skill system                     │
│ • File Storage        │  │ • MCP tool orchestration           │
│                       │  │ • SSE event stream                 │
└───────────────────────┘  └──────────────────────────────────┘
```

### 系统数据流总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Creator (备课)                                 │
│                                                                      │
│  Teacher ──chat──▶ CCAAS Agent ──MCP──▶ creator-project-tools       │
│                         │                      │                     │
│                         │                      ▼                     │
│                         │               file_write / file_read       │
│                         │                      │                     │
│                         ◀──output_update───────┘                     │
│                         │                                            │
│                         ▼                                            │
│                   Project Files (plan/, execution/, modules/)         │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ manifest.json
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Classroom (上课)                                │
│                                                                      │
│  Teacher ──chat──▶ CCAAS Agent ──MCP──▶ live-lesson-tools           │
│       │                 │                      │                     │
│       │                 │              advance_beat /                 │
│       │                 │              execute_dynamic_board /        │
│       │                 │              suggest_questions              │
│       │                 ◀──output_update───────┘                     │
│       │                 ▼                                            │
│       │           Board Rendering + Beat State                       │
│       │                                                              │
│  Students ──REST──▶ Solution Backend (Observation + LLM)             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## §2 CCAAS 平台层（快速回顾）

> 本节仅列 Creator/Classroom 会用到的能力，完整文档参见 CCAAS 主仓 README。

### Session Model

- 每个会话 ID: `conv_{uuid}`
- 通过 `sessionTemplate` 选择不同的 Skill 集合和 MCP Server
- 同一 tenant 下可同时存在多种 session template

### Skill System

| Skill Type | 描述 | 适用场景 |
|-----------|------|---------|
| `prompt` | 纯 prompt engineering | 自由问答、审计 |
| `workflow` | 多步骤编排 | 教案生成、执行设计 |
| `sub-agent` | 子 Agent 委托 | 复杂推理链 |
| `passive` | 兜底/被动监听 | general-assistant |

**Trigger 类型**: `always_on` / `keyword` / `manual`

### MCP Integration

- Transport: `stdio`（本地进程通信）
- `toolEventTriggers`: MCP 工具执行后触发 SSE 事件
  - 唯一支持的 eventType: `output_update`
  - 可指定 `field` 将结果包装为 `{ field, value }`

### React SDK Hooks

| Hook | 用途 |
|------|------|
| `useAgentConnection` | 建立 SSE 连接，管理 session 生命周期 |
| `useAgentChat` | 发送消息、接收流式响应 |
| `useAgentStatus` | 监听 Agent 状态（idle/thinking/tool_use） |
| `usePageContext` | 同步前端页面上下文给 Agent |
| `useOutputSync` | 处理 output_update 事件 |
| `useSkills` | 获取可用 Skill 列表 |
| `useFiles` | 管理会话文件 |
| `useWorkspaceTree` | 获取工作空间文件树 |

### Chat Interface Compound Components

```tsx
<ChatInterface.Root serverUrl={...} tenantId={...} customWidgets={...}>
  <ChatInterface.Toaster />
  <ChatInterface.ContextBar chips={chips} />
  <ChatInterface.Messages emptyState={...} />
  <ChatInterface.QuickSuggestions />
  <ChatInterface.Composer placeholder="..." />
</ChatInterface.Root>
```

支持 `customWidgets`（自定义渲染器）和 `customBlockRenderers` 注入。

### SSE 事件协议

| Event Type | 描述 | 关键字段 |
|-----------|------|---------|
| `text_delta` | 流式文本增量 | `content` |
| `output_update` | 工具执行结果推送 | `field`, `value` |
| `tool_activity` | 工具调用状态 | `toolName`, `status` |
| `agent_status` | Agent 状态变更 | `status` |
| `agent_thinking` | 思考过程 | `content` |
| `token_usage` | Token 用量 | `inputTokens`, `outputTokens` |

---

## §3 Creator（备课端）— CCAAS 映射

### §3.1 Session 模型

- **一个 Course Project = 一个 CCAAS Session**
- Session Template: `"creator"`
- 连接配置：

```typescript
const SERVER_URL = import.meta.env.VITE_CCAAS_URL || 'http://localhost:3001'
const TENANT_ID = 'live-lesson'
const SESSION_TEMPLATE = 'creator'

// 参考蓝本：useLiveLesson.ts 中的连接方式
useAgentConnection({
  serverUrl: SERVER_URL,
  tenantId: TENANT_ID,
  sessionTemplate: SESSION_TEMPLATE,
  autoConnect: projectId !== '',
  transport: 'sse',
  sessionId: projectSessionId,
})
```

- 每次打开同一个 Project，复用同一个 `sessionId`（持久化在项目元数据中）
- Agent 拥有整个项目的文件上下文

### §3.2 Creator Skills 清单

| Skill | Type | Triggers | MCP Tools | 行为描述 |
|-------|------|----------|-----------|---------|
| `plan-generator` | workflow | keyword: `"生成教案"`, `"设计教案"` | `file_read`, `file_write` | 根据教学要求生成 plan/ 下的教案文件 |
| `execution-designer` | workflow | keyword: `"添加模块"`, `"生成执行设计"`, `"设计步骤"` | `file_read`, `file_write`, `validate_manifest`, `get_module_schemas` | 创建/修改执行 manifest 和模块文件 |
| `review-auditor` | prompt | keyword: `"运行审计"`, `"检查一致性"` | `file_read` | 交叉审计 plan + execution，生成 Review 报告 |
| `general-assistant` | passive | fallback（无匹配时） | `file_read` | 自由问答、解释内容 |

**Skill 配置路径**: `skills/{skill-slug}/SKILL.md`

**Skill Prompt Mode**: `inline`（SKILL.md 内容嵌入 system prompt）

**行为规范参考**:
- `execution-designer` 遵循 [`classroom-execution-design.md`](./classroom-execution-design.md) 中的五阶段工作流
- `review-auditor` 仅做软约束审计（参见 [`course-project-architecture.md`](./course-project-architecture.md) §Review）

### §3.3 Creator MCP Server

Creator 使用独立于 Classroom 的 MCP Server：`creator-project-tools`。

**工具清单**：

| Tool | 描述 | 参数 | toolEventTrigger |
|------|------|------|-----------------|
| `file_read` | 读取项目文件内容 | `path: string` | — |
| `file_write` | 创建/更新项目文件 | `path: string, content: string` | `output_update` (field: `fileTreeChanged`) |
| `file_list` | 列出项目文件树 | `directory?: string` | — |
| `get_module_schemas` | 返回所有模块类型的 JSON Schema | `type?: string` | — |
| `validate_manifest` | 校验 manifest JSON 完整性 | `content: string` | — |

**toolEventTriggers 配置**：

```json
{
  "toolEventTriggers": [
    {
      "toolName": "file_write",
      "eventType": "output_update",
      "field": "fileTreeChanged"
    }
  ]
}
```

当 `file_write` 执行成功后，CCAAS 自动向前端推送 `output_update` 事件，`field = "fileTreeChanged"`，前端据此刷新文件树和相关 tab。

### §3.4 前端架构

**布局结构**（参考 `creator-v7-app.jsx` 原型）：

```
┌─ Top Bar (h=48): 项目标题 + 📁 文件浏览器 + 预览按钮 ──────────────┐
├─ Body (flex: 1):                                                     │
│  ┌─ Left Panel (400px) ──────┐  ┌─ Right Panel (flex: 1) ────────┐ │
│  │                            │  │                                 │ │
│  │  ChatInterface.Root        │  │  Tab Bar:                       │ │
│  │    .ContextBar             │  │    [教案设计][执行设计][Skills]  │ │
│  │    .Messages               │  │    [+ 动态 Tabs...]             │ │
│  │    .QuickSuggestions       │  │                                 │ │
│  │    .Composer               │  │  Content Pane:                  │ │
│  │                            │  │    plan / exec / skills /       │ │
│  │                            │  │    file viewer / review         │ │
│  └────────────────────────────┘  └─────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

**核心 Hook**: `useCreatorSession()` — 类比 `useLiveLesson.ts`

```typescript
function useCreatorSession(projectId: string) {
  const connection = useAgentConnection({
    serverUrl: SERVER_URL,
    tenantId: TENANT_ID,
    sessionTemplate: 'creator',
    sessionId: getProjectSessionId(projectId),
    autoConnect: !!projectId,
    transport: 'sse',
  })

  const chat = useAgentChat(connection)
  const status = useAgentStatus(connection)

  // output_update 路由处理
  useOutputSync(connection, {
    onOutputUpdate: (update) => {
      routeOutputUpdate(update)
    }
  })

  // 页面上下文同步
  const pageContext = usePageContext(connection)

  return { connection, chat, status, pageContext, ... }
}
```

**`onOutputUpdate` 路由表**：

| `field` 值 | 触发动作 | 来源 Tool |
|------------|---------|-----------|
| `fileTreeChanged` | 刷新文件系统 tab + 文件树 | `file_write` |
| `manifestUpdated` | 刷新执行设计 tab | `file_write` (path = manifest) |
| `planUpdated` | 刷新教案设计 tab | `file_write` (path = plan/*) |
| `reviewResult` | 打开 Review 动态 tab | — (Skill 直接返回) |

**`usePageContext` 同步**：

```typescript
// 当教师切换 tab 或选中某个 block 时
pageContext.update({
  activeTab: 'execution',          // 当前激活的 tab
  selectedBlock: 'b2',             // 选中的 block ID
  editingFile: 'modules/quiz.json' // 正在编辑的文件
})
```

Agent 可感知教师当前的编辑上下文，据此调整建议内容。

### §3.5 Skill ↔ Tab 交互模型

```
┌──────────────────────────────────────────────────────────────────┐
│                     Skill ↔ Tab 交互循环                          │
│                                                                   │
│  ┌─────────┐   updateContext    ┌──────────────┐                 │
│  │ Teacher  │ ───────────────▶  │ Page Context │                 │
│  │ 切换 Tab │                   │ (activeTab,  │                 │
│  └─────────┘                    │  selection)  │                 │
│                                 └──────┬───────┘                 │
│                                        │ Agent 感知              │
│                                        ▼                         │
│                               ┌────────────────┐                 │
│                               │  CCAAS Agent   │                 │
│                               │  (Skill 执行)  │                 │
│                               └────────┬───────┘                 │
│                                        │ MCP Tool Call           │
│                                        ▼                         │
│                               ┌────────────────┐                 │
│                               │ creator-project │                 │
│                               │ -tools          │                 │
│                               │ (file_write)    │                 │
│                               └────────┬───────┘                 │
│                                        │ toolEventTrigger        │
│                                        ▼                         │
│                               ┌────────────────┐                 │
│                               │ output_update  │                 │
│                               │ (SSE event)    │                 │
│                               └────────┬───────┘                 │
│                                        │ 前端路由               │
│                                        ▼                         │
│  ┌─────────┐                  ┌────────────────┐                 │
│  │ Teacher  │ ◀───刷新───────  │ Tab Content   │                 │
│  │ 看到变化 │                  │ 重新渲染       │                 │
│  └─────────┘                  └────────────────┘                 │
└──────────────────────────────────────────────────────────────────┘
```

**完整交互示例**（教师请求 "为 Step 2 添加一个选择题模块"）：

1. 教师在执行设计 tab 选中 Step 2 → `usePageContext.update({ activeTab: 'execution', selectedBlock: 's2' })`
2. 教师在左侧 Chat 输入 "添加一个选择题模块"
3. CCAAS 路由到 `execution-designer` Skill（keyword match）
4. Agent 调用 `get_module_schemas({ type: 'choice' })` 获取 choice 模块 schema
5. Agent 调用 `file_write({ path: 'modules/quiz-step2.json', content: '...' })` 写入模块文件
6. `toolEventTrigger` 触发 → 前端收到 `output_update { field: 'fileTreeChanged' }`
7. 前端刷新文件树，自动打开新文件的动态 tab

---

## §4 Classroom（课堂端）— CCAAS 映射

### §4.1 教师端 Blackboard Session

- **Session Template**: `"teaching"`（已实现，定义在 `solution.json`）
- **Skill**: `socratic-teacher`（passive 类型，支持 `/explain` + `/suggest-questions` 命令）
- **MCP Server**: `live-lesson-tools`

**MCP 工具清单**：

| Tool | 描述 | toolEventTrigger |
|------|------|-----------------|
| `advance_beat` | 推进教学节拍 | `output_update` |
| `execute_dynamic_board` | 执行动态板书 | `output_update` |
| `suggest_questions` | 生成建议提问 | `output_update` |

**前端集成** — `useLiveLesson.ts`（已实现，作为 Creator 的参考蓝本）：

```typescript
const SERVER_URL = import.meta.env.VITE_CCAAS_URL || 'http://localhost:3001'
const TENANT_ID = 'live-lesson'
const SESSION_TEMPLATE = 'teaching'

// 核心状态
interface UseLiveLessonReturn {
  boardState: BoardState          // 板书渲染状态
  beatState: BeatState            // 当前节拍
  dynamicBoardActions: ChalkboardAction[]
  globalBoardOps: GlobalBoardOp[]
  suggestedQuestions: SuggestedQuestionsPayload
  tutoringMode: TutoringMode      // 'idle' | 'picking' | 'suggesting' | 'explaining'

  // Actions
  sendMessage(content: string): void
  sendAsk(nodeId: string, content: string): void
  advanceBeat(): void
  startLesson(): void
  sendExplainRequest(question: string): void
  requestMoreQuestions(): void
}
```

### §4.2 学生端

学生端**不直连 CCAAS SDK**，通过 Solution Backend REST API 获取 AI 功能：

```
Student App ──REST──▶ Solution Backend ──LLM call──▶ Model API
                            │
                            ├── /api/student/ask       (提问)
                            ├── /api/student/discuss   (讨论)
                            ├── /api/student/translate (翻译)
                            └── /api/student/personal-touch (个性化)
```

**设计理由**：
- 学生请求量大，直连 CCAAS Agent Engine 会造成排队
- 学生 AI 功能相对简单（单次 LLM 调用），不需要 Skill/MCP 编排
- Solution Backend 可做频率限制和内容审核

### §4.3 Observation Engine

Observation Engine 运行在 Solution Backend 内部，独立于 CCAAS：

```
Student Events ──WebSocket──▶ Solution Backend
                                    │
                                    ▼
                          ┌─────────────────────┐
                          │ Observation Engine   │
                          │                     │
                          │ 6 Event Handlers:   │
                          │  • JoinHandler      │
                          │  • ExerciseHandler  │
                          │  • ChatTurnHandler  │
                          │  • StatusChange     │
                          │  • StepComplete     │
                          │  • SystemEvent      │
                          │                     │
                          │ 8 Exercise Observe  │
                          │ Handlers:           │
                          │  • mc, matrix       │
                          │  • evidence, map    │
                          │  • image-upload     │
                          │  • guided-discovery │
                          │  • discuss          │
                          │  • fill-blank(stub) │
                          └─────────┬───────────┘
                                    │
                                    ▼
                          Teacher Dashboard (实时)
```

**统计覆盖情况**：

| 阶段 | 可见性 | 说明 |
|------|--------|------|
| practice | ✅ 完整 | 分数、维度、时长 |
| discuss | ✅ 完整 | 达标率、平均轮数、聚类 |
| guided-discovery | ✅ 完整 | 子步骤通过率 + 错误分布 |
| listen | ⚠️ 部分 | 仅活跃计数 |
| takeaway | ❌ 无 | 无统计 |
| personal-touch | ❌ 无 | 无事件 |

详见 [`observation-system-review.md`](./observation-system-review.md)

---

## §5 solution.json 配置

目标 `solution.json` v3 配置，包含两个 session template：

```json
{
  "schemaVersion": "3.0",
  "name": "Live Lesson",
  "slug": "live-lesson",
  "tenant": {
    "name": "Live Lesson",
    "slug": "live-lesson",
    "description": "AI-powered interactive teaching platform"
  },
  "mode": "simple",
  "discovery": { "enabled": true },
  "skills": ["skills/*"],
  "mcpServers": {
    "live-lesson-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "type": "stdio",
      "tools": ["execute_dynamic_board", "suggest_questions", "advance_beat"],
      "toolEventTriggers": [
        { "toolName": "execute_dynamic_board", "eventType": "output_update" },
        { "toolName": "suggest_questions", "eventType": "output_update" },
        { "toolName": "advance_beat", "eventType": "output_update" }
      ]
    },
    "creator-project-tools": {
      "command": "node",
      "args": ["creator-mcp-server/dist/index.js"],
      "type": "stdio",
      "description": "Creator project file management tools",
      "tools": ["file_read", "file_write", "file_list", "get_module_schemas", "validate_manifest"],
      "toolEventTriggers": [
        { "toolName": "file_write", "eventType": "output_update", "field": "fileTreeChanged" }
      ]
    }
  },
  "sessionTemplates": {
    "teaching": {
      "description": "苏格拉底式教学会话",
      "enabledSkills": ["socratic-teacher"],
      "skillPromptMode": "inline"
    },
    "creator": {
      "description": "课程项目创作会话",
      "enabledSkills": [
        "plan-generator",
        "execution-designer",
        "review-auditor",
        "general-assistant"
      ],
      "mcpServers": {
        "creator-project-tools": {
          "command": "node",
          "args": ["creator-mcp-server/dist/index.js"],
          "type": "stdio",
          "tools": ["file_read", "file_write", "file_list", "get_module_schemas", "validate_manifest"],
          "toolEventTriggers": [
            { "toolName": "file_write", "eventType": "output_update", "field": "fileTreeChanged" }
          ]
        }
      },
      "skillPromptMode": "inline"
    }
  }
}
```

**Session Template 对比**：

| 维度 | `teaching` | `creator` |
|------|-----------|-----------|
| 用途 | 课堂实时教学 | 课前备课创作 |
| Skills | socratic-teacher | plan-generator, execution-designer, review-auditor, general-assistant |
| MCP Server | live-lesson-tools | creator-project-tools |
| 交互模式 | 板书驱动 + 节拍推进 | 文件驱动 + Tab 刷新 |
| Session 生命周期 | 一节课 ≈ 40min | 一个项目 ≈ 持久 |
| output_update | boardState, beatState, dynamicBoardActions | fileTreeChanged, manifestUpdated, planUpdated, reviewResult |

---

## §6 跨子系统协同

### Creator → Classroom 文件流转

```
Creator 产出                          Classroom 消费
─────────────                         ──────────────
plan/lesson-plan.md          →  教师课前阅读参考
execution/manifest.json      →  Classroom Runtime 解析为 Beat 序列
modules/*.json               →  学生端模块渲染 + Observe 绑定
resources/*.md               →  学生端阅读材料
```

**manifest.json** 是核心交接物：Creator 的 `execution-designer` Skill 生成，Classroom 的 Runtime 消费。

### Skill 隔离

| 维度 | Creator Skills | Classroom Skills |
|------|---------------|-----------------|
| 作用域 | 项目文件（plan + execution + modules） | 课堂实时状态（board + beats） |
| Session Template | `creator` | `teaching` |
| 永不共享 | ✅ 完全隔离 | ✅ 完全隔离 |

不同 session template 下的 Skill 互不可见——CCAAS 引擎根据 `enabledSkills` 配置注入。

### MCP Server 隔离

| MCP Server | 归属 | 工具集 | 触发事件 |
|-----------|------|--------|---------|
| `creator-project-tools` | Creator | file_read/write/list, get_module_schemas, validate_manifest | fileTreeChanged |
| `live-lesson-tools` | Classroom | advance_beat, execute_dynamic_board, suggest_questions | boardState, beatState |

两个 MCP Server 运行为独立进程，互不干扰。

---

## §7 相关文档索引

| 文档 | 路径 | 说明 |
|------|------|------|
| 信息架构 | [`course-project-architecture.md`](./course-project-architecture.md) | Plan/Execution/Record 三层结构，模块完成条件定义 |
| 执行设计 AI 规范 | [`classroom-execution-design.md`](./classroom-execution-design.md) | execution-designer Skill 五阶段工作流 + 设计模式 |
| 观察系统 | [`observation-system-review.md`](./observation-system-review.md) | 6 handler + 8 exercise observer 覆盖度分析 |
| Creator v7 信息架构 | [`../design/surfaces/creator-v7-changelog.md`](../design/surfaces/creator-v7-changelog.md) | 三层信息分离、动态 Tab、文件浏览器决策 |
| Creator v7 原型 | [`../design/surfaces/creator-v7-app.jsx`](../design/surfaces/creator-v7-app.jsx) | 完整 UI 原型：Tab 系统 + 文件 popover + Review |
| Creator 数据模型 | [`../design/surfaces/creator-v4-data.jsx`](../design/surfaces/creator-v4-data.jsx) | LESSON_V4, COMP_REG (10 模块类型), FILE_CATEGORIES |
| Chat Interface API | [`packages/chat-interface/docs/extension-api.md`](../../../../packages/chat-interface/docs/extension-api.md) | Compound Components + Widget 系统 + MCP Bridge |
| React SDK | [`packages/react-sdk/src/index.ts`](../../../../packages/react-sdk/src/index.ts) | 全部 hooks/components/types 导出清单 |
| CCAAS v3 Schema | [`packages/backend/src/solutions/dto/solution-config.dto.ts`](../../../../packages/backend/src/solutions/dto/solution-config.dto.ts) | SolutionConfigV3 类型定义 |
| 当前 solution.json | [`../solution.json`](../solution.json) | 现有配置（仅 teaching template） |
| 模块插件架构 | [`exercise-plugin-architecture.md`](./exercise-plugin-architecture.md) | 11 类练习题插件兼容性审计 |

---

## §8 Open Questions（设计待定项）

### Q1: Creator MCP Server 实现方式

**选项 A**: 在现有 `mcp-server/` 目录扩展，通过参数区分模式
**选项 B**: 新建 `creator-mcp-server/` 独立目录

**倾向 B**：职责完全不同（文件操作 vs 板书控制），代码无共享。

### Q2: Multi-conversation 支持

当前 CCAAS 模型：1 session = 1 conversation（线性对话）。

Creator 场景可能需要：
- 教师切到不同 tab 时，上下文差异大
- 是否需要 sub-conversation 或 context window 管理？

**暂定**：依赖 `usePageContext` 做上下文切换，单一 conversation 满足 MVP。

### Q3: 文件系统层实现

**选项 A**: 真实 fs（MCP Server 直接操作磁盘文件）
**选项 B**: 虚拟文件树（Solution Backend 管理，MCP Server 通过 API 访问）
**选项 C**: CCAAS Files API（`useFiles` / `useWorkspaceTree` hooks）

**倾向 C**：CCAAS React SDK 已有 `useFiles`, `useFileContent`, `useWorkspaceTree` hooks，天然契合。

### Q4: Skill 之间的 Chaining

场景：教师说 "根据教案生成执行设计"

- `plan-generator` 先写 plan → 完成后自动触发 `execution-designer`？
- 还是教师手动分步操作？

**暂定**：V1 不做自动 chaining，教师明确触发。未来可通过 `workflow` type Skill 内部编排。

### Q5: Review Tab 数据持久化

`review-auditor` 生成的审计报告：
- 仅作为 Agent 消息（消失于对话历史中）？
- 还是持久化为项目文件（`review/audit-{timestamp}.md`）？

**倾向**：持久化为文件，通过 `file_write` 写入 → 自动触发动态 tab 打开。
