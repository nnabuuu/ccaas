# Task Specification — Quiz Analyzer Frontend Style Consistency

## Objective
将 quiz-analyzer 前端的视觉样式从独立设计系统（Satoshi 字体、蓝色主色调、bento-card 风格）迁移至主站 chat-interface 的设计语言（系统字体、暖色中性调、CSS 变量 `ck-` 体系），实现跨产品视觉一致性。

**核心原则**：
- **纯样式迁移** — 不改功能逻辑、不改三栏布局结构
- **设计 token 对齐** — 所有颜色、圆角、阴影、字体走 CSS 变量，零硬编码
- **语义色彩保留** — 知识点 badge 的业务语义色（question=blue, solution=green, both=purple）不属于设计系统层，保留不变

## Artifact Description

### Target: `solutions/business/quiz-analyzer/frontend/`
- **角色**: 独立的 Solution 前端（题目分析工具）
- **Format**: React + Tailwind CSS + Vite
- **Dev server**: `npm run dev`（默认端口 5173）
- **Key files**:
  - `tailwind.config.js` — Tailwind 扩展配置（需引入 ck 色彩体系）
  - `src/index.css` — 全局样式（需引入 CSS 变量）
  - `src/App.tsx` — 主布局（header/footer/三栏结构）
  - `src/components/QuizInputForm.tsx` — 左栏：题目输入表单
  - `src/components/StandardizedQuizDisplay.tsx` — 中栏：标准化题目展示
  - `src/components/ChatWithQuickActions.tsx` — 右栏：AI 对话 + 快捷操作
  - `src/components/ViewModeToggle.tsx` — 视图模式切换器
  - `src/components/ConnectionStatus.tsx` — 连接状态指示器
  - `src/components/SkeletonLoader.tsx` — 加载骨架屏
  - `src/components/GeometryFigure.tsx` — 几何图形容器
  - `src/components/Layout.css` — 遗留 CSS 文件（可能需清理）

### Design Reference: `packages/chat-interface/`
- **设计 token 源**: `src/styles/tokens.css` — CSS 自定义属性（light + dark mode）
- **Tailwind 映射**: `tailwind.config.js` — `ck-` 前缀色彩命名空间
- **全局样式**: `src/styles/globals.css` — base/components 层
- **完整设计系统文档**: 见 `harness-workspace/quiz-analyzer-style/design-system.md`

## 当前风格差异（需修复）

| 维度 | quiz-analyzer (现状) | chat-interface (目标) |
|------|---------------------|----------------------|
| 色彩体系 | 硬编码 Tailwind 蓝 (`primary-700: #1e40af`) | CSS 变量 (`--t1`, `--accent: #AE5630`) |
| 背景色 | `slate-50` / `white` / `zinc-50` | `var(--bg1)` / `var(--bg2)` (暖灰) |
| 字体 | Satoshi (外部加载) | `system-ui, "Segoe UI", Roboto, ...` |
| 圆角 | `rounded-3xl` (bento) / `rounded-xl` | `rounded-ck` (8px) / `rounded-ck-lg` (12px) |
| 阴影 | `shadow-soft` / `shadow-glass` (较强) | `composer-shadow` (opacity 3.5-7.5%) |
| 边框 | `border-slate-200` / `border-zinc-200` 实色 | `var(--b1)` / `var(--b2)` 半透明 |
| 按钮 | `rounded-xl` + `shadow-sm` + 蓝/琥珀色 | `rounded-lg` + 无阴影 + 暖棕 accent |
| 过渡 | `cubic-bezier(0.16, 1, 0.3, 1)` 弹性 | `ease-claude: cubic-bezier(0.4, 0, 0.2, 1)` 稳重 |
| 暗色模式 | 无 | CSS 变量 + `.dark` class |
| 滚动条 | 默认 | `.ck-scrollbar` thin 样式 |

## 修改范围

### 在范围内（需修改）
1. `tailwind.config.js` — 引入 `ck` 色彩命名空间、替换字体栈、调整圆角/阴影
2. `src/index.css` — 引入 CSS 变量定义，重写 base/components 层
3. `src/App.tsx` — header/footer/layout 类名迁移到 ck 体系
4. `src/components/QuizInputForm.tsx` — 表单样式对齐
5. `src/components/StandardizedQuizDisplay.tsx` — 数据展示卡片样式
6. `src/components/ChatWithQuickActions.tsx` — 快捷操作按钮
7. `src/components/ViewModeToggle.tsx` — 切换组件
8. `src/components/ConnectionStatus.tsx` — 状态指示器
9. `src/components/SkeletonLoader.tsx` — loading 状态
10. `src/components/GeometryFigure.tsx` — 几何图形容器样式
11. `src/components/Layout.css` — 可能需清理或迁移至 index.css

### 保留不变
- **知识点 badge 语义色** — question=blue, solution=green, both=purple（业务语义，不属于设计系统）
- **三栏布局结构** — quiz-analyzer 特有的产品形态
- **功能逻辑** — hooks、API 调用、状态管理
- **组件接口** — props、类型定义

## Backend & Dev Server

quiz-analyzer 需要以下服务运行：
- **CCAAS Backend**: `localhost:3001`
- **Quiz MCP Server**: `localhost:3006`
- **Quiz Frontend Dev**: `npm run dev`（默认 5173）

认证：通过 CCAAS backend 的 `/api/v1/auth/login` 获取 apiKey

## Frozen Constraints
- 不改功能逻辑或业务代码
- 不改三栏布局结构
- 不改组件 props 接口
- 知识点 badge 语义色保留
- 每轮改动后 `npx tsc --noEmit` 必须通过
- 不引入新 npm 依赖
- 使用 CSS 变量 + Tailwind `ck-` 类，不使用 CSS modules 或 styled-components

## Size/Format Constraints
- 文件格式: `.tsx` (React), `.css` (styles), `.js` (config)
- 样式方案: Tailwind utility classes + CSS custom properties
- 所有颜色必须走 CSS 变量或 Tailwind `ck-` 前缀类
- 硬编码颜色值仅允许在知识点 badge 语义色中使用
