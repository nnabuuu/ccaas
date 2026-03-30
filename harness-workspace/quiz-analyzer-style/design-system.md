# Design System Reference — chat-interface (Target)

> 本文档从 `packages/chat-interface` 提取的设计 token，作为 quiz-analyzer 前端样式迁移的**唯一视觉标准**。

## CSS 变量定义

### Light Mode (`:root`)
```css
:root {
  /* 背景 */
  --bg1: #ffffff;        /* 主背景（卡片、header） */
  --bg2: #F5F5F0;        /* 页面背景（暖灰） */
  --bg3: #F5F5F0;        /* 次级背景（代码块等） */

  /* 文字 */
  --t1: #1A1A18;         /* 主文字（暖黑） */
  --t2: #6B6A68;         /* 次级文字 */
  --t3: #9A9893;         /* 占位/禁用文字 */

  /* 边框 */
  --b1: rgba(0, 0, 0, 0.08);   /* 主边框（半透明） */
  --b2: rgba(0, 0, 0, 0.06);   /* 次级边框（更淡） */

  /* 语义色 */
  --info-bg: #e6f1fb;    --info-t: #0c447c;
  --success-bg: #eaf3de; --success-t: #27500a;
  --warn-bg: #faeeda;    --warn-t: #854f0b;
  --danger-bg: #fde8e8;  --danger-t: #a32d2d;

  /* 圆角 */
  --r: 8px;              /* 标准圆角 */
  --rl: 12px;            /* 大圆角 */

  /* 强调色 */
  --accent: #AE5630;             /* 暖棕/赤陶（Terracotta） */
  --accent-hover: #C4633A;

  /* Composer 阴影 */
  --composer-shadow: 0 0.25rem 1.25rem rgba(0,0,0,0.035), 0 0 0 0.5px rgba(0,0,0,0.08);
  --composer-shadow-hover: 0 0.25rem 1.25rem rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.12);
  --composer-shadow-focus: 0 0.25rem 1.25rem rgba(0,0,0,0.075), 0 0 0 0.5px rgba(0,0,0,0.15);

  /* 内联代码 */
  --inline-code-color: #C0392B;
  --inline-code-bg: rgba(0, 0, 0, 0.04);
  --inline-code-border: rgba(0, 0, 0, 0.08);
}
```

### Dark Mode (`.dark` / `prefers-color-scheme: dark`)
```css
.dark {
  --bg1: #30302E;
  --bg2: #262624;
  --bg3: #393937;
  --t1: #FAF9F5;
  --t2: #9C9A92;
  --t3: #9C9A92;
  --b1: rgba(222, 220, 209, 0.2);
  --b2: rgba(222, 220, 209, 0.15);
  --info-bg: #042c53;  --info-t: #85b7eb;
  --success-bg: #173404; --success-t: #c0dd97;
  --warn-bg: #412402;  --warn-t: #fac775;
  --danger-bg: #3d0c0c; --danger-t: #f09595;

  --accent-hover: #D07040;
  --inline-code-color: #FE8181;
  --inline-code-bg: rgba(194, 192, 182, 0.05);
  --inline-code-border: rgba(222, 220, 209, 0.15);
  --composer-shadow: 0 4px 20px rgba(0,0,0,0.035), 0 0 0 0.5px rgba(222,220,209,0.15);
  --composer-shadow-hover: 0 4px 20px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(222,220,209,0.25);
  --composer-shadow-focus: 0 4px 20px rgba(0,0,0,0.075), 0 0 0 0.5px rgba(222,220,209,0.3);
}
```

## Tailwind `ck-` 色彩映射

在 `tailwind.config.js` 的 `theme.extend.colors` 中：

```js
ck: {
  bg1: 'var(--bg1)',
  bg2: 'var(--bg2)',
  bg3: 'var(--bg3)',
  t1: 'var(--t1)',
  t2: 'var(--t2)',
  t3: 'var(--t3)',
  b1: 'var(--b1)',
  b2: 'var(--b2)',
  'info-bg': 'var(--info-bg)',
  'info-t': 'var(--info-t)',
  'success-bg': 'var(--success-bg)',
  'success-t': 'var(--success-t)',
  'warn-bg': 'var(--warn-bg)',
  'warn-t': 'var(--warn-t)',
  'danger-bg': 'var(--danger-bg)',
  'danger-t': 'var(--danger-t)',
  accent: 'var(--accent)',
  'accent-hover': 'var(--accent-hover)',
},
```

## Tailwind 圆角映射

```js
borderRadius: {
  ck: 'var(--r)',       // 8px — 标准圆角（输入框、小卡片）
  'ck-lg': 'var(--rl)', // 12px — 大圆角（主卡片、面板）
},
```

