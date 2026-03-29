# Task Specification

## Objective
将 chat-interface 的视觉质量提升至与 Claude Web 参考几乎无法区分的水准，跨组件风格统一、移动端完全可用、交互有质感。

## Artifact Description
- **Package**: `packages/chat-interface/`
- **Scope**: 所有组件的视觉层 — CSS/样式 + 组件内部渲染逻辑
- **Format**: React + Tailwind CSS + CSS custom properties
- **Key files**:
  - `src/styles/globals.css` — CSS 变量定义（light/dark）
  - `src/styles/prose.css` — Markdown 排版覆盖
  - `src/components/` — 所有 UI 组件
  - `src/widgets/components/` — 11 个 widget 组件

## Audience
- **最终用户**: 使用 chat UI 交互的人。关心视觉质感、交互流畅度、移动端可用性
- **集成开发者**: 使用 compound components 的人。关心 API 稳定性、CSS 变量可定制性

## Frozen Constraints
- ChatInterfaceContext / ChatCoreContext 的 provider 架构不应大改
- Widget 系统（catalog、registry、11 个 widget 的核心 props 接口）尽量保持稳定
- 组件对外 API 接口（props）可以灵活调整，但改动需在改动说明中标记
- 每轮改动后 `npm run typecheck` 和 `npm test` 必须通过
- 不引入不必要的新依赖（现有 Tailwind + lucide-react + sonner + react-markdown 足够）

## Available Inputs
- **参考截图**: `packages/chat-interface/reference/` — Claude Web 桌面端截图
- **设计系统文档**: `packages/chat-interface/docs/design-system.md` — 完整的 CSS 变量、排版、间距、动效规范
- **架构文档**: `packages/chat-interface/ARCHITECTURE.md` — 组件层次和 context 架构
- **Feature backlog**: `packages/chat-interface/docs/feature-backlog.md` — 与 Claude Web 的差距清单
- **CSS 变量**: `packages/chat-interface/src/styles/globals.css` — 已定义的 design tokens

## Size/Format Constraints
- 文件格式: `.tsx` (React components), `.css` (styles)
- 样式方案: Tailwind utility classes + CSS custom properties (var(--xxx))
- 不使用 CSS modules 或 styled-components
- 所有颜色必须走 CSS 变量，不得硬编码
