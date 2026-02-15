# 5. 表单与 output\_update 协议

`output_update` 协议是将 AI Agent 输出转化为前端可在表单、表格和其他 UI 元素中渲染的结构化数据的机制。本章深入讲解 `write_output` 在 MCP Server 端的工作原理、`output_update` 事件的结构，以及如何在 Solution 前端构建健壮的表单同步。

## 学习目标

完成本章后，你将能够：

- 在 Solution 的 MCP Server 中实现 `write_output` 工具
- 正确解析 `output_update` 事件（包括嵌套结构）
- 处理三种操作类型：`set`、`append` 和 `merge`
- 实现 SyncCard 审批模式以支持人机协同审核
- 使用 Vue SDK 的 `useFormBridge` 和 React SDK 的 `SyncCardPanel` 组件

## write\_output 管道

`write_output` 工具是 AI 推理与前端表单状态之间的桥梁。以下是数据在管道中的流转方式：

```
┌─────────────────────────────────────────────────────────────────────┐
│ AI Agent                                                            │
│                                                                     │
│ "我需要将任务标题设置为 'Fix login bug'"                              │
│                     │                                               │
│                     ▼                                               │
│ 调用 write_output({ field: 'title', value: 'Fix login bug' })      │
└─────────────────────┼───────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────────┐
│ MCP Server                                                          │
│                                                                     │
│ 1. 接收工具调用                                                      │
│ 2. 验证字段名是否在允许列表中                                         │
│ 3. 使用 Zod 验证值的类型                                             │
│ 4. 返回 { data: { field, value, operation }, status: 'success' }    │
└─────────────────────┼───────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────────┐
│ CCAAS 后端                                                          │
│                                                                     │
│ 1. 从 Agent 进程接收工具结果                                         │
│ 2. 包装为 output_update 事件                                        │
│ 3. 通过 WebSocket 推送到 Solution 后端                               │
└─────────────────────┼───────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────────┐
│ Solution 前端                                                       │
│                                                                     │
│ 1. 接收 output_update 事件                                          │
│ 2. 解析 event.payload.data                                          │
│ 3. 更新表单状态或缓存为待审批的 SyncCard                              │
└─────────────────────────────────────────────────────────────────────┘
```

## 在 MCP Server 中实现 write\_output

### 基本实现

`write_output` 工具定义在 Solution 的 MCP Server 中。以下是 Task Manager 的最小实现：

```typescript
// mcp-server/src/index.ts
import express from 'express'
import { z } from 'zod'

const app = express()
app.use(express.json())

// 定义有效字段及其 Schema
const TaskFieldSchemas = {
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['todo', 'in_progress', 'done']),
  assignee: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  tags: z.array(z.string()),
}

type TaskField = keyof typeof TaskFieldSchemas

// 工具定义端点（CCAAS 调用以发现工具）
app.get('/tools', (req, res) => {
  res.json([
    {
      name: 'write_output',
      description: '将结构化数据写入前端表单。每个字段调用一次。',
      inputSchema: {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            enum: Object.keys(TaskFieldSchemas),
            description: '要更新的表单字段',
          },
          value: {
            description: '要设置的字段值',
          },
          operation: {
            type: 'string',
            enum: ['set', 'append', 'merge'],
            default: 'set',
            description: '如何应用更新',
          },
        },
        required: ['field', 'value'],
      },
    },
  ])
})

// 工具执行端点
app.post('/tools/write_output', (req, res) => {
  const { field, value, operation = 'set' } = req.body

  // 验证字段名
  if (!(field in TaskFieldSchemas)) {
    return res.status(400).json({
      error: `无效字段: "${field}"`,
      validFields: Object.keys(TaskFieldSchemas),
    })
  }

  // 使用 Schema 验证值
  const schema = TaskFieldSchemas[field as TaskField]
  const result = schema.safeParse(value)
  if (!result.success) {
    return res.status(400).json({
      error: '验证失败',
      field,
      details: result.error.issues,
    })
  }

  // 返回结构化响应
  // CCAAS 会将此包装为 output_update 事件
  res.json({
    data: {
      field,
      value: result.data,
      operation,
    },
    status: 'success',
  })
})

app.listen(3004, () => {
  console.log('Task Manager MCP Server 运行在 :3004')
})
```

