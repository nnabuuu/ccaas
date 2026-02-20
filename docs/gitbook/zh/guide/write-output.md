# write\_output 最佳实践

## 概述

`write_output` 是即见Agentic 中最核心的 MCP 工具，用于将 AI Agent 生成的结构化数据实时同步到前端表单。掌握其正确用法对于构建高质量的 Solution 至关重要。

## 使用时机

核心问题：**agent 的输出是否需要用户按字段独立审阅或应用？**

**使用 `write_output`（结构化输出）的场景：**
- 输出驱动前端表单字段，用户可以独立接受或丢弃每个字段（如 `title`、`objectives`、`activities`）
- 用户需要逐字段审阅并选择性应用
- 不同字段在 UI 的不同位置展示

**直接返回文本即可的场景：**
- 简单问答——用户只需"读"回复
- 分析报告整体展示在 chat 里，不需要同步进表单
- 没有结构化字段需要填写

如果你的 agent 生成教案并填充教师可编辑的表单，使用 `write_output`。如果 agent 只是解释一个概念，在 chat 里返回文本即可。

## 基本机制

```
AI Agent ──调用──→ write_output ──触发──→ output_update 事件 ──推送──→ 前端表单
```

AI Agent 调用 write\_output 工具后，CCAAS 后端会将数据封装为 `output_update` 事件，通过 WebSocket 推送到前端。

## 数据格式

### Skill 中的指令

在 SKILL.md 中明确指定 write\_output 的输出格式：

```markdown
# 输出格式

使用 write_output 工具输出数据，每次调用更新一个字段：

- field: "title" → 课题名称（字符串）
- field: "objectives" → 教学目标（数组）
- field: "activities" → 教学活动（对象数组）
- field: "assessment" → 评估方式（对象）
```

### MCP Server 实现

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'

const VALID_FIELDS = [
  'title', 'objectives', 'activities',
  'assessment', 'materials'
] as const

const server = new Server(
  { name: 'my-solution-tools', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

// 定义 write_output 工具
const writeOutputTool: Tool = {
  name: 'write_output',
  description: `将结构化数据写入前端表单。
有效字段: ${VALID_FIELDS.join(', ')}`,
  inputSchema: {
    type: 'object',
    properties: {
      field: {
        type: 'string',
        enum: [...VALID_FIELDS],
        description: '要更新的表单字段',
      },
      value: {
        description: '字段的值',
      },
      preview: {
        type: 'string',
        description: '同步按钮上显示的可读摘要',
      },
    },
    required: ['field', 'value'],
  },
}

// 注册工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: [writeOutputTool] }
})

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (name === 'write_output') {
    const { field, value, preview } = args as {
      field: string; value: unknown; preview?: string
    }

    // 验证字段名
    if (!VALID_FIELDS.includes(field as any)) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          data: { error: `Invalid field: ${field}` },
          status: 'error',
        })}],
        isError: true,
      }
    }

    // 返回成功 -- CCAAS 会将其封装为 output_update 事件
    return {
      content: [{ type: 'text', text: JSON.stringify({
        data: { field, value, preview },
        status: 'success',
      })}],
    }
  }

  return {
    content: [{ type: 'text', text: JSON.stringify({
      data: { error: `Unknown tool: ${name}` },
      status: 'error',
    })}],
    isError: true,
  }
})

// 启动服务器
const transport = new StdioServerTransport()
await server.connect(transport)
```

### 使用 Zod 进行输出验证

推荐使用 Zod Schema 验证 write\_output 的输出数据，确保数据结构正确：

```typescript
import { z } from 'zod'

// 定义每个字段的 Schema
const fieldSchemas: Record<string, z.ZodType> = {
  title: z.string().min(1),
  objectives: z.array(z.object({
    description: z.string(),
    bloomLevel: z.enum([
      'remember', 'understand', 'apply',
      'analyze', 'evaluate', 'create'
    ])
  })),
  activities: z.array(z.object({
    title: z.string(),
    duration: z.number().min(1),
    type: z.string(),
    description: z.string()
  }))
}

function validateField(field: string, value: unknown) {
  const schema = fieldSchemas[field]
  if (!schema) return { success: true, data: value, errors: [] }

  const result = schema.safeParse(value)
  if (result.success) {
    return { success: true, data: result.data, errors: [] }
  }
  return {
    success: false,
    errors: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
  }
}

