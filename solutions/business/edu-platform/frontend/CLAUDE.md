# Edu Platform Frontend

## Design System

**必读**: 修改任何样式前，先阅读 [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)

## Reference Prototypes

- `docs/reference/chat-interface.html` — Chat 入口原型
- `docs/reference/lesson-plan-wizard.html` — 备课向导原型
- `docs/reference/skill-management-panel.html` — Skill 管理面板原型

## Tech Stack

React 18 + Tailwind (布局) + CSS Variables (颜色/主题)

## Quick Rules

- 颜色: 只用 CSS 变量 `var(--bg1)` 等，不用 Tailwind 色板
- 边框: `0.5px solid var(--b1)`，不用 `border-gray-200`
- 圆角: 小组件 `var(--r)` = 8px，大容器 `var(--rl)` = 12px
- 用户气泡: `bg=var(--t1)` + 不对称圆角 `16px 16px 4px 16px`
- AI 气泡: 无背景无边框，纯文本
- 阴影: 禁止使用 `shadow-*`，reference 中无阴影
- 暗色模式: 通过 `@media (prefers-color-scheme: dark)` 自动切换
