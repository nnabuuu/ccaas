# Edu Platform Frontend

## Design System

**必读**: 修改任何样式前，先阅读 [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)

## Reference Prototypes

- v2 设计包：`../harness-workspace/main-page-and-lesson-plan/reference/v2/`
- v2 设计规范：`reference/v2/文档/设计规范.md`
- v2 HTML 原型：`reference/v2/原型/`

## Tech Stack

React 18 + Tailwind (布局) + CSS Variables (颜色/主题)

## Quick Rules

- 颜色: 只用 CSS 变量 `var(--surface)` 等，不用 Tailwind 色板，不用字面量
- 边框: `1px solid var(--border)`，不用 `border-gray-200`
- 圆角: 按钮 6px，卡片 10px，弹窗 12px
- 主按钮: `bg=var(--t1)` + `color=var(--surface)`
- 卡片: `bg=var(--surface)` + `border: 1px solid var(--border)` + `border-radius: 10px`
- 阴影: 禁止使用 `shadow-*` 和 `box-shadow`
- Hover: 用 `border-color` 变化或 `background: var(--surface2)`，不用 shadow
- 暗色模式: 通过 `@media (prefers-color-scheme: dark)` 自动切换
- 字体: `"Plus Jakarta Sans"` 品牌字体
- 布局: 内容左对齐，不用 `margin: 0 auto` 居中

## Dark Mode & Token 规则

详见 [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) 第 1、4、6 节。核心原则：

- **组件中禁止色值字面量**（`'white'`、`'#fff'`、`'#xxx'`、`rgba()`）→ 全走 `var(--token)`
- 新增颜色必须同时写 light + dark token + 更新 DESIGN_SYSTEM.md token 表
- Token 定义在 `src/styles/design-tokens.css`，单一文件管理所有主题色
- v2 变量名：`--bg` / `--surface` / `--border` / `--blue` / `--amber`（不是 v1 的 `--bg1` / `--b1` / `--info-t` / `--warn-t`）

## v1 → v2 变量名迁移

| v1 | v2 |
|----|----|
| `--bg1` | `--surface` 或 `--bg` |
| `--bg2` | `--surface2` 或 `--bg` |
| `--b1` | `--border` |
| `--info-t` / `--info-bg` | `--blue` / `--blue-bg` |
| `--success-t` / `--success-bg` | `--green` / `--green-bg` |
| `--warn-t` / `--warn-bg` | `--amber` / `--amber-bg` |
| `--danger-t` / `--danger-bg` | `--red` / `--red-bg` |
| `--r` (8px) | 6px (按钮) / 10px (卡片) |
| `--rl` (12px) | 10px (卡片) / 12px (弹窗) |
