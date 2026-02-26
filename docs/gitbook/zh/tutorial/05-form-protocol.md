# 5. 表单与 output\_update 协议

`output_update` 协议是连接 AI Agent 输出与前端表单状态的桥梁。当 Agent 调用 `write_output` MCP 工具时，CCAAS 后端会发出 `output_update` WebSocket 事件，前端解析后以 SyncCard 形式呈现给用户审批。本章讲解 `write_output` 的工作原理、事件结构（包括嵌套的 `payload.data` 格式），以及生产环境中使用的 SyncCard 审批模式。

## 学习目标

完成本章后，你将能够：

- 使用 `@modelcontextprotocol/sdk` 实现 `write_output` MCP 工具
- 正确解析 `output_update` 事件（包括嵌套的 `payload.data` 结构）
- 使用 react-sdk 的 `useAgentChat` `onOutputUpdate` 回调
- 实现 SyncCard 审批模式，支持字段级同步、丢弃和撤销
- 使用 react-sdk 的 `OutputUpdateCard` 组件

## write\_output 管道

```
┌─────────────────────────────────────────────────────────────────────┐
│ AI Agent                                                            │
│                                                                     │
│ 调用 write_output({ field: 'objectives', value: '...', preview })   │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────────┐
│ MCP Server (@modelcontextprotocol/sdk)                              │
│                                                                     │
│ 1. 验证字段名是否在 SYNC_FIELDS 枚举中                               │
│ 2. 使用 Zod Schema 验证值（可自动修正）                                │
│ 3. 返回 JSON: { data: { field, value, preview }, status }           │
│    包装在 MCP content blocks 中: [{ type: 'text', text: JSON }]      │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────────┐
│ CCAAS 后端 (EventMapperService)                                     │
│                                                                     │
│ 1. 从 Agent stdout 解析工具结果                                       │
│ 2. 检测 { data: { field, value }, status } 结构                      │
│ 3. 发出 output_update WebSocket 事件，数据放在 payload.data 中         │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────────┐
│ react-sdk (useAgentChat)                                            │
│                                                                     │
│ 1. 在 socket 上监听 output_update                                    │
│ 2. parseOutputUpdate() 标准化多种格式                                 │
│ 3. 调用 onOutputUpdate({ field, value, preview }) 回调               │
│ 4. 附加到当前 assistant 消息的 outputUpdates[] 中                     │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────────┐
│ Solution 前端                                                       │
│                                                                     │
│ 1. onOutputUpdate 回调将更新添加到 pendingUpdates Map                 │
│ 2. SyncCard UI 显示"同步到表单" / "忽略"按钮                          │
│ 3. 用户审批后 → 值写入表单状态                                        │
└─────────────────────────────────────────────────────────────────────┘
```

## 在 MCP Server 中实现 write\_output

MCP Server 使用 `@modelcontextprotocol/sdk`（不是 Express）。以下是基于 lesson-plan-designer MCP Server 的简化示例。

### 工具定义

```typescript
// mcp-server/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'

const SYNC_FIELDS = ['title', 'description', 'priority', 'status', 'tags'] as const
type SyncField = typeof SYNC_FIELDS[number]

const server = new Server(
  { name: 'my-solution', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

const writeOutputTool: Tool = {
  name: 'write_output',
  description: `将结构化数据写入前端表单。
前端会显示"同步到表单"按钮，让用户决定是否应用更改。

可用字段: ${SYNC_FIELDS.join(', ')}

示例:
{
  "field": "title",
  "value": "修复登录问题",
  "preview": "更新了任务标题"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      field: {
        type: 'string',
        enum: [...SYNC_FIELDS],
        description: '要更新的表单字段',
      },
      value: {
        description: '字段的值',
      },
      preview: {
        type: 'string',
        description: '显示在同步按钮上的人类可读摘要',
      },
    },
    required: ['field', 'value', 'preview'],
  },
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [writeOutputTool],
}))
```

### 工具处理器

处理器验证输入并返回特定 JSON 结构的结果。CCAAS 后端 EventMapper 在工具结果中检测 `{ data: { field, value }, status }` 结构来发出 `output_update` 事件。

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (name === 'write_output') {
    const { field, value, preview } = args as {
      field: string; value: unknown; preview: string
    }

    // 验证字段名
    if (!SYNC_FIELDS.includes(field as SyncField)) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            data: { error: `无效字段: ${field}` },
            status: 'error',
          }),
        }],
        isError: true,
      }
    }

    // 返回结构化结果
    // EventMapper 检测这个 { data: { field, value }, status } 结构
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: { field, value, preview },
          status: 'success',
        }),
      }],
    }
  }

  return {
    content: [{ type: 'text', text: `未知工具: ${name}` }],
    isError: true,
  }
})

// 启动服务器
const transport = new StdioServerTransport()
await server.connect(transport)
```

