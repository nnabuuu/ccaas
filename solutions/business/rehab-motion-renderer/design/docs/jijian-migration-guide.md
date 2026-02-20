# 即见平台对齐指南（给 Claude Code 的指令）

## 你的任务

将 `rehab-motion-renderer` 从一个独立原型改造为即见Agentic 平台上的正式 Solution。

## 第一步：阅读即见文档

请先阅读即见Agentic 的 gitbook 文档。文档地址：

```
https://kedgetech.gitbook.io/ji-jian-agentic
```

**必读页面**（按此顺序）：

| 优先级 | 页面路径 | 你需要从中获取什么 |
|--------|---------|-------------------|
| P0 | `tutorial/01-architecture` | Solution 四大构建块、目录结构、数据流 |
| P0 | `reference/solution-json` | solution.json 的完整配置格式 |
| P0 | `guide/skill-writing` | SKILL.md 的编写规范（格式、triggers、allowedTools） |
| P0 | `guide/mcp-server` | MCP Server 的实现规范（尤其是 write_output） |
| P0 | `guide/write-output` | write_output 最佳实践（字段命名、操作类型、数据格式） |
| P1 | `guide/frontend` | 前端如何连接 CCAAS + 处理 output_update |
| P1 | `guide/chat-integration` | React SDK 聊天组件集成方式 |
| P1 | `guide/solution-layout-quickstart` | 布局系统（左右分栏等） |
| P1 | `platform/concepts` | 核心概念定义 |
| P2 | `platform/architecture` | 平台整体架构 |
| P2 | `tutorial/02-domain-model` | 领域模型设计方法论 |
| P2 | `tutorial/03-user-journeys` | 用户旅程映射 |
| P2 | `tutorial/05-form-protocol` | 表单协议详解 |
| P2 | `api/sse` | SSE Transport（推荐的通信方式） |

## 第二步：对照已有内容理解项目

读完即见文档后，对照本项目的以下文件理解当前状态：

| 文件 | 内容 | 状态 |
|------|------|------|
| `CLAUDE.md` | 项目完整上下文、来龙去脉、架构决策 | ✅ 已完成 |
| `docs/architecture.md` | 两层 Skill 架构、session 隔离、渲染引擎 | ✅ 草案，需按即见规范调整 |
| `docs/plan-config-schema.md` | Skill A 输出的 ExercisePlan schema | ✅ 草案，需映射为 write_output SyncFields |
| `docs/render-config-schema.md` | 渲染数据 schema（含关节坐标系详解） | ✅ 可直接用 |
| `docs/example-flow.md` | 端到端示例（含完整 JSON） | ✅ 草案，需按即见数据流更新 |
| `reference/fitness-v3.jsx` | **可运行的完整原型**（804行 React+SVG） | ✅ 核心参考实现 |
| `reference/exercise-library.json` | 4 个动作的验证数据 | ✅ 可直接用 |
| `skills/exercise-planner/SKILL.md` | Skill A 定义 | ⚠️ 需按即见规范重写 |
| `skills/animation-engineer/SKILL.md` | Skill B 定义 | ⚠️ 可能不需要作为独立 Skill |
| `packages/mcp-server/src/index.ts` | MCP Server | ⚠️ 需按即见规范重写（加 write_output） |
| `packages/renderer/` | 渲染前端骨架 | ⚠️ 需重构为即见 Solution 前端 |

## 第三步：执行改造

### 3.1 创建 solution.json

按 `reference/solution-json` 的格式创建。关键配置：

```
- name: "Rehab Motion Renderer" 或 "康复训练设计器"
- slug: "rehab-motion-renderer"
- mcpServers: 注册 mcp-server（stdio 类型）
- skills: 只注册 exercise-planner（不注册 animation-engineer）
- triggers: 关键词如 "康复", "训练", "检查报告", "MRI", "腰椎", "膝盖"
- allowedTools: ["write_output"] + 其他自定义工具
```

### 3.2 重构目录结构

从当前的 `packages/` 结构改为即见标准的 Solution 布局：

```
当前:                           目标:
packages/renderer/         →    frontend/
packages/mcp-server/       →    mcp-server/
skills/                    →    skills/（保留，内容重写）
docs/                      →    docs/（保留）
reference/                 →    reference/（保留）
```

