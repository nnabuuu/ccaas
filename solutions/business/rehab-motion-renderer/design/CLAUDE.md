# CLAUDE.md — Rehab Motion Renderer

## 项目一句话

从用户的医学检查报告（如 MRI）出发，经 AI Agent 分析病情 → 生成个性化康复训练方案 → 渲染为带 SVG 骨架动画的交互式训练页面。

---

## 来龙去脉（完整故事）

### 起源：一个真实的康复需求

这个项目起源于一个真实场景：用户拿到 MRI 报告，显示 L4-L5 腰椎管狭窄，医生建议保守治疗+核心训练。用户没有健身基础，BMI 偏高，需要一套在家可做的康复训练方案。

### V1-V3：在 Claude.ai 中的原型迭代

我们在 Claude.ai 的对话中完成了整个原型开发：

1. **分析病情**：理解腰椎管狭窄的运动禁忌（不能过伸、不能轴向负重），确定适合的训练方向（屈曲位训练、核心抗伸展、低冲击有氧）

2. **设计训练方案**：选了 4 个动作——骨盆前倾（基础）、死虫式（核心）、猫牛式（脊柱灵活度）、坐姿拳击（有氧替代）

3. **V1 实现**：用 React JSX Artifact 做了第一版，手动 lerp 动画，效果粗糙

4. **V2 改进**：加了更多视觉反馈，但代码耦合严重，加新动作要改动画逻辑

5. **V3 重写（当前版本，见 `reference/fitness-v3.jsx`）**：
   - 引入**声明式关键帧**系统：每个动作只定义 keyframes 数组（关节角度在各阶段的值）
   - **动画引擎**：`interpolate(keyframes, progress)` + sine easing，自动在关键帧间插值
   - **正向运动学**：`jointPos(x, y, angleDeg, length)` 从关节角度计算骨骼端点
   - **扩展性**：加新动作 = 只写 keyframes 数据，零代码变更
   - 修复了 **z-ordering 问题**：远侧肢体用暗色先渲染，近侧肢体用亮色后渲染
   - 加了**动作要领面板**（howTo）、健康状况描述（可折叠）、安全提醒标签

6. **架构讨论**：从单文件 Artifact 演进到两层 Agent Skill 架构，决定将其构建为即见Agentic 平台上的 Solution

### 为什么是两层 Skill？

核心洞察：**面向用户的医学知识** 和 **面向渲染的动画数据** 是完全不同的领域。

| | Skill A: Exercise Planner | Skill B: Animation Engineer |
|---|---|---|
| 上下文 | 用户隐私（MRI报告、BMI、病史） | 仅 exercise type + 参数 |
| 迭代周期 | 跟医学知识走 | 跟动画引擎走 |
| 输出可缓存 | 否（个性化） | 是（同参数同结果） |
| 是否需要 LLM | 是（理解自然语言+医学推理） | 多数查表，少数新动作需 LLM |

类比教育场景（即见平台的备课设计器）：Skill A 是"面向学生的讲解"，Skill B 是"后端课堂分析引擎"。

### 现在要做什么

**将这个原型构建为即见Agentic 平台上的正式 Solution。**

---

## 即见Agentic 平台对齐指南

### ⚠️ 重要：先读即见文档

在开始任何实现之前，**必须先阅读即见Agentic 的 gitbook 文档**：

```
https://kedgetech.gitbook.io/ji-jian-agentic
```

重点阅读这些页面（按顺序）：
1. `platform/concepts` — 核心概念（Solution, Skill, MCP, CCAAS）
2. `platform/architecture` — 平台架构
3. `tutorial/01-architecture` — Solution 架构教程（最重要，讲清了四大构建块）
4. `reference/solution-json` — solution.json 配置参考
5. `guide/skill-writing` — Skill 编写规范
6. `guide/mcp-server` — MCP Server 开发规范
7. `guide/write-output` — write_output 最佳实践
8. `guide/frontend` — 前端集成指南
9. `guide/chat-integration` — React SDK 聊天集成
10. `guide/solution-layout-quickstart` — 布局系统

