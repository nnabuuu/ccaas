# Chat UI Design System — Claude Web 对标

> 参考来源: claude.ai 生产界面逆向分析 (2026-03-27, 25 dump files)
> Dump 文件: `example/claude-*.json`
> 完整设计系统: `packages/chat-interface/ARCHITECTURE.md` Section 10

## 核心设计身份 (Non-Negotiable)

| 特征 | 具体值 | 为什么重要 |
|------|--------|-----------|
| **Warm neutrals** | 页面背景 light `#F5F5F0` / dark `#262624` | 零纯黑/纯白，每个灰色都带暖色调 |
| **Sans + Serif 双字体** | 用户消息/输入: sans-serif; 助手消息: serif | 区分用户与 AI 的声音 |
| **用户消息右对齐** | `flex justify-end` + `inline-flex`, `max-width: 75ch` | 无头像时右对齐区分角色 |
| **助手消息无气泡** | 裸 serif 文本 + `leading-[1.65rem]` + `pb-3`, 段落覆盖 `leading-normal` (24px) | 干净、阅读优先的排版 |
| **Composer 浮卡阴影** | 双层 shadow + `rounded-[20px]`, `transition-all duration-200` | 无可见 border，"悬浮卡片"质感 |
| **Terracotta 强调色** | `#AE5630` (发送按钮、链接) | 品牌色，暗色模式也不变 |
| **Antialiased 渲染** | html: `-webkit-font-smoothing: antialiased`, `scroll-behavior: smooth` | 字体平滑 + 平滑滚动 |

## 字体 (Typography)

```
体系字体:
  --font-ui:             system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif
  --font-ui-serif:       Georgia, "Times New Roman", serif
  --font-mono:           ui-monospace, monospace

Claude dump 原始:          "Anthropic Serif", Georgia, "Times New Roman", serif
我们的 fallback:            Georgia, "Times New Roman", serif (去掉私有 Anthropic 字体)

使用规则:
  body / 用户消息 / Composer 输入:  --font-ui (sans-serif)
  助手消息 / 空状态标题:           --font-ui-serif (serif)
  代码块 / 模型标签:               --font-mono
```

## 色板 (CSS Variables)

```
Light:
  --bg1: #FFFFFF       (composer card bg)
  --bg2: #F5F5F0       (page bg — warm off-white)
  --bg3: #F5F5F0       (hover / code bg)
  --t1:  #1A1A18       (primary text — warm near-black)
  --t2:  #6B6A68       (secondary text)
  --t3:  #9A9893       (placeholder)
  --b1:  rgba(0,0,0,0.08)
  --b2:  rgba(0,0,0,0.06)
  --user-bubble-bg: #DDD9CE           (warm taupe)
  --accent: #AE5630                    (terracotta orange)
  --inline-code-color: #C0392B         (dark coral)
  --inline-code-bg: rgba(0,0,0,0.04)   (subtle overlay)
  --inline-code-border: rgba(0,0,0,0.08)

Dark (from claude.ai dump 2026-03-27):
  --bg1: #30302E       (composer card bg — rgb(48,48,46))
  --bg2: #262624       (page bg — rgb(38,38,36))
  --bg3: #393937       (hover / code bg)
  --t1:  #FAF9F5       (primary text — rgb(250,249,245), warm white)
  --t2:  #9C9A92       (secondary text — rgb(156,154,146))
  --t3:  #9C9A92       (placeholder)
  --b1:  rgba(222,220,209,0.2)         (warm light border)
  --b2:  rgba(222,220,209,0.15)
  --user-bubble-bg: #141413             (very dark — rgb(20,20,19))
  --inline-code-color: #FE8181          (coral — rgb(254,129,129))
  --inline-code-bg: rgba(194,192,182,0.05)   (subtle tan overlay)
  --inline-code-border: rgba(222,220,209,0.15)
```

## Markdown 排版细节

