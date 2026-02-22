# Rehab Motion Renderer

从医学检查报告出发，AI 生成个性化康复训练方案，渲染为带 SVG 骨架动画的交互式训练页面。

---

## 架构

```
┌─────────────────────────────────────────────────┐
│  患者 / 临床医生（前端）                           │
│                                                  │
│  描述症状或上传报告                                │
│  看到每个字段的"同步"卡片                          │
│  点击同步 → TrainingPagePreview 渲染              │
│             SVG 骨架动画                          │
└───────────────────┬─────────────────────────────┘
                    │ output_update 事件
                    ▼
┌─────────────────────────────────────────────────┐
│  CCAAS + exercise-planner Skill                  │
│                                                  │
│  Agent 先调用 get_exercise_library               │
│  Agent 调用 write_output × 10 个字段             │
└───────────────────┬─────────────────────────────┘
                    │ stdio MCP
                    ▼
┌─────────────────────────────────────────────────┐
│  rehab-tools MCP Server                          │
│                                                  │
│  get_exercise_library → 仅返回元数据              │
│    （不含 keyframes — 那是前端的事）              │
│  write_output → Zod 验证每个字段                 │
│    exercises 字段：ExerciseSpec[] 的 JSON 字符串  │
└──────────────────────────────────────────────────┘

用户同步 exercises 字段时：
┌──────────────────────────────────────────────────┐
│  前端：applyField('exercises')                   │
│                                                  │
│  1. 从 JSON 字符串解析 ExerciseSpec[]             │
│  2. 对每个 spec：查找 exercise-library.json      │
│     → 补充 keyframes、visualHints、phaseNames   │
│  3. TrainingPagePreview 渲染 SVG 动画             │
└──────────────────────────────────────────────────┘
```

**核心设计原则**：AI 决定*做什么*（动作类型、组数、次数、指导说明）。前端决定*怎么展示*（关键帧动画、SVG 骨架图形、阶段标签）。两者明确分离，动画更新无需重新提示 AI。

---

## 10 个同步字段

| 字段 | 类型 | 内容 |
|------|------|------|
| `title` | string | 训练计划标题 |
| `subtitle` | string | 副标题 |
| `medicalSummary` | string | 医学背景摘要 |
| `contraindications` | string | 禁忌事项 |
| `principlesDo` | string | 推荐原则 |
| `principlesAvoid` | string | 禁忌原则 |
| `frequency` | string | 训练频率 |
| `exercises` | **JSON 字符串** | `ExerciseSpec[]` — 结构化字段 |
| `progressionPlan` | string | 进阶计划路线图 |
| `medicalReminder` | string | 医疗免责声明 |

9 个字段是纯字符串，1 个字段（`exercises`）是编码了类型化数组的 JSON 字符串。这种分法是本 Solution 的核心架构决策。

---

## 这个 Solution 有什么值得关注的

`exercises` 字段展示了一个超越表单填写的模式：**AI 产出内容规格，前端用呈现数据对其进行丰富**。AI 不需要知道 SVG 关键帧、动画阶段或视觉提示 — 也不应该知道。这些知识存储在 `exercise-library.json` 中，独立于 AI 的决策而演进。

完整分析见子页。

---

## 子页

[**双 Output 设计**](dual-output.md) — 为什么 exercises 是 JSON 字符串，AI 规格 → 前端丰富的模式，以及可迁移场景。