### Solution 四大构建块映射

根据即见平台的架构，每个 Solution 由四部分组成。以下是我们的映射：

#### 1. 领域模型

```
TrainingPlan（训练方案）
├── title: string              — "脊柱友好训练"
├── subtitle: string           — "核心稳定 · 椎管减压"
├── locale: "zh-CN" | "en"
├── principles                 — 训练原则（推荐/禁忌/频率）
├── exercises: ExerciseItem[]  — 动作列表
│   ├── type: string           — "dead-bug" | "custom"
│   ├── sets/reps/restSec/tempo
│   ├── howTo: string[]        — 分步指导
│   ├── safety: string[]       — 安全提醒
│   └── (渲染数据由查表补充)
└── medicalContext             — 来源诊断信息（仅 Skill A 可见）

UserProfile（用户健康档案）
├── diagnosis: string          — "L4-L5 椎管狭窄"
├── symptoms: string[]         — ["间歇性跛行", "左腿发麻"]
├── bmi: number
├── fitnessLevel: "none" | "beginner" | "intermediate"
└── contraindications: string[] — AI 推理出的禁忌事项
```

#### 2. 用户旅程

```
旅程 1: "从检查报告生成康复训练"（核心旅程）
1. 用户在聊天中描述自己的检查结果（MRI报告、症状、体重等）
2. AI (Skill A) 分析病情，评估禁忌症
3. AI 通过 write_output 输出训练方案到表单
4. 用户在表单中审核、编辑训练方案
5. 用户点击"生成训练页面"
6. 系统渲染交互式 SVG 动画训练页面
7. 用户保存/分享训练页面链接

旅程 2: "调整已有训练方案"
1. 用户加载已保存的训练方案
2. 用户在聊天中说"我觉得死虫式太难了，有没有更简单的替代？"
3. AI 理解上下文，建议替代动作
4. AI 通过 write_output 更新方案
5. 用户审核并保存

旅程 3: "描述自定义动作"
1. 用户说"我的物理治疗师教了我一个改良版鸟狗式..."
2. AI (Skill A) 理解描述，生成 ExerciseSpec
3. 查表服务为自定义动作生成 keyframes（未来 LLM fallback）
4. 动画渲染在训练页面中
```

#### 3. 数据流

```
                  +-------------------+
                  |       前端        |
                  | (React + SVG渲染) |
                  +-------------------+
                   /                \
     WebSocket (AI 聊天)      REST API (训练方案)
                 /                    \
    +------------+              +------------------+
    |   CCAAS    |              |  Solution 后端   |
    | (即见平台)  |              | (可选，或纯前端) |
    +------------+              +------------------+
         |
    AI Agent + Skill A
         |
    write_output (多次调用)
    ├── { field: "title", value: "脊柱友好训练" }
    ├── { field: "principles", value: { do: [...], avoid: [...] } }
    ├── { field: "exercises", value: [...完整动作列表...] }
    └── { field: "medicalSummary", value: "诊断：L4-L5..." }
         |
    output_update 事件 → 前端表单
         |
    用户审核 → 保存 → 生成训练页面
```

**关键**：AI Agent 不直接写数据库。它通过 write_output 提议数据，用户审核后才保存。这是即见平台的"提议-审核-应用"模式。

#### 4. 表单协议 (write_output SyncFields)

```typescript
// AI 通过 write_output 输出的字段:
type SyncFields = {
  // 方案元数据
  title: string;              // "脊柱友好训练"
  subtitle: string;           // "核心稳定 · 椎管减压"

  // 医学分析
  medicalSummary: string;     // AI 对用户病情的诊断摘要
  contraindications: string;  // 禁忌事项

  // 训练原则
  principlesDo: string;       // 推荐原则（文本）
  principlesAvoid: string;    // 禁忌事项（文本）
  frequency: string;          // 建议频率

  // 动作列表（核心输出，JSON 字符串）
  exercises: string;          // JSON.stringify(ExerciseSpec[])

  // 附加建议
  progressionPlan: string;    // 进阶建议
  medicalReminder: string;    // 医疗提醒
};
```