```
来源: claude-markdown-styles dump

段落:
  margin: 0 (非默认 prose margin)
  white-space: pre-wrap
  line-height: 24px (leading-normal) — 覆盖容器的 26.4px

Strong (粗体):
  font-weight: 530 (Claude 非标准值)
  我们使用: font-medium (500, 最接近 530)

Emphasis (斜体):
  font-style: italic
  font-weight: 360 (Claude variable font, 我们使用默认 italic)
  line-height: 1.65rem (26.4px)

Ordered List:
  font-family: serif (与助手消息一致)
  line-height: 1.65rem (26.4px)
  padding-left: 32px (pl-8)
  margin-bottom: 12px (mb-3)

Table:
  font-family: serif (与助手消息一致)
  font-size: 14px (text-sm)
  line-height: 23.8px (1.7em)
  TH: font-weight 530 (≈medium), text-align left, padding 8px 16px 8px 1px
  TD: font-weight 360 (normal), padding 8px 16px 8px 1px
  我们使用: [&_table]:text-sm [&_th]:font-medium [&_th]:py-2 [&_th]:pr-4 [&_td]:py-2 [&_td]:pr-4

Inline Code:
  display: inline-flex
  color: var(--inline-code-color) — coral #FE8181 (dark) / #C0392B (light)
  background: var(--inline-code-bg) — subtle overlay
  border: 0.5px solid var(--inline-code-border)
  border-radius: 6.4px
  font-size: 0.9em (14.4px at 16px base)
  padding: 1px 4px (py-px px-1)
```

## 消息布局

```
用户消息 (mt-6 mb-1, flex-col items-end):
  ┌─ inline-flex, right-aligned (items-end) ──────┐
  │ bg: --user-bubble-bg (light #DDD9CE / dark #141413) │
  │ radius: 12px (rounded-xl)                    │
  │ padding: py-2.5 px-4                         │
  │ max-width: min(75ch, 85%)                    │
  │ font: 16px, sans-serif (--font-ui)           │
  │ line-height: 1.4 (22.4px) — leading-[1.4]   │
  │ wrapper: mt-6 mb-1                           │
  └──────────────────────────────────────────────┘

助手消息 (font-serif leading-[1.65rem]):
  DOM 结构: group → contents (display:contents) → pb-3 wrapper → font-claude-response
  无背景, 无边框
  font: 16px serif (--font-ui-serif), leading-[1.65rem]
  容器行高: 26.4px (leading-[1.65rem]), 段落覆盖: 24px (leading-normal)
  padding: pl-2 pr-8 (left 8px, right 32px — 段落级 padding 确认)
  padding-bottom: 12px (pb-3)
  消息间总间距: pb-3 (12px) + 下条用户消息 mt-6 (24px) = 36px

滚动容器 (来源: claude-page, patch-1/message-alignment):
  classes: overflow-y-auto, overflow-x-hidden, scrollbar-gutter:stable, pt-6, flex-1
  内容区: max-w-3xl mx-auto px-4 pt-6 pb-4
```

## Composer

```
  ┌─────────────────────────────────────────────┐
  │ textarea (auto-resize, rows=1)              │  bg: --bg1
  │ font: 16px sans-serif                       │  shadow: 3-stage
  │ padding: px-3.5 pt-3.5 pb-10               │  radius: 20px
  │ placeholder: "输入消息..."                    │  transition-all 200ms
  │                                    [↑ Send] │  send: 32px rounded-lg
  └─────────────────────────────────────────────┘

  Light shadows:
    rest:  0 4px 20px rgba(0,0,0,0.035), 0 0 0 0.5px rgba(0,0,0,0.08)
    hover: 0 4px 20px rgba(0,0,0,0.05),  0 0 0 0.5px rgba(0,0,0,0.12)
    focus: 0 4px 20px rgba(0,0,0,0.075), 0 0 0 0.5px rgba(0,0,0,0.15)

  Dark shadows:
    rest:  0 4px 20px rgba(0,0,0,0.035), 0 0 0 0.5px rgba(222,220,209,0.15)
    hover: 0 4px 20px rgba(0,0,0,0.05),  0 0 0 0.5px rgba(222,220,209,0.25)
    focus: 0 4px 20px rgba(0,0,0,0.075), 0 0 0 0.5px rgba(222,220,209,0.3)

  Send button: w-8 h-8 (32px), rounded-lg (8px radius), bg --accent
```

## 代码块

```
  ┌─ language ────────────────────── [复制] ─┐  border: --b1
  │                                          │  bg: --bg3
  │  code content (font-mono, 14px / text-sm)│  radius: 8px (rounded-lg)
  │  padding: 16px (p-4)                     │  header: font-sans, 12px
  │  line-height: relaxed                    │
  └──────────────────────────────────────────┘

Claude dump: font-size 14px, line-height 22.75px, padding 14px, radius 8px
```

## 动效 (Easing & Animation)

```
三种 easing 曲线:
  ease-claude:        cubic-bezier(0.4, 0, 0.2, 1)    — 标准过渡 (Material)
  ease-claude-spring: cubic-bezier(0.165, 0.85, 0.45, 1)  — 交互反馈 (spring)
  ease-bounce:        cubic-bezier(0.19, 1, 0.22, 1)  — transform (参考，未实现)
```