### 在 Skill 中定义 write\_output

Skill 指令告诉 AI Agent 如何使用 `write_output`。要明确指定字段名和期望的格式：

```markdown
# 输出格式

使用 write_output 工具输出任务数据。每个字段调用一次。

可用字段：
- field: "title" -> 任务标题 (string, 必填)
- field: "description" -> 任务描述 (string, 可选)
- field: "priority" -> 优先级: "low" | "medium" | "high" | "urgent"
- field: "status" -> 任务状态: "todo" | "in_progress" | "done"
- field: "assignee" -> 负责人姓名 (string)
- field: "dueDate" -> 截止日期，ISO 8601 格式
- field: "tags" -> 标签数组 (string[])

示例调用序列：
1. write_output({ field: "title", value: "Fix login bug" })
2. write_output({ field: "priority", value: "high" })
3. write_output({ field: "status", value: "todo" })
4. write_output({ field: "tags", value: ["bug", "auth"] })
```

## output\_update 事件结构

当 CCAAS 后端接收到 `write_output` 的结果时，它会将其包装为 `output_update` WebSocket 事件。理解此结构至关重要。

### 事件 Schema

```typescript
interface OutputUpdateEvent {
  type: 'output_update'
  sessionId: string
  timestamp?: string
  payload: {
    data: {                        // <-- 嵌套在 payload.data 中
      field: string                // 字段名 (例如 'title')
      value: unknown               // 字段值
      operation?: 'set' | 'append' | 'merge'
      preview?: string             // 人类可读的预览
    }
    progressive?: boolean          // 是否是流式序列的一部分？
    complete?: boolean             // 是否是最终更新？
    status?: string                // 'success' | 'error'
    progress?: number              // 0-100 进度指示器
  }
}
```

{% hint style="danger" %}
**最常见的错误**：访问 `event.payload.field` 而不是 `event.payload.data.field`。数据比你预期的多嵌套了一层。始终通过 `event.payload.data` 访问字段数据。
{% endhint %}

### 正确 vs 错误的解析方式

```typescript
socket.on('output_update', (event) => {
  // 错误 - 将会是 undefined
  const field = event.payload.field       // undefined!
  const value = event.payload.value       // undefined!
  const field2 = event.field              // undefined!

  // 正确
  const { field, value, operation } = event.payload.data
})
```

### 使用 Zod Schema 进行验证

`@ccaas/common` 包提供了用于运行时验证的 Zod Schema：

```typescript
import { OutputUpdateEventSchema } from '@ccaas/common'

socket.on('output_update', (raw) => {
  const result = OutputUpdateEventSchema.safeParse(raw)
  if (!result.success) {
    console.error('无效的 output_update 事件:', result.error)
    return
  }

  const event = result.data
  const { field, value, operation } = event.payload
  // field, value, operation 现在是类型安全的
})
```

## 操作类型

`write_output` 工具支持三种操作类型，对应不同的更新语义。

### set -- 替换值

默认且最常用的操作。完全替换字段值：

```typescript
// MCP 工具调用
write_output({ field: 'title', value: 'Fix login bug', operation: 'set' })

// 前端处理
case 'set':
  formState[field] = value
  break
```

使用 `set` 的场景：标量字段（字符串、数字、枚举）、替换整个数组、替换整个对象。

### append -- 追加到已有值

追加到数组或拼接到字符串：

```typescript
// MCP 工具调用 - 追加到数组
write_output({
  field: 'tags',
  value: 'urgent',
  operation: 'append'
})

// 前端处理
case 'append':
  if (Array.isArray(formState[field])) {
    formState[field] = [...formState[field], value]
  } else if (typeof formState[field] === 'string') {
    formState[field] = formState[field] + String(value)
  }
  break
```

