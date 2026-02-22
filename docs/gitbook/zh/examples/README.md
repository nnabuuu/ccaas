# Solution 案例库

基于 KedgeAgentic 构建的真实 Solution，每个 Solution 展示一种独特的架构模式。每条记录链接到 Solution 概览和一个或多个聚焦子页，解释设计决策背后的**原因** — 而不仅仅是实现方式。

---

## Solution 列表

| Solution | 业务场景 | 有价值的层 | 子页 |
|----------|---------|----------|-----|
| [Quiz Analyzer](quiz-analyzer/README.md) | AI 将题目标注为 3.1 万节点层级树中最精确的知识点 | MCP 层：层级数据检索与叶节点优先过滤 | [MCP 层设计：层级数据](quiz-analyzer/mcp-design.md) |
| [Lesson Plan Designer](lesson-plan-designer/README.md) | AI 辅助教师设计 14 字段教案，修改须经用户确认后才应用到表单 | Solution 协议：write_output 两步同步 | [表单协议与 SYNC\_FIELDS](lesson-plan-designer/form-protocol.md) |
| [Rehab Motion Renderer](rehab-motion-renderer/README.md) | 医学报告 → 个性化康复方案，渲染为带 SVG 骨架动画的交互训练页面 | Output 结构：AI 决定内容，前端决定呈现 | [双 Output 设计](rehab-motion-renderer/dual-output.md) |

---

## 如何阅读这些案例

每个 Solution 页面回答两个问题：

1. **它解决什么问题？** — 一句话业务场景 + 数据流图
2. **哪个设计值得借鉴？** — 一个聚焦子页，介绍最具迁移价值的架构决策

目标不是记录每个文件，而是提取可应用于你自己 Solution 的模式。