**要点：**
- 工具结果必须是 content block 中的 JSON 字符串 `[{ type: 'text', text: '...' }]`
- JSON 必须具有 `{ data: { field, value, preview? }, status: 'success' }` 的形状
- CCAAS 后端的 EventMapper 检测到此结构后会发出 `output_update`

### 添加 Zod 验证

生产环境中，应在返回前用 Zod Schema 验证值。lesson-plan-designer MCP Server 使用 `validateAndFixField` 函数，可自动修正常见问题（如将字符串 `"3"` 转为数字 `3`）。

```typescript
// mcp-server/src/schemas.ts
import { z } from 'zod'

const fieldSchemas: Record<string, z.ZodSchema> = {
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['todo', 'in_progress', 'done']),
  tags: z.array(z.string()),
}

export function validateField(field: string, value: unknown) {
  const schema = fieldSchemas[field]
  if (!schema) return { success: false, errors: ['未知字段'] }
  const result = schema.safeParse(value)
  return result.success
    ? { success: true, data: result.data }
    : { success: false, errors: result.error.issues.map(i => i.message) }
}
```

## output\_update 事件结构

当 CCAAS 后端接收到 `write_output` 工具结果时，EventMapper 将其包装为 `output_update` WebSocket 事件。`@kedge-agentic/common` 包定义了 Schema：

```typescript
// 来自 @kedge-agentic/common - OutputUpdatePayloadSchema (Zod)
{
  field?: string,          // 字段名（通用格式时使用）
  value?: unknown,         // 字段值（通用格式时使用）
  operation?: 'set' | 'append' | 'merge',
  progressive?: boolean,
  complete?: boolean,
  data?: unknown,          // 来自 write_output 的嵌套数据（主要格式）
  status?: string,
  progress?: number,
}
```

前端收到的完整事件结构：

```typescript
{
  type: 'output_update',
  sessionId: 'session-abc',
  timestamp: '2026-02-15T10:30:00Z',
  payload: {
    data: {                    // <-- 嵌套在 payload.data 中
      field: 'objectives',     // 字段名
      value: '...',            // 字段值
      preview: '2个学习目标',   // 人类可读摘要
    },
    status: 'success',
  }
}
```

{% hint style="danger" %}
**最常见的错误**：访问 `event.payload.field` 而不是 `event.payload.data.field`。`write_output` 返回的数据比你预期的多嵌套了一层。始终通过 `event.payload.data` 访问字段数据。

这是 lesson-plan-designer 中的一个真实生产 Bug：前端定义了本地的 `OutputUpdateEvent` 类型，期望 flat 结构，但后端 EventMapper 实际发送嵌套的 `payload.data` 结构。修复方法是使用 `@kedge-agentic/common` 的类型定义并创建专门的解析器。
{% endhint %}

### 多种事件格式

后端可能以多种格式发送 `output_update` 事件，取决于数据的来源方式。react-sdk 的 `parseOutputUpdate` 函数处理所有三种格式：

```typescript
// 来自 packages/react-sdk/src/utils/parseOutputUpdate.ts

// 格式 1: payload.data.field（主要格式 - 来自 write_output MCP 工具）
event.payload.data = { field: 'title', value: '...', preview: '...' }

// 格式 2: payload.data 为 content blocks 数组
event.payload.data = [{ type: 'text', text: '{"data":{"field":"title","value":"..."}}' }]

// 格式 3: payload.field（通用/遗留格式）
event.payload = { field: 'title', value: '...' }
```

如果使用 react-sdk 的 `onOutputUpdate` 回调，你不需要手动处理这些格式。SDK 会将它们标准化为一致的 `OutputUpdate` 结构：

