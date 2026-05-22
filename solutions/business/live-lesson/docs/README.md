# Live Lesson 文档索引

> 本目录收录 live-lesson solution 的设计文档、架构说明、性能分析与待办 backlog。
>
> 顶层 solution 概览见 [`../CLAUDE.md`](../CLAUDE.md)；平台级文档见 [`../../../../docs/README.md`](../../../../docs/README.md)。

---

## 当前焦点：Exercise Type Plugin 体系

把 11 种练习类型从"手动注册"重构为"自注册插件"，以及配套的预览/调试平台。

| 文档 | 中文 | English | 简介 |
|------|------|---------|------|
| **Bundle Catalog** | [bundles/index.html](./bundles/index.html) | — | 浏览所有 lesson 和 plugin bundle 的可视化目录页（teacher-guide.html 风格） |
| Plugin 架构 | [exercise-plugin-architecture.zh-CN.md](./exercise-plugin-architecture.zh-CN.md) | [exercise-plugin-architecture.md](./exercise-plugin-architecture.md) | 全栈插件架构：单一插件接口 + 自动发现 + 11 种现有类型迁移路径 |
| Preview 系统 | [exercise-plugin-preview-design.zh-CN.md](./exercise-plugin-preview-design.zh-CN.md) | [exercise-plugin-preview-design.md](./exercise-plugin-preview-design.md) | 三壳一核预览平台：CLI 沙箱 + Admin Playground + 公网 Demo |
| Bundle README 模板 | [templates/bundle-readme-template.html](./templates/bundle-readme-template.html) | — | 单文件 HTML 模板，复制后替换占位符即可生成新 bundle 说明页 |

---

## 系统总览

| 文档 | 简介 |
|------|------|
| [live-lesson-system-design.md](./live-lesson-system-design.md) | Live Lesson 系统设计 — CCAAS 驱动架构（v1.0，2026-05-22 更新） |
| [course-project-architecture.md](./course-project-architecture.md) | 课程项目架构设计（lesson 与 course 模型） |
| [classroom-execution-design.md](./classroom-execution-design.md) | 课堂执行设计方法论 — AI 辅助 manifest 审查与设计 Skill |

---

## 功能与交互设计

| 文档 | 简介 |
|------|------|
| [guided-discovery-design-analysis.md](./guided-discovery-design-analysis.md) | 引导探究题型（Guided Discovery）设计稿分析，以"平方差公式"为例 |
| [observation-system-review.md](./observation-system-review.md) | Observation 系统 review：教师端可见的学生行为审计（2026-05-21） |
| [苏格拉底讨论交互范式重构.md](./苏格拉底讨论交互范式重构.md) | 苏格拉底讨论：从"学生输出"到"学生引导"的交互范式重构 |

### AI Tutor 子目录

| 文档 | 简介 |
|------|------|
| [ai-tutor/ai-tutor-categorization.md](./ai-tutor/ai-tutor-categorization.md) | AI Tutor — 动态分类系统设计 |
| [ai-tutor/ai-tutor-prompt-design.md](./ai-tutor/ai-tutor-prompt-design.md) | AI Tutor — System Prompt 工程 |
| [ai-tutor/ai-tutor-teacher-visibility.md](./ai-tutor/ai-tutor-teacher-visibility.md) | AI Tutor — 教师对学生提问的可见性设计 |

### design/ 子目录（早期需求与设计）

| 文档 | 简介 |
|------|------|
| [design/USER_STORIES.md](./design/USER_STORIES.md) | 用户故事 — 高一英语阅读策略课（"Ideal Beauty"） |
| [design/exercise-types.md](./design/exercise-types.md) | Exercise Types 参考手册 |
| [design/interactive-features-guide.md](./design/interactive-features-guide.md) | 交互功能使用说明 |

---

## 性能与运营

| 文档 | 简介 |
|------|------|
| [PERFORMANCE_ANALYSIS.md](./PERFORMANCE_ANALYSIS.md) | 后端性能分析：40 学生 + 1 教师，REST polling 3s |
| [操作指南.md](./操作指南.md) | 服务启动与日常操作 |
| [lesson-content-dump.md](./lesson-content-dump.md) | "Ideal Beauty" 课堂内容总览（阅读策略训练） |

---

## Backlog（已推迟的事项）

| 文档 | 简介 |
|------|------|
| [backlog/backlog-discuss-analytics.md](./backlog/backlog-discuss-analytics.md) | 讨论环节通过/失败的分析聚合 |
| [backlog/backlog-voice-input.md](./backlog/backlog-voice-input.md) | 语音输入 — Push-to-Talk + 豆包 ASR |

---

## 目录结构

```
docs/
├── README.md                                # 本文件（索引）
│
├── ── Exercise Plugin 体系（当前焦点）────────
├── exercise-plugin-architecture.zh-CN.md    # Plugin 架构（中文）
├── exercise-plugin-architecture.md          # Plugin Architecture (English)
├── exercise-plugin-preview-design.zh-CN.md  # Preview 系统设计（中文）
├── exercise-plugin-preview-design.md        # Preview System Design (English)
├── bundles/index.html                       # ★ Bundle Catalog 可视化目录
├── templates/bundle-readme-template.html    # Bundle README 单文件 HTML 模板
│
├── ── 系统总览 ──────────────────────────────
├── live-lesson-system-design.md
├── course-project-architecture.md
├── classroom-execution-design.md
│
├── ── 功能与交互设计 ─────────────────────────
├── guided-discovery-design-analysis.md
├── observation-system-review.md
├── 苏格拉底讨论交互范式重构.md
├── ai-tutor/                                # AI Tutor 设计
│   ├── ai-tutor-categorization.md
│   ├── ai-tutor-prompt-design.md
│   └── ai-tutor-teacher-visibility.md
├── design/                                  # 早期需求与设计
│   ├── USER_STORIES.md
│   ├── exercise-types.md
│   └── interactive-features-guide.md
│
├── ── 性能与运营 ────────────────────────────
├── PERFORMANCE_ANALYSIS.md
├── 操作指南.md
├── lesson-content-dump.md
│
└── backlog/                                 # 已推迟事项
    ├── backlog-discuss-analytics.md
    └── backlog-voice-input.md
```

---

## 阅读建议

- **找现成 bundle 用**：先看 [bundles/index.html](./bundles/index.html)，那里有所有 lesson 和 plugin 的卡片视图
- **新加入 live-lesson 开发**：先看 [live-lesson-system-design.md](./live-lesson-system-design.md) 和 [../CLAUDE.md](../CLAUDE.md)
- **要加新练习类型**：读 [exercise-plugin-architecture](./exercise-plugin-architecture.zh-CN.md) + [exercise-plugin-preview-design](./exercise-plugin-preview-design.zh-CN.md)
- **要写新 bundle 说明页**：复制 [templates/bundle-readme-template.html](./templates/bundle-readme-template.html)，搜索替换 `{{...}}` 占位符
- **要改 AI Tutor 行为**：读 [ai-tutor/](./ai-tutor/) 三篇
- **要改讨论环节**：读 [苏格拉底讨论交互范式重构](./苏格拉底讨论交互范式重构.md) + [observation-system-review](./observation-system-review.md)
- **性能问题排查**：读 [PERFORMANCE_ANALYSIS.md](./PERFORMANCE_ANALYSIS.md)
- **理解某节具体课**：以平方差公式为例，看 [guided-discovery-design-analysis.md](./guided-discovery-design-analysis.md) 和 [`../data/lessons/math-difference-of-squares/manifest.json`](../data/lessons/math-difference-of-squares/manifest.json)