### 关键架构决策

#### 决策 1: Skill B 是否需要作为独立 Skill？

在即见平台中，Skill 是面向用户聊天的概念（有 triggers、关键词匹配）。Skill B (Animation Engineer) 不面向用户，它的职责是将 exercise type 翻译为 keyframes。

**结论**：Skill B 不作为即见 Skill，而是作为 MCP Server 内部的查表逻辑（或前端内置的 exercise-library.json）。solution.json 中只注册一个 Skill（Exercise Planner）。

#### 决策 2: 渲染在前端

- exercise-library.json 打包在前端
- 用户点击"生成训练页面"后，前端根据 exercises 数据查表补充 keyframes，直接渲染 SVG 动画
- 不需要后端渲染服务
- 未来可以导出为独立 HTML 或生成 hash URL 分享

#### 决策 3: 前端布局

推荐左右分栏（参考即见布局系统）：
- **左侧**：聊天面板（连 CCAAS WebSocket）
- **右侧上**：训练方案表单（接收 output_update，支持编辑）
- **右侧下**：SVG 动画预览（实时预览选中的动作）

### Solution 目标目录结构

```
rehab-motion-renderer/
├── solution.json              ← 即见平台 Solution 配置
├── setup.sh                   ← 一键启动脚本
├── inject-skills.sh           ← Skill 注册脚本
├── CLAUDE.md                  ← 本文件
│
├── frontend/                  ← React 应用
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── components/
│       │   ├── ChatPanel.tsx          ← 聊天面板（连 CCAAS）
│       │   ├── TrainingPlanForm.tsx   ← 训练方案表单（接收 output_update）
│       │   ├── TrainingPagePreview.tsx ← SVG 动画预览
│       │   └── figures/               ← SVG Figure 渲染器
│       │       ├── LyingFigure.tsx
│       │       ├── CatFigure.tsx
│       │       └── SeatedFigure.tsx
│       ├── engine/
│       │   └── animation.ts           ← 动画引擎（插值+正向运动学）
│       ├── hooks/
│       │   ├── useTrainingSession.ts   ← 会话管理 hook
│       │   └── useOutputSync.ts        ← output_update 处理 hook
│       ├── types/
│       │   └── config.ts              ← TypeScript 类型定义
│       └── data/
│           └── exercise-library.json   ← 已验证的动作库
│
├── backend/                   ← Solution 后端（可选，Phase 2）
│   ├── package.json
│   └── src/
│       └── training-plans/    ← 训练方案 CRUD
│
├── mcp-server/                ← MCP 工具服务
│   ├── package.json
│   └── src/
│       └── index.ts           ← write_output + 自定义工具
│
├── skills/                    ← AI Skill 定义
│   └── exercise-planner/
│       └── SKILL.md           ← 面向用户的康复规划 Skill
│
├── docs/                      ← 设计文档
│   ├── architecture.md        ← 系统架构详解
│   ├── plan-config-schema.md  ← ExercisePlan schema
│   ├── render-config-schema.md ← RenderConfig schema（含关节坐标系）
│   └── example-flow.md        ← 端到端示例（含完整 JSON）
│
└── reference/                 ← 参考实现
    ├── fitness-v3.jsx         ← 完整可运行的单文件原型（804行）
    └── exercise-library.json  ← 已验证的 4 个动作 keyframe 数据
```

---

## 现有参考实现详解

### reference/fitness-v3.jsx（804 行）

这是在 Claude.ai Artifacts 中完整可运行的单文件 React 组件。包含：

**动画引擎**（第 1-27 行）:
- `ease(t)`: sine easing，`(1 - cos(π·t)) / 2`
- `jointPos(x, y, angleDeg, length)`: 正向运动学
- `interpolate(keyframes, progress)`: 关键帧插值

**SVG 基础组件**（第 29-66 行）:
- `Bone`: 骨骼线段 + 关节圆点
- `Head`: 头部（圆 + 眼睛 + 嘴巴）
- `Hand`, `Foot`, `Ground`, `Glow`