```typescript
interface OutputUpdate {
  field: string
  value: unknown
  preview: string
  synced?: boolean
  syncedAt?: Date
  timestamp?: number
}
```

## 在前端接收 output\_update

### 使用 react-sdk（推荐）

`useAgentChat` Hook 提供 `onOutputUpdate` 回调，在每次收到有效的 `output_update` 事件时触发。SDK 自动处理解析、格式标准化和消息附加。

```typescript
// 来自 solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSession.ts

import { useAgentConnection, useAgentChat } from '@kedge-agentic/react-sdk'

const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',  // Core CCAAS 后端
  tenantId: 'my-solution',
  autoConnect: true,
})

const chat = useAgentChat({
  connection,
  tenantId: 'my-solution',
  sessionTemplate: 'my-solution',  // 服务端解析 MCP 服务器、技能等配置
  onOutputUpdate: (update) => {
    // update = { field, value, preview, timestamp }
    // 桥接到同步状态管理
    addPendingUpdate({
      field: update.field,
      value: update.value,
      preview: update.preview,
    })
  },
})
```

SDK 还处理了一条辅助检测路径：当 `tool_event` 触发且工具名匹配 `*write_output` 时，SDK 从工具输入中提取 `{ field, value }` 并调用相同的 `onOutputUpdate` 回调。这确保即使 `output_update` 事件丢失，输出更新也能被捕获。

### 手动解析（不使用 SDK）

如果不使用 react-sdk，可以手动解析事件。使用 `@kedge-agentic/common` 的类型确保类型安全：

```typescript
import type { OutputUpdateEvent } from '@kedge-agentic/common'

socket.on('output_update', (event: OutputUpdateEvent) => {
  // 先尝试 payload.data（主要格式）
  const data = event.payload.data as { field?: string; value?: unknown; preview?: string }
  if (data?.field) {
    handleUpdate(data.field, data.value, data.preview)
    return
  }

  // 回退到 payload.field（通用格式）
  if (event.payload.field) {
    handleUpdate(event.payload.field, event.payload.value, '')
  }
})
```

## SyncCard 审批模式

在生产环境的 Solution 中，AI 生成的字段更新不应直接应用到表单。而是缓存为"待处理"状态，以 SyncCard 的形式呈现给用户审核。

### 架构概览

```
onOutputUpdate({ field, value, preview })
        │
        ▼
  addPendingUpdate()  ──→  pendingUpdates Map<SyncField, OutputUpdate>
        │
        ▼
  SyncCard UI  ──→  "同步到表单" | "忽略"
        │                    │
        ▼                    ▼
  syncToForm(field)    discardUpdate(field)
        │                    │
        ▼                    ▼
  更新表单状态          从 pendingUpdates 中删除
  添加到 undoStack
  标记为已同步
```

### useLessonPlanSync Hook（真实实现）

lesson-plan-designer 用一个专门的 Hook 实现了这个模式。关键设计决策：

1. **基于 Map 的存储** (`Map<SyncField, OutputUpdate>`) -- 同一字段的更新自动去重
2. **值标准化** -- 每种字段类型有特定的转换规则（如 `gradeLevel` 总是数字）
3. **定时撤销** -- 同步后保存前值 30 秒以支持撤销

```typescript
// 简化自 solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSync.ts

export function useLessonPlanSync() {
  const [pendingUpdates, setPendingUpdates] = useState<Map<SyncField, OutputUpdate>>(new Map())
  const [modifiedFields, setModifiedFields] = useState<Set<SyncField>>(new Set())
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])

  // 从 AI 添加待处理更新
  const addPendingUpdate = useCallback((update: OutputUpdate) => {
    setPendingUpdates(prev => {
      const next = new Map(prev)
      next.set(update.field, update)  // 按字段名去重
      return next
    })
  }, [])

  // 同步：将 AI 的值应用到表单，保存前值用于撤销
  const syncToForm = useCallback((field, lessonPlan, setLessonPlan) => {
    const update = pendingUpdates.get(field)
    if (!update) return

    const normalizedValue = normalizeFieldValue(field, update.value)
    const previousValue = lessonPlan[field]

    setLessonPlan({ ...lessonPlan, [field]: normalizedValue })
    setModifiedFields(prev => new Set(prev).add(field))
    setUndoStack(prev => [...prev.filter(e => e.field !== field), {
      field, previousValue, timestamp: Date.now()
    }])

    // 标记为已同步（保留在 Map 中以支持重新同步）
    setPendingUpdates(prev => {
      const next = new Map(prev)
      next.set(field, { ...update, synced: true, syncedAt: new Date() })
      return next
    })

    // 30 秒后自动过期撤销
    setTimeout(() => {
      setUndoStack(prev => prev.filter(e => e.field !== field))
    }, 30000)
  }, [pendingUpdates])

  // 忽略：移除建议
  const removePendingUpdate = useCallback((field: SyncField) => {
    setPendingUpdates(prev => {
      const next = new Map(prev)
      next.delete(field)
      return next
    })
  }, [])

  return { pendingUpdates, modifiedFields, addPendingUpdate, syncToForm, removePendingUpdate, ... }
}
```

