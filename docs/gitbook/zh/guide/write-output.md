# write\_output 最佳实践

## 概述

`write_output` 是 LoopAI 中最核心的 MCP 工具，用于将 AI Agent 生成的结构化数据实时同步到前端表单。掌握其正确用法对于构建高质量的 Solution 至关重要。

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
app.post('/tools/write_output', (req, res) => {
  const { field, value, operation = 'set' } = req.body

  // 验证字段名
  const VALID_FIELDS = [
    'title', 'objectives', 'activities',
    'assessment', 'materials'
  ]

  if (!VALID_FIELDS.includes(field)) {
    return res.status(400).json({
      error: `Invalid field: ${field}`,
      validFields: VALID_FIELDS
    })
  }

  res.json({
    data: { field, value, operation },
    status: 'success'
  })
})
```

### 使用 Zod 进行输出验证

推荐使用 Zod Schema 验证 write\_output 的输出数据，确保数据结构正确：

```typescript
import { z } from 'zod'

const OutputSchema = z.object({
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
})

app.post('/tools/write_output', (req, res) => {
  const { field, value } = req.body

  // 使用 Schema 验证单个字段
  const fieldSchema = OutputSchema.shape[field]
  if (fieldSchema) {
    const result = fieldSchema.safeParse(value)
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues
      })
    }
  }

  res.json({
    data: { field, value: fieldSchema ? fieldSchema.parse(value) : value },
    status: 'success'
  })
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