**动作数据**（第 70-167 行）:
4 个动作的完整定义，每个包含:
- 中英文名、组数/次数/休息时间/节奏
- 目标肌群、howTo 步骤、safety 提醒
- phases 阶段名 + phaseDurations 阶段时长
- figure type（lying/cat/seated）
- keyframes 数组（关节角度）

**Figure 渲染器**（第 170-420 行）:
- `LyingFigure`: 仰卧位 — 正向运动学计算所有肢体端点
- `CatFigure`: 四点跪姿 — Bézier 曲线脊柱
- `SeatedFigure`: 坐姿 — 椅子 + 出拳效果

**Z-ordering 规则**（每个 Figure 都遵循）:
1. 地面/背景
2. 远侧肢体（dimmed: #6a98b0, #5a8898）
3. 躯干
4. 头部
5. 近侧肢体（bright: #8cb8d0）
6. 效果/标签

**主组件**（第 420-804 行）:
Tab 切换、动画循环、阶段进度条、howTo 面板、健康状况描述

### reference/exercise-library.json

4 个已验证动作的完整 keyframe 数据（含 visualHints），可直接用作查表数据库。

### 关节角度坐标系

**仰卧位 (lying)**:
- 人物头朝左脚朝右（侧视图）
- 0° = 正右（沿地面），-90° = 正上，+90° = 正下
- `rHip: -75` = 屈膝仰卧自然位
- `rKnee: 75` = 屈膝约 90°
- `rSh: 100` = 手放身侧，`rSh: -85` = 手指天花板
- `tilt: 0~1` = 骨盆后倾程度

**猫式 (cat)**: `spine: -1~+0.3`, `headDrop: -10~+20`

**坐姿 (seated)**: `lArmX/rArmX: 0~150`, `lArmY/rArmY: 0~-65`

**keyframes 规则**: `keyframes.length = phases.length + 1`（N+1 边界点）

---

## 开发任务清单

### Phase 1: 对齐即见平台规范

读完即见 gitbook 文档后：

- [ ] 创建 `solution.json`，按即见规范配置
- [ ] 重构目录结构为标准 Solution 布局
- [ ] Skill A (exercise-planner/SKILL.md) 按即见规范重写
- [ ] MCP Server 按即见规范实现 write_output
- [ ] 创建 `setup.sh` 和 `inject-skills.sh`

### Phase 2: 前端实现

- [ ] React 应用骨架（Vite + TypeScript）
- [ ] 集成聊天面板（连 CCAAS，按即见 React SDK）
- [ ] 实现 output_update 处理（AI 输出 → 表单同步）
- [ ] 训练方案表单（可编辑的 SyncFields）
- [ ] 从 fitness-v3.jsx 提取 SVG 动画组件
- [ ] 从 fitness-v3.jsx 提取动画引擎
- [ ] 训练页面预览（实时渲染 SVG 动画）
- [ ] 布局：左聊天 + 右表单/预览

### Phase 3: MCP Server

- [ ] write_output tool（核心，按即见规范）
- [ ] get_exercise_library tool（让 AI 知道可用动作）
- [ ] resolve_keyframes tool（可选，查表获取渲染数据）

### Phase 4: 端到端测试

- [ ] 用户描述病情 → AI 输出方案 → 表单显示 → 编辑 → 渲染动画
- [ ] 测试 4 个动作的 SVG 动画效果

### Phase 5: 扩展

- [ ] 后端持久化
- [ ] 训练页面分享链接
- [ ] 更多动作库
- [ ] 自定义动作 LLM keyframe 生成

---

## 技术栈

- **语言**: TypeScript
- **前端**: React 19 + Vite + SVG (requestAnimationFrame)
- **动画**: sine easing interpolation + forward kinematics
- **MCP**: @modelcontextprotocol/sdk
- **即见平台**: CCAAS WebSocket + output_update 协议
- **后端**（可选）: NestJS