### 值标准化

一个微妙但重要的细节：AI 可能以意外的格式返回值（如数字字段返回字符串 `"3"`）。同步 Hook 按字段类型标准化值：

```typescript
// 来自 solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSync.ts

function normalizeFieldValue(field: SyncField, value: unknown): unknown {
  value = parseJsonIfString(value)  // 将 "[1,2,3]" 字符串解析为数组

  if (field === 'gradeLevel' || field === 'durationMinutes') {
    return Number(value) || (field === 'gradeLevel' ? 1 : 45)
  }

  if (field === 'curriculumRequirements') {
    return Array.isArray(value) ? value : []
  }

  if (field === 'extraProperties') {
    return (typeof value === 'object' && !Array.isArray(value)) ? value : {}
  }

  // 其他所有字段：字符串
  return value == null ? null : String(value)
}
```

### 全部同步

lesson-plan-designer 支持一次性同步所有待处理更新。它遍历 `pendingUpdates` Map 并对每个字段调用 `syncToForm`：

```typescript
// 来自 solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSession.ts

const syncAll = useCallback(async () => {
  if (!crud.lessonPlan) return

  const allFields = Array.from(pendingUpdates.keys())
  for (const field of allFields) {
    await syncToForm(field)
  }
}, [crud.lessonPlan, pendingUpdates, syncToForm])
```

## UI 组件

### OutputUpdateCard (react-sdk)

`@kedge-agentic/react-sdk` 提供了通用的 `OutputUpdateCard` 组件，渲染待处理更新的同步/忽略操作，以及已同步状态的重新同步选项。

```tsx
import { OutputUpdateCard } from '@kedge-agentic/react-sdk'

<OutputUpdateCard
  field="objectives"
  fieldLabel="学习目标"
  preview="关于分数的2个学习目标"
  synced={false}
  onSync={() => syncToForm('objectives')}
  onDiscard={() => discardUpdate('objectives')}
/>
```

Props：

| Prop | 类型 | 说明 |
|------|------|------|
| `field` | `string` | 内部字段名 |
| `fieldLabel` | `string` | 显示在卡片中的人类可读标签 |
| `preview` | `string` | AI 建议值的预览文本 |
| `synced` | `boolean` | 字段是否已同步 |
| `syncedAt` | `Date` | 上次同步的时间戳 |
| `icon` | `'sync' \| 'attach' \| ReactNode` | 显示的图标 |
| `syncLabel` | `string` | 同步按钮的自定义标签 |
| `onSync` | `() => void` | 用户点击同步时调用 |
| `onDiscard` | `() => void` | 用户点击忽略时调用 |

### 字段标签映射

Solution 定义从内部字段名到用户友好标签的映射：

```typescript
// 来自 solutions/lesson-plan-designer/frontend/src/components/SyncButton.tsx

const FIELD_LABELS: Record<SyncField, string> = {
  title: '标题',
  subject: '学科',
  gradeLevel: '年级',
  durationMinutes: '课时',
  objectives: '学习目标',
  content: '学习过程',
  teachingMethods: '教学方法',
  materialsNeeded: '课前准备',
  assessmentMethods: '作业检测',
  // ... 等等
}

// Solution 对 OutputUpdateCard 的封装
export function SyncButton({ field, preview, synced, syncedAt, onSync, onDiscard }) {
  return (
    <OutputUpdateCard
      field={field}
      fieldLabel={FIELD_LABELS[field]}
      preview={preview}
      synced={synced}
      syncedAt={syncedAt}
      onSync={onSync}
      onDiscard={onDiscard}
    />
  )
}
```

