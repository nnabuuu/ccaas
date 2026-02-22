# 双 Output 设计

Rehab Motion Renderer 将 AI 生成的内容与前端呈现数据分离。AI 产出一个类型化规格；前端查找并附加所有渲染细节。本页解释为什么 `exercises` 字段是 JSON 字符串、两层丰富如何工作，以及何时应用此模式。

---

## 1. 两类字段的划分

10 个同步字段可以清晰地分为两类：

**A 类：文本字段（9 个字段）**

```
title, subtitle, medicalSummary, contraindications,
principlesDo, principlesAvoid, frequency,
progressionPlan, medicalReminder
```

全部是 `z.string().min(1)`。AI 生成 Markdown 或纯文本；前端直接渲染。无需转换。

**B 类：结构化字段（1 个字段）**

```
exercises：ExerciseSpec[] 的 JSON 字符串
```

```typescript
interface ExerciseSpec {
  type: 'pelvic-tilt' | 'dead-bug' | 'cat-cow' | 'seated-boxing'
  sets: number       // 组数
  reps: number       // 次数
  restSec: number    // 休息秒数
  tempo: string      // 节奏描述
  howTo: string[]    // 步骤说明
  safety: string[]   // 安全注意事项
}
```

AI 决定*患者应该做什么*。前端决定*如何呈现动画*。

---

## 2. exercises 为什么是 JSON 字符串而不是嵌套对象

`write_output` MCP 工具接受单个 `value: string` 参数 — 所有字段在协议层面都是字符串。对于文本字段这很自然。对于 `exercises`，AI 必须将数组序列化为 JSON 字符串。

MCP server 的 Zod Schema 验证字符串格式正确：

```typescript
exercises: z.string().refine(
  (val) => {
    try {
      const parsed = JSON.parse(val)
      return Array.isArray(parsed) &&
             parsed.length > 0 &&
             parsed.every(item => ExerciseSpecSchema.safeParse(item).success)
    } catch { return false }
  },
  { message: 'exercises must be a JSON string of valid ExerciseSpec[]' }
)
```

**验证在服务端边界发生。** 如果 AI 生成格式错误的 JSON 或遗漏必填字段，MCP server 会在前端看到之前以结构化错误拒绝它。前端可以假设：任何通过 `output_update` 到达的 `exercises` 值都是有效的 `ExerciseSpec[]`。

**反序列化在前端边界发生。** 当用户点击 exercises 字段的"同步"时，`applyField('exercises')` 解析 JSON 字符串并立即进行丰富。

---

## 3. AI 规格 → 前端丰富的模式

AI 的 `exercises` 输出包含*语义意图*：做什么动作、几组、几次、什么节奏、指导说明和安全注意事项。它不包含视觉数据。

```json
// AI 产出的内容（ExerciseSpec）：
{
  "type": "pelvic-tilt",
  "sets": 3,
  "reps": 12,
  "restSec": 20,
  "tempo": "5秒保持",
  "howTo": ["仰卧，膝盖弯曲", "收紧腹部..."],
  "safety": ["如感到腰痛立即停止"]
}
```

用户同步 exercises 字段时，前端在 `exercise-library.json` 中查找每个动作：

```json
// exercise-library.json 补充的内容（呈现数据）：
{
  "pelvic-tilt": {
    "name": "Pelvic Tilt",
    "nameZh": "骨盆前倾",
    "figure": "lying",
    "muscles": "腹横肌 · 骨盆底肌 · 臀肌",
    "phases": ["仰卧放松", "收紧腹部", "骨盆后倾", "HOLD 保持", "缓慢放松"],
    "keyframes": [ ... ],     // SVG 动画数据
    "visualHints": [ ... ]    // 屏幕上的辅助提示
  }
}
```

合并后得到 SVG 动画引擎可以直接消费的 `RenderableExercise`。AI 从不需要知道关键帧、骨架图形类型或视觉提示。

### 这对迭代速度的意义

动画数据的变更独立于医学知识。如果设计团队改进了"骨盆前倾"的 SVG 骨架，他们只需更新 `exercise-library.json`。无需重新提示、无需 AI 输出变更、无需迁移。AI 的 `ExerciseSpec` 保持有效，因为 `type: "pelvic-tilt"` 是两个层之间稳定的接口。

---

## 4. get_exercise_library 工具

MCP server 暴露 `get_exercise_library`，让 AI 在写入 `exercises` 字段**之前**知道可用的动作类型。它只返回元数据 — 不含关键帧：

```typescript
// MCP server 有意剥离关键帧：
return Object.entries(library).map(([id, entry]) => ({
  id,
  name: e.name,
  nameZh: e.nameZh,
  muscles: e.muscles,
  figure: e.figure,    // 'lying' | 'cat' | 'seated' — 告诉 AI 体位
  phases: e.phases,    // 阶段名称，用于 howTo 说明
  // keyframes: 省略 — AI 不需要
  // visualHints: 省略 — AI 不需要
}))
```

AI 获得足够的上下文来选择合适的动作并编写好的 `howTo` 指导说明。它不会收到无法有意义使用的关键帧数据。

---

## 5. 可迁移场景

在以下情况下应用 AI 规格 → 前端丰富模式：

- **AI 决定内容；前端决定呈现。** AI 应拥有语义决策（做什么动作、选什么药物、展示什么产品），而不是渲染决策（动画、颜色、图像素材、布局）。
- **呈现数据独立变更。** 设计改进、素材更新或本地化变更不应要求重新运行 AI 或修改 AI 输出 Schema。
- **规格是稳定接口。** `"pelvic-tilt"` 这样的动作类型是稳定标识符。只要双方就标识符达成一致，两个层可以独立演进。
- **边界验证很重要。** 当结构化数据通过文本协议从 AI 传到前端时，服务端 Zod 验证提供了类型安全保证，能提前捕获不良 AI 输出。

**此模式在其他领域的应用示例：**

| 领域 | AI 产出 | 前端丰富 |
|------|---------|---------|
| 电商 | 产品 ID + 数量 | 图片、价格、库存状态（来自目录）|
| 音乐 | 和弦进行 + 节拍 | 音频样本、乐谱记号、MIDI |
| 建筑 | 房间尺寸 + 材料 | 3D 模型、纹理、渲染设置 |
| 教育 | 课堂活动类型 + 时长 | 交互式模板、媒体素材 |