使用 `append` 的场景：逐一添加列表项、增量构建文本、渐进式内容生成。

### merge -- 合并到对象

将对象浅合并到已有的对象字段：

```typescript
// MCP 工具调用 - 合并到对象
write_output({
  field: 'metadata',
  value: { estimatedHours: 4, complexity: 'medium' },
  operation: 'merge'
})

// 前端处理
case 'merge':
  formState[field] = {
    ...(formState[field] || {}),
    ...value
  }
  break
```

使用 `merge` 的场景：更新对象字段的特定属性而不替换整个对象、增量对象构建。

## 前端表单同步模式

处理 `output_update` 事件有两种主要方式：**直接应用**和 **SyncCard 审批**。

### 模式 A：直接应用

最简单的方式 -- 更新到达时直接应用到表单：

```typescript
// React：直接应用模式
function useDirectFormSync(socket: Socket) {
  const [formData, setFormData] = useState<Record<string, unknown>>({})

  useEffect(() => {
    const handler = (event: OutputUpdateEvent) => {
      const { field, value, operation = 'set' } = event.payload.data

      setFormData(prev => applyOperation(prev, field, value, operation))
    }

    socket.on('output_update', handler)
    return () => { socket.off('output_update', handler) }
  }, [socket])

  return { formData, setFormData }
}

// 共享的操作逻辑
function applyOperation(
  state: Record<string, unknown>,
  field: string,
  value: unknown,
  operation: string
): Record<string, unknown> {
  switch (operation) {
    case 'set':
      return { ...state, [field]: value }
    case 'append': {
      const existing = state[field]
      if (Array.isArray(existing)) {
        return { ...state, [field]: [...existing, value] }
      }
      return { ...state, [field]: (existing || '') + String(value) }
    }
    case 'merge':
      return {
        ...state,
        [field]: { ...(state[field] as object || {}), ...(value as object) },
      }
    default:
      return { ...state, [field]: value }
  }
}
```

**适用场景**：原型开发、简单表单、AI 输出总是可信赖的情况。

### 模式 B：SyncCard 审批（人机协同）

生产环境 Solution 的推荐方式。更新被缓存为"待处理"状态，并以 SyncCard 的形式呈现给用户审批：

```typescript
// React：SyncCard 审批模式
function useSyncCardManager(socket: Socket) {
  const [pendingUpdates, setPendingUpdates] = useState<OutputUpdate[]>([])
  const [formData, setFormData] = useState<Record<string, unknown>>({})

  // 缓存传入的更新为待审批的 SyncCard
  useEffect(() => {
    const handler = (event: OutputUpdateEvent) => {
      const { field, value } = event.payload.data
      const preview = typeof value === 'string'
        ? value.substring(0, 80)
        : JSON.stringify(value).substring(0, 80)

      setPendingUpdates(prev => {
        // 替换同一字段的现有更新（保留最新的）
        const filtered = prev.filter(u => u.field !== field)
        return [...filtered, {
          field,
          value,
          preview,
          synced: false,
          timestamp: Date.now(),
        }]
      })
    }

    socket.on('output_update', handler)
    return () => { socket.off('output_update', handler) }
  }, [socket])

  // 用户批准：应用到表单
  const syncField = (field: string) => {
    const update = pendingUpdates.find(u => u.field === field)
    if (!update) return

    setFormData(prev => ({ ...prev, [field]: update.value }))
    setPendingUpdates(prev =>
      prev.map(u => u.field === field
        ? { ...u, synced: true, syncedAt: new Date() }
        : u
      )
    )
  }

  // 用户拒绝：丢弃建议
  const discardField = (field: string) => {
    setPendingUpdates(prev => prev.filter(u => u.field !== field))
  }

  return {
    pendingUpdates,
    formData,
    setFormData,
    syncField,
    discardField,
  }
}
```

**适用场景**：生产环境 Solution、包含重要数据的表单、需要人工审核的场景。

