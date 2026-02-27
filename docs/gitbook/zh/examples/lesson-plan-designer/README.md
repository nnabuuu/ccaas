# Lesson Plan Designer

AI 辅助教师跨 14 个字段设计结构化教案 — 从标题和学习目标，到教学方法和评估标准。Agent 逐字段写入值；教师审核并确认每项修改后，才应用到表单。

---

## 架构

```
┌─────────────────────────────────────────────────┐
│  教师（前端）                                     │
│                                                  │
│  在聊天中描述课程背景                              │
│  每个字段看到一张"同步到表单"卡片                  │
│  点击同步 → 值应用到表单                           │
│  或点击丢弃 → 建议被移除                          │
└───────────────────┬─────────────────────────────┘
                    │ SSE（output_update 事件）
                    ▼
┌─────────────────────────────────────────────────┐
│  CCAAS 后端 + Agent                              │
│                                                  │
│  Agent 逐字段调用 write_output                   │
│  EventMapper 检测 { data: {field, value} }       │
│  向前端发送 output_update                         │
└───────────────────┬─────────────────────────────┘
                    │ stdio MCP
                    ▼
┌─────────────────────────────────────────────────┐
│  lesson-plan-designer MCP Server                 │
│                                                  │
│  write_output → Zod 验证                         │
│  返回：{ data: { field, value, preview },        │
│          status: 'success' }                    │
└─────────────────────────────────────────────────┘
```

**核心设计原则**：AI 输出与表单状态解耦。Agent 写入缓冲区（`pendingUpdates`）；教师写入表单。这是两个独立的状态机，只有在教师点击"同步"时才会合并。

---

## 14 个同步字段

| # | 字段 | 类型 |
|---|------|------|
| 1 | `title` | string |
| 2 | `subject` | string |
| 3 | `gradeLevel` | number（1–12）|
| 4 | `durationMinutes` | number |
| 5 | `objectives` | string（Markdown）|
| 6 | `content` | string（Markdown）|
| 7 | `teachingMethods` | string |
| 8 | `materialsNeeded` | string |
| 9 | `assessmentMethods` | string |
| 10 | `homeworkAssignment` | string |
| 11 | `differentiatedInstruction` | string |
| 12 | `curriculumRequirements` | string[] |
| 13 | `extraProperties` | object |
| 14 | `teacherNotes` | string |

---

## 这个 Solution 有什么值得关注的

`write_output` 协议并不局限于教案 — 它是任何 AI 辅助表单的通用机制。Lesson Plan Designer 是参考实现，因为它处理了完整的边界情况：AI 以字符串形式返回数字字段、以 JSON 字符串形式返回数组字段、以及同步后的撤销支持。

完整分析见子页。

---

## 子页

[**表单协议与 SYNC\_FIELDS**](form-protocol.md) — 为什么不直接流式传输到表单，`write_output` 如何解耦 Agent 输出与表单状态，以及何时使用此模式。