## Tailwind 阴影映射

```js
boxShadow: {
  'composer': 'var(--composer-shadow)',
  'composer-hover': 'var(--composer-shadow-hover)',
  'composer-focus': 'var(--composer-shadow-focus)',
},
```

## 字体

```js
fontFamily: {
  sans: ['system-ui', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
},
```

**关键**: 移除 Satoshi 字体引用（包括 `index.html` 中的 link 标签）。

## 过渡动画

```js
transitionTimingFunction: {
  'claude': 'cubic-bezier(0.4, 0, 0.2, 1)',          // 稳重、克制
  'claude-spring': 'cubic-bezier(0.165, 0.85, 0.45, 1)', // 弹性（谨慎使用）
},
```

**关键**: 替换原有的 `cubic-bezier(0.16, 1, 0.3, 1)` 弹性过渡。

## 动画 Keyframes

```js
keyframes: {
  'ck-shimmer': {
    '0%': { backgroundPosition: '-200% 0' },
    '100%': { backgroundPosition: '200% 0' },
  },
},
animation: {
  'ck-shimmer': 'ck-shimmer 1.5s ease-in-out infinite',
},
```

## 滚动条

```css
.ck-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: var(--b1) transparent;
  scrollbar-gutter: stable;
}
.ck-scrollbar::-webkit-scrollbar { width: 6px; }
.ck-scrollbar::-webkit-scrollbar-track { background: transparent; }
.ck-scrollbar::-webkit-scrollbar-thumb { background: var(--b1); border-radius: 9999px; }
.ck-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--t3); }
```

## 聚焦环

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ck-accent focus-visible:ring-offset-2
```

## 按钮规范

### Primary Button（CTA）
```
px-4 py-2 bg-ck-accent text-white rounded-lg font-medium
hover:bg-ck-accent-hover active:scale-[0.98]
transition-all duration-200 ease-claude
```

### Secondary Button
```
px-4 py-2 bg-ck-bg1 text-ck-t1 border border-ck-b1 rounded-lg font-medium
hover:bg-ck-bg3 active:scale-[0.98]
transition-all duration-200 ease-claude
```

## 卡片容器规范

```
bg-ck-bg1 rounded-ck-lg shadow-composer border border-ck-b2
```

hover 状态:
```
hover:shadow-composer-hover transition-shadow duration-200 ease-claude
```

## 输入框规范

```
w-full px-4 py-2 bg-ck-bg1 border border-ck-b1 rounded-ck text-ck-t1
placeholder:text-ck-t3
focus:shadow-composer-focus focus:border-ck-accent
transition-all duration-200 ease-claude
```

## Base 层样式

```css
body {
  font-family: system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: var(--bg2);
  color: var(--t1);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

## 文字选中

```css
::selection {
  background-color: var(--accent);
  color: #fff;
}
```

## Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

## 迁移速查对照表

| quiz-analyzer (旧) | chat-interface (新) | 说明 |
|---------------------|---------------------|------|
| `bg-slate-50` / `bg-zinc-50` | `bg-ck-bg2` | 页面背景 |
| `bg-white` | `bg-ck-bg1` | 卡片/header 背景 |
| `text-primary-800` / `text-zinc-900` | `text-ck-t1` | 主文字 |
| `text-zinc-500` / `text-slate-500` | `text-ck-t2` | 次级文字 |
| `text-zinc-400` / `text-slate-400` | `text-ck-t3` | 占位文字 |
| `border-slate-200` / `border-zinc-200` | `border-ck-b1` | 主边框 |
| `border-zinc-300` | `border-ck-b1` | 强边框 |
| `rounded-3xl` | `rounded-ck-lg` | 卡片圆角 |
| `rounded-xl` | `rounded-ck` 或 `rounded-lg` | 按钮/输入框圆角 |
| `shadow-soft` / `shadow-sm` | `shadow-composer` | 阴影 |
| `shadow-glass` / `shadow-xl` | `shadow-composer-hover` | 强阴影 |
| `bg-primary-600` | `bg-ck-accent` | CTA 按钮背景 |
| `hover:bg-primary-700` | `hover:bg-ck-accent-hover` | CTA hover |
| `text-primary-600` / `text-primary-700` | `text-ck-accent` | 强调文字 |
| `bg-cta-500` | `bg-ck-accent` | CTA 按钮（统一为 accent） |
| `ring-primary-500` | `ring-ck-accent` | 聚焦环 |
| `hover:bg-slate-50` / `hover:bg-zinc-50` | `hover:bg-ck-bg3` | hover 背景 |
| `font-['Satoshi']` | `font-sans`（系统字体） | 字体 |