### 使用 React SDK 的 SyncCardPanel

`@ccaas/react-sdk` 提供了开箱即用的 SyncCard 模式组件：

```tsx
import { SyncCardPanel } from '@ccaas/react-sdk'

function TaskForm() {
  const {
    pendingUpdates,
    formData,
    syncField,
    discardField,
  } = useSyncCardManager(socket)

  return (
    <div>
      {/* 表单字段 */}
      <input
        value={formData.title as string || ''}
        onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
      />

      {/* 底部 SyncCard 面板 */}
      <SyncCardPanel
        outputUpdates={pendingUpdates}
        onSync={syncField}
        onDiscard={discardField}
        renderSyncCard={(update, onSync, onDiscard) => (
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
            <div className="flex-1">
              <div className="text-sm font-medium">{update.field}</div>
              <div className="text-xs text-gray-500">{update.preview}</div>
            </div>
            <button onClick={onSync}>同步</button>
            <button onClick={onDiscard}>丢弃</button>
          </div>
        )}
      />
    </div>
  )
}
```

### 使用 Vue SDK 的 FormBridge

`@ccaas/vue-sdk` 提供了 `useFormBridge` composable，用于自动注册和同步表单：

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import { useFormBridge } from '@ccaas/vue-sdk'

const form = reactive({
  title: '',
  description: '',
  priority: 'medium',
  tags: [],
})

const { isActive } = useFormBridge({
  formId: 'task-form',
  readonly: false,
  getFormState: () => ({ ...form }),
  applyFormData: async (data) => {
    Object.assign(form, data)
    return {
      success: true,
      appliedFields: Object.keys(data),
    }
  },
  submit: async () => {
    await saveTask(form)
    return { success: true }
  },
})
</script>

<template>
  <form>
    <div v-if="isActive" class="text-sm text-green-600">
      已连接到 AI Agent
    </div>

    <input v-model="form.title" placeholder="任务标题" />
    <textarea v-model="form.description" placeholder="描述" />
    <select v-model="form.priority">
      <option value="low">低</option>
      <option value="medium">中</option>
      <option value="high">高</option>
      <option value="urgent">紧急</option>
    </select>
  </form>
</template>
```

Vue SDK 的 `FormStateSynchronizer` 自动处理 `output_update` 事件与响应式表单状态之间的连接：

```
output_update 事件
       │
       ▼
AgentListener (监听 output_update)
       │
       ▼
FormStateSynchronizer.updateField(formId, field, value, 'agent')
       │
       ▼
Vue 响应式表单状态 (自动更新模板)
```

## 高级模式

### 渐进式输出

对于长时间运行的任务，可以发送渐进式更新来显示进度：

```typescript
// MCP Server：渐进式输出
app.post('/tools/write_output', (req, res) => {
  const { field, value, operation = 'set' } = req.body

  res.json({
    data: { field, value, operation },
    progressive: true,    // 表示还有更多更新
    complete: false,       // 不是最终更新
    status: 'success',
    progress: 50,          // 50% 完成
  })
})
```

前端可以使用 `progressive` 和 `progress` 来显示加载状态：

```typescript
socket.on('output_update', (event) => {
  const { progressive, complete, progress } = event.payload

  if (progressive && !complete) {
    showProgressBar(progress)
  }

  if (complete) {
    hideProgressBar()
  }

  // 始终处理数据
  const { field, value } = event.payload.data
  updateField(field, value)
})
```

### 字段级撤销

追踪之前的值以支持同步后的撤销：

```typescript
interface UndoEntry {
  field: string
  previousValue: unknown
  timestamp: number
}