### GlobalSyncSection

lesson-plan-designer 还提供了一个可折叠的全局同步区域，显示所有待处理更新并提供"全部同步"按钮：

```tsx
// 来自 solutions/lesson-plan-designer/frontend/src/components/sync/GlobalSyncSection.tsx

<GlobalSyncSection
  pendingUpdates={pendingUpdatesWithMeta}
  onSyncAll={syncAll}
  onSyncField={syncToForm}
  onDiscardField={discardUpdate}
/>
```

该组件：
- 在标题栏显示未同步和已同步的更新计数
- 展开后显示单个同步项，支持逐字段同步/忽略
- 提供"全部同步"按钮一次性应用所有更新
- 所有更新同步后自动折叠

## 在 Skill 中定义 write\_output

Skill 指令告诉 AI Agent 哪些字段可用，每个字段的格式要求。要明确指定字段名、类型和 `preview` 参数：

```markdown
# 输出格式

使用 write_output 工具将结构化数据发送到前端表单。
用户会看到每个你更新的字段对应的"同步到表单"按钮。

每个字段调用一次 write_output。始终包含人类可读的 preview。

可用字段：
- field: "title"       -> string, 任务标题
- field: "description" -> string, 任务描述（最多 2000 字符）
- field: "priority"    -> "low" | "medium" | "high" | "urgent"
- field: "status"      -> "todo" | "in_progress" | "done"
- field: "tags"        -> string[], 标签列表

示例：
1. write_output({ field: "title", value: "修复登录问题", preview: "更新标题" })
2. write_output({ field: "priority", value: "high", preview: "设为高优先级" })
3. write_output({ field: "tags", value: ["bug", "auth"], preview: "2个标签" })
```

## 故障排除

### output\_update 事件未到达

1. 验证 MCP Server 已在 solution.json 或会话模板中注册
2. 验证 MCP 工具返回了 `{ data: { field, value }, status }` 结构的 JSON
3. 检查 CCAAS 后端日志中的 EventMapper 解析错误
4. 使用浏览器 DevTools 的 Network 标签检查 WebSocket 帧中的 `output_update`

### SyncCard 不显示

1. 确认 `onOutputUpdate` 回调已传递给 `useAgentChat`
2. 验证回调正确地添加到了 `pendingUpdates` 状态
3. 检查渲染 SyncCard 的组件是否读取了相同的状态
4. 打印原始事件验证 `payload.data.field` 路径存在

### AI 输出与表单之间的类型不匹配

1. 在 MCP Server 的 `write_output` 处理器中添加 Zod 验证
2. 在同步 Hook 中添加标准化（参见上文的 `normalizeFieldValue`）
3. 在 Skill 指令中指定确切类型（如 `string[]` 而非仅仅 "array"）

### 同步后的值未持久化

1. 验证 `syncToForm` 更新的是表单状态对象（而非过期副本）
2. 检查表单状态是否连接到了保存/持久化逻辑
3. 确保 `normalizeFieldValue` 返回了表单 Schema 对应的正确类型

## 要点总结

1. **`write_output` 使用 `@modelcontextprotocol/sdk`** -- 不是 Express。工具结果必须在 MCP content blocks 中返回 `{ data: { field, value, preview }, status }` 的 JSON。

2. **`output_update` 有嵌套结构** -- 始终访问 `event.payload.data.field`，而非 `event.payload.field`。这是一个真实的生产 Bug。

3. **使用 react-sdk 的 `onOutputUpdate` 回调** -- 它自动处理格式标准化、回退路径和消息附加。

4. **SyncCard 模式是生产环境方案** -- 在 Map 中缓存更新，提供同步/忽略 UI，支持带超时的撤销。

5. **标准化字段值** -- AI 可能对数字字段返回字符串，或对数组字段返回 JSON 字符串。写入表单状态前始终标准化。

6. **react-sdk 的 `OutputUpdateCard`** -- 提供开箱即用的组件，Solution 用字段标签映射对其进行封装。

## 下一步

在[第 6 章](06-implementation/README.md)中，我们将把所有内容整合在一起，从项目初始化到构建一个完整工作的 Solution -- 包括后端、MCP Server、Skills 和前端。
