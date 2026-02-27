# 表单协议与 SYNC\_FIELDS

`write_output` / `output_update` 协议是 KedgeAgentic 实现带人工确认的 AI 辅助表单填写的机制。本页解释协议为何如此设计 — 两步分离背后的原因、字段选择标准，以及何时在你自己的 Solution 中应用此模式。

---

## 1. 为什么不直接流式传输到表单？

AI 辅助表单填写最简单的方案是：随着 Agent 输出的产生，直接将内容流式写入表单字段。这会带来三个问题：

**中间输出尚未就绪。** 当 Agent 生成"学习目标"时，它在生成最终列表之前会先经历推理过程。"- 学生将" 或 "1. 理解" 这类半成品如果立即写入表单，会产生误导。

**用户失去控制权。** 如果 AI 输出直接写入表单状态，教师无法清楚地看到哪些内容被修改，也很难撤销。表单变成了 Agent 的输出缓冲区，而不是教师的文档。

**部分失败会破坏状态。** 如果 Agent 在完成全部 14 个字段之前遭遇上下文限制，表单会停留在一个部分被 AI 修改的状态，没有明确记录哪些字段来自 AI。

`write_output` 协议通过将 AI 建议缓存到 `pendingUpdates`（一个独立状态）来解决这三个问题 — 只有用户明确点击"同步"后，才会合并到表单。

---

## 2. write\_output 的解耦逻辑

```
Agent 调用 write_output(field, value, preview)
        │
        ▼
MCP server 用 Zod 验证
返回：{ data: { field, value, preview }, status: 'success' }
        │
        ▼（stdio → CCAAS EventMapper）
output_update SSE 事件 → payload.data.{ field, value, preview }
        │
        ▼（react-sdk 中的 onOutputUpdate 回调）
pendingUpdates Map<SyncField, OutputUpdate>
        │
        ▼
同步卡片 UI："同步到表单" | "丢弃"
        │                │
        ▼                ▼
表单状态          从 pendingUpdates 中删除
```

Agent 和教师写入**两个独立的状态机**，只在一个明确的时间点合并。Agent 从不直接修改 `lessonPlan` 状态。教师无需担心对话中途出现意外的修改。

### 嵌套的 payload.data 结构

最常见的实现错误是访问 `event.payload.field` 而不是 `event.payload.data.field`。CCAAS EventMapper 将工具结果多包装了一层：

```
write_output 返回 → { data: { field, value, preview }, status }
EventMapper 发送 → payload.data = { field, value, preview }
前端读取 → event.payload.data.field  ← 正确
            event.payload.field        ← undefined（错误）
```

这是 lesson-plan-designer 中曾出现的一个真实生产 Bug。react-sdk 的 `parseOutputUpdate` 会自动处理所有格式变体 — 使用 `onOutputUpdate` 回调，而不是手动解析原始 SSE 事件。

---

## 3. SYNC\_FIELDS 的选择标准

并非每个表单字段都应该成为同步字段。Lesson Plan Designer 用三个标准选出了 14 个字段：

**1. AI 能对其产生有意义的改变。** 会话 ID、创建时间戳、数据库主键等字段不是同步字段 — AI 对它们没有业务逻辑。每个同步字段都是 AI 能从课程背景生成有用值的字段。

**2. 值的结构对前端有意义。** 纯文本字段（标题、备注）始终是同步字段。结构化字段（`curriculumRequirements` 为 `string[]`，`extraProperties` 为 `object`）也是同步字段，因为前端对它们的渲染方式不同 — 在归一化步骤中需要类型安全处理。

**3. 用户需要验证它。** 如果 AI 出错，影响有多大？对于学习目标、教学方法和评估标准，错误的值对教师工作有实质影响。这些字段值得用户关注。对于可以一秒钟改正的低风险元数据，可以跳过同步步骤直接写入。

### 值归一化是必须的

AI 可能以意外的类型返回值：年级字段返回字符串 `"3"`，数组字段返回 `"[\"数学\", \"科学\"]"` 这样的 JSON 字符串。同步 hook 必须在写入表单状态之前进行归一化：

```typescript
function normalizeFieldValue(field: SyncField, value: unknown): unknown {
  value = parseJsonIfString(value)  // "[\...]" → 实际数组

  if (field === 'gradeLevel' || field === 'durationMinutes') {
    return Number(value) || defaultFor(field)
  }

  if (field === 'curriculumRequirements') {
    return Array.isArray(value) ? value : []
  }

  return value == null ? null : String(value)
}
```

这个归一化属于**前端同步 hook**，而不是 MCP server。MCP server 验证值在结构上是否正确（Zod）。前端为自身的类型系统进行归一化。

---

## 4. 可迁移场景

在以下情况下使用 `write_output` / `output_update` / 同步卡片模式：

- **AI 输出需要人工验证** — 医学摘要、法律草案、财务预测、教育计划。任何 AI 生成错误值会带来实质影响的场景。
- **多个字段按顺序更新** — Agent 逐字段写入；用户可以立即同步，或最后统一检查（"全部同步"）。这比等待完整输出更自然。
- **表单包含混合类型** — 同一表单中有文本、数组、数字和对象。MCP server 用 Zod 强制类型；前端用字段级规则进行归一化。
- **同步后需要撤销** — 同步 hook 存储上一个值，并提供带超时的撤销操作（lesson-plan-designer 中为 30 秒）。因为同步是一个离散事件，有明确的"之前"状态，这很容易添加。

**以下情况不适合此模式：**
- 表单是只读输出（仅显示，用户不编辑）。
- AI 只生成单个字段（更简单的做法是直接 API 调用）。
- 实时流式传输是预期的用户体验（如聊天消息或实时转录）。