function useSyncWithUndo(socket: Socket) {
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])

  const syncField = (field: string, newValue: unknown) => {
    // 保存当前值用于撤销
    setUndoStack(prev => [...prev, {
      field,
      previousValue: formData[field],
      timestamp: Date.now(),
    }])

    // 应用新值
    setFormData(prev => ({ ...prev, [field]: newValue }))
  }

  const undoField = (field: string) => {
    const entry = [...undoStack].reverse().find(e => e.field === field)
    if (entry) {
      setFormData(prev => ({ ...prev, [field]: entry.previousValue }))
      setUndoStack(prev => prev.filter(e => e !== entry))
    }
  }

  return { formData, syncField, undoField, undoStack }
}
```

### 批量更新

当 AI Agent 依次更新多个字段时，你可能希望对它们进行批处理以获得更流畅的用户体验：

```typescript
function useBatchedFormSync(socket: Socket, batchWindowMs = 200) {
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const batchRef = useRef<Record<string, unknown>>({})
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    socket.on('output_update', (event) => {
      const { field, value } = event.payload.data

      // 累积更新
      batchRef.current[field] = value

      // 重置防抖计时器
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      // 窗口关闭后应用批量更新
      timerRef.current = setTimeout(() => {
        const batch = { ...batchRef.current }
        batchRef.current = {}
        setFormData(prev => ({ ...prev, ...batch }))
      }, batchWindowMs)
    })

    return () => {
      socket.off('output_update')
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [socket, batchWindowMs])

  return formData
}
```

### 字段标签映射

将内部字段名映射为用户友好的标签，用于 SyncCard UI：

```typescript
const FIELD_LABELS: Record<string, string> = {
  title: '任务标题',
  description: '描述',
  priority: '优先级',
  status: '状态',
  assignee: '负责人',
  dueDate: '截止日期',
  tags: '标签',
}

// 在 SyncCard 渲染中
<OutputUpdateCard
  field={update.field}
  fieldLabel={FIELD_LABELS[update.field] || update.field}
  preview={update.preview}
  onSync={() => syncField(update.field)}
  onDiscard={() => discardField(update.field)}
/>
```

## 完整示例：Task Manager 表单同步

以下是一个完整的、可运行的示例，将本章所有概念整合在一起：

```typescript
// hooks/useTaskFormSync.ts
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Socket } from 'socket.io-client'

interface TaskFormData {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'todo' | 'in_progress' | 'done'
  assignee: string
  tags: string[]
}

interface PendingUpdate {
  field: keyof TaskFormData
  value: unknown
  preview: string
  synced: boolean
  syncedAt?: Date
  timestamp: number
}

const INITIAL_FORM: TaskFormData = {
  title: '',
  description: '',
  priority: 'medium',
  status: 'todo',
  assignee: '',
  tags: [],
}

