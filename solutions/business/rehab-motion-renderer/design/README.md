# Rehab Motion Renderer

康复动作渲染服务 — 从用户检查报告到交互式训练页面的全链路系统。

## 系统概述

一个两层 Agent Skill 驱动的康复训练可视化服务。用户描述自己的诊断结果（如 MRI 报告、医嘱），Agent 理解病情后生成个性化训练方案，最终渲染为带 SVG 骨架动画的交互式训练页面。

### 全链路流程

```
用户: "我的MRI显示L4-L5椎管狭窄，医生建议保守治疗"
                    ↓
        ┌──────────────────────────┐
        │  Skill A: Exercise       │  面向用户的 Agent Session
        │  Planner                 │  
        │  ─ 理解诊断报告          │  输入: 用户自然语言
        │  ─ 评估禁忌与适应症      │  输出: ExercisePlan JSON
        │  ─ 生成训练方案          │  (不含动画细节)
        └────────────┬─────────────┘
                     ↓  ExercisePlan
        ┌──────────────────────────┐
        │  MCP Tool:               │  同步调用，用户无感知
        │  create_training_page    │
        └────────────┬─────────────┘
                     ↓  ExercisePlan
        ┌──────────────────────────┐
        │  Skill B: Animation      │  独立 Session / 确定性查表
        │  Engineer                │  
        │  ─ 解剖学关节建模        │  输入: ExercisePlan
        │  ─ 关键帧生成           │  输出: RenderConfig JSON
        │  ─ 安全约束映射          │  (含完整动画数据)
        └────────────┬─────────────┘
                     ↓  RenderConfig
        ┌──────────────────────────┐
        │  Rendering Service       │  纯前端，无智能
        │  ─ SVG骨架动画渲染       │  输入: RenderConfig
        │  ─ 训练计时追踪          │  输出: Hosted URL
        │  ─ 交互控制             │
        └────────────┬─────────────┘
                     ↓
        用户收到链接，打开训练页面
```

### 为什么分两层 Skill？

这不是技术追求，而是**上下文隔离**的必然要求：

| 维度 | Skill A (Exercise Planner) | Skill B (Animation Engineer) |
|------|---------------------------|------------------------------|
| 上下文 | 用户隐私（诊断报告、BMI、病史） | 仅 exercise type + 参数 |
| 迭代周期 | 跟医学知识/用户需求走 | 跟动画引擎/解剖模型走 |
| 输出可缓存 | 否（个性化） | 是（同参数同结果） |
| 是否必须 LLM | 是（理解自然语言+医学推理） | 多数情况查表，少数新动作需 LLM |

类比教育场景：Skill A 是"面向学生的讲解"（个性化、需理解上下文），Skill B 是"后端课堂分析引擎"（标准化、可缓存、接口驱动）。

## 项目结构

```
rehab-motion-renderer/
├── README.md                          ← 本文件
├── docs/
│   ├── architecture.md                ← 系统架构详解
│   ├── plan-config-schema.md          ← Skill A → Skill B 接口契约
│   ├── render-config-schema.md        ← Skill B → Renderer 接口契约
│   └── example-flow.md               ← 端到端示例（含完整JSON）
├── skills/
│   ├── exercise-planner/
│   │   └── SKILL.md                   ← Skill A 定义（面向用户的Agent Skill）
│   └── animation-engineer/
│       └── SKILL.md                   ← Skill B 定义（面向内部服务的Agent Skill）
├── packages/
│   ├── mcp-server/                    ← MCP Server 实现
│   │   ├── package.json
│   │   └── src/
│   │       └── index.ts               ← MCP tool: create_training_page
│   └── renderer/                      ← 渲染服务前端
│       ├── package.json
│       └── src/
│           ├── types/
│           │   └── config.ts           ← TypeScript 类型定义
│           ├── engine/
│           │   └── animation.ts        ← 动画引擎（插值、正向运动学）
│           ├── components/
│           │   ├── figures/            ← SVG figure 渲染器
│           │   └── TrainingPage.tsx    ← 主渲染页面
│           └── app.tsx                 ← 入口
└── reference/
    ├── fitness-v3.jsx                 ← 当前可运行的参考实现（单文件）
    └── exercise-library.json          ← 已验证的动作库（含关键帧）
```

## 快速开始

### 1. 理解两层 Config Schema

先读 `docs/plan-config-schema.md` 和 `docs/render-config-schema.md`，这是整个系统的接口契约。

### 2. 查看参考实现

`reference/fitness-v3.jsx` 是一个完整可运行的 React 组件，包含 4 个动作的全部动画逻辑。可以直接在 Claude.ai Artifacts 或本地 React 项目中运行。

### 3. 开发顺序建议

```
Phase 1: 渲染服务（确定性部分）
  ├─ 从 fitness-v3.jsx 抽取动画引擎
  ├─ 实现 RenderConfig → 页面渲染
  ├─ 部署到 Cloudflare Workers / Vercel
  └─ 验证: 手写 RenderConfig JSON → 能看到训练页面

Phase 2: MCP Server
  ├─ 实现 create_training_page tool
  ├─ 接收 ExercisePlan → 调 Skill B → 生成 URL
  └─ 验证: Claude Code 中调用 MCP tool → 得到 URL

Phase 3: Skill A (Exercise Planner)
  ├─ 编写 SKILL.md prompt
  ├─ 接入 Jijian 平台 session template
  └─ 验证: 用户自然语言 → 自动生成训练页面

Phase 4: Skill B 智能扩展
  ├─ 查表无法覆盖时的 LLM fallback
  ├─ 新动作的关键帧生成
  └─ 解剖学约束验证
```

## 技术栈

- **语言**: TypeScript
- **渲染**: React + SVG (requestAnimationFrame)
- **部署**: Cloudflare Workers (推荐) / Vercel
- **MCP**: @modelcontextprotocol/sdk
- **Agent 平台**: Jijian 即见