// 在 CallToolRequestSchema 处理器中使用:
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (name === 'write_output') {
    const { field, value, preview } = args as {
      field: string; value: unknown; preview?: string
    }

    // 根据字段 Schema 验证值
    const validation = validateField(field, value)
    if (!validation.success) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          data: { error: `Validation failed: ${validation.errors.join('; ')}` },
          status: 'error',
        })}],
        isError: true,
      }
    }

    return {
      content: [{ type: 'text', text: JSON.stringify({
        data: { field, value: validation.data, preview },
        status: 'success',
      })}],
    }
  }

  // ... 处理其他工具
})
```

## 前端处理

### output\_update 事件结构

```typescript
// output_update 事件使用嵌套结构
interface OutputUpdateEvent {
  type: 'output_update'
  sessionId: string
  payload: {
    data: {
      field: string
      value: any
      operation: 'set' | 'append' | 'merge'
    }
    progressive?: boolean
    complete?: boolean
    status?: string
    progress?: number
  }
}
```

{% hint style="danger" %}
**常见错误**：直接访问 `event.field` 而非 `event.payload.data.field`。output\_update 使用嵌套结构，请务必正确解析。
{% endhint %}

### 正确处理示例

```typescript
socket.on('output_update', (event) => {
  // 正确：使用嵌套路径
  const { field, value, operation } = event.payload.data

  switch (operation) {
    case 'set':
      formState[field] = value
      break
    case 'append':
      if (Array.isArray(formState[field])) {
        formState[field].push(value)
      } else {
        formState[field] += value
      }
      break
    case 'merge':
      formState[field] = { ...formState[field], ...value }
      break
  }
})
```

### 使用解析器

推荐使用 `parseOutputUpdateEvent` 解析器统一处理：

```typescript
import { parseOutputUpdateEvent } from '../utils/outputUpdateParser'

socket.on('output_update', (raw) => {
  const parsed = parseOutputUpdateEvent(raw)
  if (parsed) {
    updateField(parsed.field, parsed.value, parsed.operation)
  }
})
```

## 操作类型详解

### set —— 覆盖

最常用的操作，直接覆盖字段值：

```json
{ "field": "title", "value": "新标题", "operation": "set" }
```

### append —— 追加

向数组字段追加元素，或向字符串追加内容：

```json
{ "field": "objectives", "value": {"description": "新增目标"}, "operation": "append" }
```

### merge —— 合并

合并对象字段：

```json
{ "field": "assessment", "value": {"rubric": "新评分标准"}, "operation": "merge" }
```

## ⚠️ 常见错误：将 value 放在 \_meta 中

以下实现**看似合理但实际无效**：

```typescript
// ❌ 错误：EventMapper 不读取 _meta，value 不会被传递到前端
return {
  content: [{ type: 'text', text: JSON.stringify({ success: true, field, preview }) }],
  _meta: { outputUpdate: { field, value, preview } },  // 被忽略！
}
```

CCAAS EventMapper 处理 write\_output 时，**只读取 `content[].text` 的 JSON**：

```
parsedResult.data || parsedResult → payload.data
```

`_meta` 字段会被 EventMapper 完全忽略。前端会收到 `output_update` 事件，但 `payload.data` 中没有 `value`，表单字段不会更新。

正确实现（`value` 必须在 `content[].text` 的 JSON 中）：

```typescript
// ✅ 正确：data 对象（含 value）在 content[].text 的 JSON 中
return {
  content: [{ type: 'text', text: JSON.stringify({
    data: { field, value, preview },
    status: 'success',
  })}],
}
```

{% hint style="info" %}
参考实现：`solutions/demo/01-write-output/mcp-server/src/index.ts` 演示了正确模式，并在代码注释中对比了错误用法。
{% endhint %}

## 常见问题

### write\_output 不显示

1. 确认 MCP Server 已正确注册到 CCAAS
2. 确认 Skill 的 `allowedTools` 包含 `write_output`
3. 检查前端是否正确监听 `output_update` 事件
4. 检查嵌套结构解析是否正确

### 数据格式不匹配

1. 在 MCP Server 中添加 Zod 验证
2. 确认 Skill 指令中的格式与前端类型定义一致
3. 使用 `parseOutputUpdateEvent` 统一解析

### 字段更新不生效

1. 确认 `field` 值与前端表单字段名完全一致
2. 检查 `operation` 类型是否正确
3. 确认前端对应字段的状态更新逻辑