export function useTaskFormSync(socket: Socket | null) {
  const [formData, setFormData] = useState<TaskFormData>(INITIAL_FORM)
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([])

  // 监听 output_update 事件
  useEffect(() => {
    if (!socket) return

    const handler = (event: any) => {
      // 正确：访问嵌套的 payload.data
      const data = event.payload?.data
      if (!data?.field) return

      const { field, value } = data
      const preview = typeof value === 'string'
        ? value.substring(0, 100)
        : Array.isArray(value)
        ? `[${value.length} 项]`
        : JSON.stringify(value).substring(0, 100)

      setPendingUpdates(prev => {
        const filtered = prev.filter(u => u.field !== field)
        return [...filtered, {
          field: field as keyof TaskFormData,
          value,
          preview,
          synced: false,
          timestamp: Date.now(),
        }]
      })
    }

    socket.on('output_update', handler)
    return () => { socket.off('output_update', handler) }
  }, [socket])

  // 同步单个字段
  const syncField = useCallback((field: string) => {
    const update = pendingUpdates.find(u => u.field === field)
    if (!update) return

    setFormData(prev => ({
      ...prev,
      [field]: update.value,
    }))

    setPendingUpdates(prev =>
      prev.map(u =>
        u.field === field
          ? { ...u, synced: true, syncedAt: new Date() }
          : u
      )
    )
  }, [pendingUpdates])

  // 同步所有待处理字段
  const syncAll = useCallback(() => {
    const updates: Partial<TaskFormData> = {}
    for (const u of pendingUpdates.filter(u => !u.synced)) {
      updates[u.field] = u.value as any
    }

    setFormData(prev => ({ ...prev, ...updates }))
    setPendingUpdates(prev =>
      prev.map(u => ({ ...u, synced: true, syncedAt: new Date() }))
    )
  }, [pendingUpdates])

  // 丢弃某个字段
  const discardField = useCallback((field: string) => {
    setPendingUpdates(prev => prev.filter(u => u.field !== field))
  }, [])

  // 重置表单
  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM)
    setPendingUpdates([])
  }, [])

  return {
    formData,
    setFormData,
    pendingUpdates,
    syncField,
    syncAll,
    discardField,
    resetForm,
  }
}
```

## 故障排除

### output\_update 事件未到达

1. 验证 MCP Server 已在 CCAAS 注册（检查 `solution.json`）
2. 验证 Skill 的 `allowedTools` 包含 `write_output`
3. 检查 Solution 后端是否从 CCAAS 中继了 `output_update` 事件
4. 使用浏览器 DevTools 检查 WebSocket 帧

### 字段更新了错误的值

1. 在 MCP Server 的 `write_output` 处理器中添加 Zod 验证
2. 确保 Skill 指令中的字段名与 MCP Server 的有效字段匹配
3. 打印原始 `output_update` 事件以验证嵌套结构

### SyncCard 不显示

1. 确认前端在正确的 socket 上监听了 `output_update`
2. 验证正在解析 `event.payload.data` 路径（而非 `event.payload`）
3. 检查待处理更新是否被过滤掉（检查 `synced` 标志）

### AI 输出与表单之间的类型不匹配

1. 在 MCP Server 中为每个字段定义严格的 Zod Schema
2. 在 Skill 指令中指定确切的类型（例如 "string[]" 而非仅仅 "array"）
3. 在 MCP Server 和前端使用相同的 TypeScript 接口

## 练习

### 练习 5.1：实现 write\_output

为 Task Manager MCP Server 创建一个 `write_output` 处理器，包含以下字段：

- `title`（string，1-200 字符）
- `description`（string，最多 2000 字符）
- `priority`（枚举：low/medium/high/urgent）
- `subtasks`（数组：{ title: string, done: boolean }）

为每个字段添加 Zod 验证。

### 练习 5.2：处理 output\_update

编写一个 React Hook：
1. 监听 `output_update` 事件
2. 正确解析嵌套的 `payload.data` 结构
3. 处理所有三种操作类型（`set`、`append`、`merge`）
4. 提供 `pendingUpdates` 数组用于 SyncCard 渲染

### 练习 5.3：设计 SyncCard 流程

为 Task Manager 设计完整的 SyncCard 流程，当 AI 生成包含 5 个字段（title、description、priority、assignee、tags）的任务时：

1. SyncCard 应该以什么顺序出现？
2. 用户应该逐个审批每个字段，还是一次性全部审批？
3. 如果用户手动编辑了一个字段，然后 AI 又发送了该字段的更新，会怎样？
4. 你将如何处理"全部同步"操作？

画一个状态图，展示 SyncCard 的所有可能状态。

## 要点总结

1. **`write_output` 是标准 MCP 工具** -- 在 MCP Server 中实现它并添加字段验证
2. **`output_update` 使用嵌套结构** -- 始终访问 `event.payload.data.field`，而非 `event.field`
3. **三种操作类型** -- `set`（替换）、`append`（追加）、`merge`（浅合并）
4. **SyncCard 模式** 支持人机协同审核 -- 缓存更新并让用户审批
5. **Vue SDK 提供 `useFormBridge`**，React SDK 提供 `SyncCardPanel` 和 `OutputUpdateCard`，用于内置表单同步
6. **双端验证** -- MCP Server 中用 Zod Schema，前端用类型安全的处理器

## 下一步

在[第 6 章](06-implementation/README.md)中，我们将把所有内容整合在一起，从项目初始化到构建一个完整工作的 Task Manager Solution -- 包括后端、MCP Server、Skills 和前端。