### 3.3 重写 Skill A (exercise-planner/SKILL.md)

按即见 `guide/skill-writing` 规范重写。当前 SKILL.md 已包含完整的医学知识和禁忌矩阵，但格式可能需要调整。核心内容保留：

- 角色定义：康复训练规划师
- 禁忌矩阵（腰椎狭窄、间盘突出、膝关节术后等）
- 可用动作库（8 个已知动作 + custom 类型）
- 输出格式：通过 write_output 输出 SyncFields
- howTo 和 safety 的生成原则

**关键变更**：Skill A 的输出不再是返回 JSON 给用户，而是调用 write_output 工具将数据写入表单字段。

### 3.4 重写 MCP Server

按即见 `guide/mcp-server` + `guide/write-output` 规范重写。核心工具：

**write_output**（必须实现）:
- 这是即见平台的标准工具，AI 通过它将数据写入前端表单
- 参考即见文档了解 write_output 的标准签名和行为

**get_exercise_library**（自定义工具）:
- 让 AI 查询可用的动作列表
- 返回动作名称、适应症、难度等，不含 keyframes
- 帮助 AI 做动作选择决策

### 3.5 实现前端

按即见 `guide/frontend` + `guide/chat-integration` + `guide/solution-layout-quickstart` 实现。

**布局**：左右分栏
- 左：聊天面板（连 CCAAS WebSocket / SSE）
- 右上：训练方案表单（接收 output_update 事件）
- 右下：SVG 动画预览

**核心组件**：
- 聊天面板：使用即见 React SDK
- 表单：每个 SyncField 对应一个可编辑区域，支持"同步"按钮
- SVG 预览：从 `reference/fitness-v3.jsx` 提取动画引擎和 Figure 渲染器

**数据流**：
1. 用户在聊天中描述病情
2. AI 通过 write_output 输出数据
3. CCAAS 通过 output_update 事件推送到前端
4. 前端表单显示 AI 建议，用户可编辑
5. 用户点击"生成训练页面"
6. 前端从 exercise-library.json 查表补充 keyframes
7. 渲染 SVG 动画

## Skill B 的处理

**不要**把 Skill B (Animation Engineer) 注册为即见 Skill。理由：

1. 即见的 Skill 是面向用户聊天的，有 triggers/关键词匹配
2. Skill B 不面向用户，它是内部的动画数据翻译层
3. 对已知动作，直接查 `exercise-library.json`，不需要 LLM
4. 查表逻辑放在前端（打包 exercise-library.json）或 MCP Server 内部

但是 `skills/animation-engineer/SKILL.md` 仍然保留作为文档——它包含完整的关节角度参考和 keyframe 生成规则，未来做自定义动作 LLM 生成时会用到。

## 从 fitness-v3.jsx 提取的组件清单

以下组件需要从 `reference/fitness-v3.jsx` 提取到前端项目中：

| 源码位置 | 目标文件 | 内容 |
|---------|---------|------|
| 第 6-27 行 | `engine/animation.ts` | ease(), jointPos(), interpolate() |
| 第 32-65 行 | `components/figures/Primitives.tsx` | Bone, Head, Hand, Foot, Ground, Glow |
| 第 174-274 行 | `components/figures/LyingFigure.tsx` | 仰卧位渲染器 |
| 第 276-339 行 | `components/figures/CatFigure.tsx` | 猫式渲染器 |
| 第 342-413 行 | `components/figures/SeatedFigure.tsx` | 坐姿渲染器 |
| 第 70-167 行 | `data/exercise-library.json` | 已有，直接用 reference/ 中的 |
| 第 420+ 行 | `components/TrainingPagePreview.tsx` | 动画循环、Tab切换、进度条 |

## 注意事项

1. **不要跳过即见文档**。solution.json 格式、write_output 签名、前端 SDK 用法都必须从文档中获取，不能猜测。

2. **"提议-审核-应用"模式**是即见的核心。AI 永远不直接写数据库，而是通过 write_output → output_update → 用户审核 → 保存。

3. **fitness-v3.jsx 是已验证的参考实现**。动画效果、关节角度、z-ordering 都经过多轮迭代验证。提取时保持动画逻辑不变。

4. **TypeScript 全程**。类型定义在 `packages/renderer/src/types/config.ts`，迁移时保留并扩展。