| 元素 | 效果 | 值 |
|------|------|-----|
| 所有交互元素 | easing | `ease-claude` |
| 普通按钮 | press feedback | `active:scale-[0.98]` |
| Send 按钮 | press feedback | `active:scale-95` |
| Composer 阴影 | transition | `transition-all duration-200` |
| 颜色/背景 | transition | `duration: 200ms` |

## 按钮尺寸

| 按钮 | 尺寸 | 圆角 | 备注 |
|------|------|------|------|
| Send | 32x32 (`w-8 h-8`) | `rounded-lg` (8px) | bg --accent |
| 菜单/Toolbar | 32x32 | `rounded` (4px) | 透明背景 |

## Scrollbar

```
.ck-scrollbar:
  scrollbar-width: thin
  scrollbar-color: var(--b1) transparent
  scrollbar-gutter: stable
  thumb border-radius: 9999px (full round)
  thumb hover: var(--t3)

.ck-scrollbar-hidden:
  scrollbar-width: none
  ::-webkit-scrollbar { width: 0; display: none; }
```

## Thinking Indicator

```
来源: claude-special-components, claude-loading-states

text-xs (12px), font-serif, select-none
color: var(--t2) — rgb(156, 154, 146)
三个 bounce dots: 1.5x1.5 (6px), bg var(--t3)
```

## 链接交互 (Links)

```
来源: claude-interaction-states, claude-markdown-styles

Markdown 内容链接 (已实现):
  base:  text-ck-info-t + underline, text-decoration-color: color-mix(in srgb, currentcolor 40%, transparent)
  hover: text-ck-accent + text-decoration-color: currentcolor (全色下划线)
  实现: MessageRenderer.tsx prose 覆盖
```

## 文本选择 (Selection)

```
来源: claude-pseudo-elements

::selection {
  background-color: var(--accent);   // terracotta
  color: #fff;
}

Claude 原始 (code-block):
  background-color: hsl(var(--accent-100))
  color: hsl(var(--oncolor-100))
```

## Tooltip (已实现 — Tooltip.tsx)

```
来源: claude-tooltip

background: rgba(0,0,0,0.8)
color: white
border-radius: 6px
padding: 4px 8px
font-size: 12px
z-index: 50
shadow: subtle
```

## Toast (已实现 — sonner Toaster)

```
来源: claude-error-toast

z-index: 60
位于页面顶部
```

## Z-Index 层级 (参考)

| 层级 | 用途 |
|------|------|
| -1 | gradient overlays, hidden iframes |
| 0 | sidebar panels |
| 1 | scroll-to-bottom button (size-9=36px, semi-transparent bg), composer card |
| 2 | message content |
| 5 | sticky footer (composer area) |
| 10 | absolute controls (code copy button) |
| 20 | header (sticky), share button |
| 30 | sidebar resize handle |
| 50 | tooltip |
| 60 | toast |

## Checklist (修改 Chat UI 前必查)

```
□ 颜色是否使用 warm neutrals？(禁止纯黑 #000 / 纯白 #FFF / 冷灰)
□ 助手消息是否使用 serif 字体？
□ 用户消息 / Composer 输入是否使用 sans-serif？
□ 助手消息是否无背景气泡？
□ 用户消息是否右对齐 (flex justify-end)？
□ Composer 是否 rounded-[20px] + shadow (非 border)？
□ Send 按钮是否 32px rounded-lg？
□ 按钮是否有 active:scale 反馈？
□ 新增颜色是否同步更新了 dark mode 变量？
□ easing 是否使用 ease-claude / ease-claude-spring？
□ Inline code 是否使用 coral 颜色 + subtle border？
□ Paragraph margin 是否为 0 (非 prose 默认)？
□ Strong 是否 font-medium (非 bold)？
□ UL/LI margin 是否为 0？
□ 链接 hover 是否变为 accent 色？
□ ::selection 是否使用 accent 背景色？
□ 助手消息间距是否 pb-3 (非 mb-12)？
□ 用户消息行高是否 leading-[1.4] (非 leading-relaxed)？
□ 段落行高是否 leading-normal (覆盖容器 26.4px)？
```

## Future Features (待实现)

完整 feature gap backlog 见 → [feature-backlog.md](./feature-backlog.md)

### Action Toolbar (已实现 — ActionToolbar.tsx)
```
来源: claude-interaction-states, claude-assistant-message

助手消息 hover 时显示 action toolbar:
  位置: 消息底部
  内容: timestamp + Copy 按钮 (Tooltip 提示)
  交互: 移动端常驻，桌面端 hover 可见
  待实现: Retry + Edit 按钮
```
