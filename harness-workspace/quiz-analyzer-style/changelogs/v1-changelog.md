# v1 Changelog

## 改动文件

- `tailwind.config.js` — 完整重写：添加 `ck` 色彩命名空间（bg1-bg3, t1-t3, b1-b2, accent, 语义色）、`rounded-ck`/`rounded-ck-lg` 圆角、`shadow-composer` 系列阴影、`ease-claude` 过渡函数、`ck-shimmer` 动画、`darkMode: ['class']`；替换 Satoshi 为系统字体栈；移除旧 `primary`/`secondary`/`cta` 色板；保留 `question`/`solution`/`both` 语义色
- `index.html` — 移除 Satoshi 字体外部加载链接
- `src/index.css` — 完整重写：添加 CSS 变量定义（light + dark mode 全套）；重写 `@layer base`（body 使用 CSS 变量/系统字体、a 用 accent 色、focus ring 用 ck-accent、`::selection` 用 accent）；重写 `@layer components`（`.ck-card` 替代 `.bento-card`、`.btn-primary`/`.btn-secondary` 迁移到 ck 体系、`.input` 用 ck 变量、`.spinner` 用 ck 变量、新增 `.ck-scrollbar`）；保留 badge 语义色；添加 `prefers-reduced-motion` 完整支持
- `src/App.tsx` — header/footer/body 所有 `bg-white`→`bg-ck-bg1`、`bg-zinc-50`→`bg-ck-bg2`、`border-zinc-200`→`border-ck-b2`、`text-zinc-*`→`text-ck-t*`、卡片容器 `rounded-lg shadow-sm`→`rounded-ck-lg shadow-composer`、overlay 面板 `shadow-xl`→`shadow-composer-hover`、resize handle `hover:bg-blue-400`→`hover:bg-ck-accent/30`；所有列添加 `ck-scrollbar`
- `src/components/QuizInputForm.tsx` — 所有 label/text 迁移到 `text-ck-t*`；输入框从 `border-slate-300 focus:ring-blue-500` 迁移到 `border-ck-b1 focus:shadow-composer-focus focus:border-ck-accent`；提交按钮从 `bg-blue-600`/`bg-green-600` 统一为 `bg-ck-accent`；错误文字用 `var(--danger-t)`；添加 `ease-claude` 过渡
- `src/components/StandardizedQuizDisplay.tsx` — 所有 `text-zinc-*`→`text-ck-t*`、`bg-zinc-50`→`bg-ck-bg2`、`border-zinc-200`→`border-ck-b1`；正确答案用 `bg-ck-success-bg`/`text-ck-success-t`；题型 badge 用 `bg-ck-info-bg`/`text-ck-info-t`；难度指示器激活色用 `bg-ck-accent`；展开/收起链接用 `text-ck-accent`；保留知识点 badge 语义色（`bg-both-light`/`text-both-dark`）
- `src/components/ChatWithQuickActions.tsx` — 主按钮从 `bg-zinc-900`/`bg-green-600` 统一为 `bg-ck-accent hover:bg-ck-accent-hover shadow-composer`；快捷按钮从 `bg-purple-50`/`bg-blue-50`/`bg-green-50`/`bg-orange-50` 统一为 `bg-ck-bg1 border-ck-b1 hover:bg-ck-bg3`；状态指示器点从 `bg-blue-500`/`bg-green-500` 统一为 `bg-ck-accent`；所有过渡添加 `ease-claude`
- `src/components/ViewModeToggle.tsx` — 背景从 `bg-slate-100` 迁移到 `bg-ck-bg2`；激活态从 `bg-white shadow-sm` + 各色 `text-*-700` 统一为 `bg-ck-bg1 text-ck-t1 shadow-composer`；非激活态 `text-slate-600`→`text-ck-t2`
- `src/components/ConnectionStatus.tsx` — 连接状态用 `text-ck-success-t`/`text-ck-danger-t`；错误面板用 `bg-ck-danger-bg`；重连按钮用 `text-ck-accent`
- `src/components/SkeletonLoader.tsx` — `bg-zinc-200`→`bg-ck-bg2`、`rounded`→`rounded-ck`、`border-zinc-200`→`border-ck-b2`、`rounded-xl`→`rounded-ck-lg`；移除 dark 前缀（由 CSS 变量自动处理）
- `src/components/GeometryFigure.tsx` — canvas 背景 `#fafaf8`→`var(--bg2)`、边框 `#e0dbd4`→`var(--b1)`、圆角 `3px`→`var(--r)`；slider accent `#2c5f8a`→`var(--accent)`；播放按钮 `#2c5f8a`→`var(--accent)`/`var(--bg1)`；snap 按钮 `#ccc`→`var(--b1)`、`#27ae60`→`var(--success-t)`/`var(--success-bg)`；文字色 `#1a1a2e`→`var(--t1)`；字体栈对齐系统字体

## 对应维度

- D1 (Token Alignment): 完整引入 CSS 变量定义（light + dark mode）、Tailwind `ck` 命名空间、`rounded-ck`/`rounded-ck-lg` 圆角、`shadow-composer` 系列阴影、`ease-claude` 过渡函数。移除 Satoshi 字体，替换为系统字体栈。所有组件中的硬编码 Tailwind 颜色类（`bg-white`/`bg-zinc-*`/`text-zinc-*`/`border-zinc-*`/`bg-blue-*`/`bg-green-*` 等）已替换为 `ck-` 前缀类或 CSS 变量引用。
- D2 (Visual Consistency): 色温从冷蓝灰（slate/zinc）统一迁移至暖灰（`--bg2: #F5F5F0`）；强调色从蓝色系（`#2563eb`）统一为暖棕赤陶（`--accent: #AE5630`）；阴影从 `shadow-sm`/`shadow-glass` 统一为 `composer-shadow` 低对比度体系。
- D3 (Component Polish): 按钮全部迁移到 ck 规范（`rounded-lg` + 无额外阴影 + accent 色）；输入框统一使用 `rounded-ck` + `border-ck-b1` + `focus:shadow-composer-focus`；卡片容器统一为 `rounded-ck-lg shadow-composer border-ck-b2`。
- D4 (Responsive & Interaction): 添加 `ease-claude` 过渡函数替代旧弹性曲线；添加 `.ck-scrollbar` 薄滚动条；保留 `prefers-reduced-motion` 支持并增强（包含 `*::before, *::after` 和 `scroll-behavior`）；添加 `darkMode: ['class']` 支持和完整 dark mode CSS 变量。
- D5 (Code Quality): 移除 Satoshi 外部字体依赖；CSS 变量集中定义在 `index.css`；Tailwind 配置清理（移除旧 primary/secondary/cta 色板）；保留知识点 badge 语义色作为唯一硬编码例外。

## 本轮重点

第一轮基础设施层全面迁移：建立 CSS 变量 + Tailwind `ck-` 体系，并将全部 11 个文件从旧设计系统迁移到 chat-interface 设计语言。
