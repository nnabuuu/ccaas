# Feature Gap Backlog — Claude Web 对标

> 数据来源: claude.ai 生产界面逆向分析 (2026-03-27)
> Dump 文件: `example/claude-*.json` (25 主文件 + 9 patch 文件)
> 分析方法: 浏览器自动化抓取 CSS computed styles、DOM 结构、交互状态、动画关键帧

---

## High Priority

### #1 Action Toolbar (hover 显示)

| 字段 | 值 |
|------|-----|
| **Dump 来源** | `claude-interaction-states`, `claude-assistant-message` |
| **Claude.ai 行为** | 助手消息 hover 时在底部显示 action toolbar: timestamp + Copy + Retry + Edit 按钮。按钮 32x32, rounded(4px), 透明背景, hover 时显示 bg |
| **当前状态** | 未实现。`design-system.md` Future Features 已记录规格 |
| **复杂度** | M — 需要 hover state 管理、clipboard API、消息级 action 回调 |

### #2 消息时间戳

| 字段 | 值 |
|------|-----|
| **Dump 来源** | `claude-assistant-message`, `claude-interaction-states` |
| **Claude.ai 行为** | 消息 hover 时在 action toolbar 中显示相对时间戳 (如 "2 分钟前")。text-xs, text-t2, font-sans |
| **当前状态** | ChatMessage 已有 `timestamp` 字段但未渲染 |
| **复杂度** | S — 格式化 + 条件显示 |

### #3 Toast 通知系统

| 字段 | 值 |
|------|-----|
| **Dump 来源** | `claude-error-toast` |
| **Claude.ai 行为** | 页面右上角 fixed 定位 toast 容器, z-index 60, flex-col gap-12px, aria-live="polite"。用于错误提示、操作反馈 |
| **当前状态** | 未实现。错误仅在 console.error 输出 |
| **复杂度** | M — 需要 toast context/provider、动画进出、自动消失 |

### #4 Streaming 光标动画

| 字段 | 值 |
|------|-----|
| **Dump 来源** | `claude-loading-states`, `claude-animations` |
| **Claude.ai 行为** | 流式响应时末尾显示闪烁光标 (blink 动画: opacity 0↔1)。Claude 使用 `animation: blink` keyframe |
| **当前状态** | 已用 Unicode block `▌` 字符追加，但无闪烁动画 |
| **复杂度** | S — 添加 CSS `@keyframes blink` + 光标 span |

---

## Medium Priority

### #5 Tooltip 组件

| 字段 | 值 |
|------|-----|
| **Dump 来源** | `claude-tooltip` |
| **Claude.ai 行为** | bg rgba(0,0,0,0.8), color white, 12px font-sans, radius 6px, padding 4px 8px, z-50, max-width 208px, shadow subtle |
| **当前状态** | 未实现。`design-system.md` 已记录规格 |
| **复杂度** | M — 需要 positioning logic (Radix 或自定义) |

### #6 Scroll-to-Bottom 按钮

| 字段 | 值 |
|------|-----|
| **Dump 来源** | `claude-zindex`, `claude-page` |
| **Claude.ai 行为** | z-index 1, size-9 (36px), 半透明背景, 圆形, 下箭头图标。滚动离底部一定距离时显示，点击平滑滚动到底 |
| **当前状态** | 使用 `scrollIntoView` 自动滚动，但无手动触发按钮 |
| **复杂度** | M — scroll position 检测 + 条件渲染 + 动画 |

### #7 inline-link 下划线样式

| 字段 | 值 |
|------|-----|
| **Dump 来源** | `claude-interaction-states`, `claude-markdown-styles` |
| **Claude.ai 行为** | 链接非 hover: `text-decoration-color: color-mix(in srgb, currentcolor 40%, transparent)` (40% 透明下划线)。hover: 全色下划线 |
| **当前状态** | 使用 `no-underline` + hover `underline`，缺少 40% 半透明过渡态 |
| **复杂度** | S — CSS `text-decoration-color` + `color-mix()` |

### #8 UL 字体一致性

| 字段 | 值 |
|------|-----|
| **Dump 来源** | `claude-markdown-styles` |
| **Claude.ai 行为** | UL/OL 均使用 serif 字体与助手消息一致。OL 已设 `font-serif`，UL 未设 |
| **当前状态** | prose 覆盖中 `[&_ol]:font-serif` 已设，但 `[&_ul]:font-serif` 缺失 |
| **复杂度** | S — 添加一个 Tailwind utility |

### #9 focus-visible 样式

| 字段 | 值 |
|------|-----|
| **Dump 来源** | `claude-interaction-states` |
| **Claude.ai 行为** | 43 条 focus 规则，链接 focus 时 `transform: translate(0, -1px)`。交互元素使用 `focus-visible` (非 `focus`) 避免鼠标点击显示 outline |
| **当前状态** | 未统一使用 `focus-visible`，部分元素缺少键盘焦点样式 |
| **复杂度** | S — 全局 `focus-visible:outline` 策略 |

### #10 语法高亮 (Syntax Highlighting)

| 字段 | 值 |
|------|-----|
| **Dump 来源** | `claude-markdown-styles`, `claude-special-components` |
| **Claude.ai 行为** | 代码块内文本有语法着色 (使用 Shiki 或 Prism 级别高亮) |
| **当前状态** | CodeBlock 渲染纯文本，无语法高亮 |
| **复杂度** | M — 需引入 Shiki/rehype-highlight，考虑流式场景 bundle size |

---

## Lower Priority

### #11 消息 Feedback (thumbs up/down)

| 字段 | 值 |
|------|-----|
| **Dump 来源** | `claude-interaction-states` |
| **Claude.ai 行为** | 助手消息 action toolbar 中包含 👍/👎 反馈按钮，点击后发送反馈到后端 |
| **当前状态** | 未实现 |
| **复杂度** | M — UI + API 集成 |

### #12 Sidebar 导航

| 字段 | 值 |
|------|-----|
| **Dump 来源** | `claude-sidebar` |
| **Claude.ai 行为** | 左侧固定 sidebar (49px 收起, ~260px 展开), 渐变背景, 包含: 新对话、搜索、自定义、对话列表、项目。border: 0.5px rgba(222,220,209,0.15) |
| **当前状态** | ChatInterface 是 headless widget，sidebar 由宿主应用提供 (通过 `onMenuClick` prop) |
| **复杂度** | L — 但属于宿主应用职责，非 chat-interface 内部功能 |

### #13 Header Bar

| 字段 | 值 |
|------|-----|
| **Dump 来源** | `claude-header-bar` |
| **Claude.ai 行为** | sticky, z-20, 包含: 对话标题 (ellipsis 截断)、分享按钮、Edit/Retry 按钮。height 12px offset |
| **当前状态** | SessionContextBar 承担部分角色，但无标题显示、分享功能 |
| **复杂度** | M — 扩展 SessionContextBar 或新增 header slot |

### #14 Model Selector

| 字段 | 值 |
|------|-----|
| **Dump 来源** | `claude-composer` |
| **Claude.ai 行为** | Composer 底部左侧显示模型选择器 "Opus 4.6 Extended"，点击展开下拉 |
| **当前状态** | 未实现。Composer 只有 textarea + send button |
| **复杂度** | M — UI + backend Skill/Agent 选择集成 |

### #15 Thinking Block (可折叠)

| 字段 | 值 |
|------|-----|
| **Dump 来源** | `claude-special-components`, `claude-loading-states` |
| **Claude.ai 行为** | TABLE 结构的可折叠 thinking block，展开显示思考过程。使用 `accordion-open/close` 动画 |
| **当前状态** | ThinkingDots 仅显示 "思考中..." + bounce 动画，无可折叠展示思考内容 |
| **复杂度** | M — 需要后端传递 thinking content，前端 accordion 组件 |

### #16 Shimmer 加载动画

| 字段 | 值 |
|------|-----|
| **Dump 来源** | `claude-animations`, `claude-loading-states` |
| **Claude.ai 行为** | `@keyframes shimmer`: -100% → 100% translateX。`shimmertext`: background-position 动画。用于骨架屏和加载态 |
| **当前状态** | 未实现。加载历史时使用纯文本 "加载历史记录..." |
| **复杂度** | S — CSS keyframes + skeleton 组件 |

### #17 Voice Input

| 字段 | 值 |
|------|-----|
| **Dump 来源** | `claude-composer` (推测，非直接抓取) |
| **Claude.ai 行为** | Composer 中有麦克风按钮，支持语音输入 |
| **当前状态** | 未实现 |
| **复杂度** | L — Web Speech API / 第三方 STT |

---

## 未接通代码

### #18 Phase 2 渲染路径

| 字段 | 值 |
|------|-----|
| **来源** | `ARCHITECTURE.md` 关键文件清单 |
| **描述** | `src/harness/postprocessor.ts` 定义了 widget 路由和 MCP 执行路径，但部分路径仅有接口定义未接通实际组件 |
| **当前状态** | parseAssistantContent 已工作，但 widget spec 解析的复杂场景 (嵌套 widget、条件渲染) 未覆盖 |
| **复杂度** | M |

### #19 tokens.css 不一致

| 字段 | 值 |
|------|-----|
| **来源** | `claude-css-variables` dump vs `globals.css` |
| **描述** | Claude dump 记录了 333 个 CSS custom properties (含 10 色族 × 90+ 阶), 当前 globals.css 仅实现核心子集 (~30 变量)。Claude 使用 HSL 色值系统 (如 `--gray-500: 40 3% 60%`), 我们使用 hex/rgba 直接值 |
| **当前状态** | 功能正常，但色彩系统与 Claude 原始不完全对应。扩展新组件时可能需要补充中间色阶 |
| **复杂度** | M — 需要决定是否迁移到 HSL 系统 |

### #20 MCP 数据源桥接

| 字段 | 值 |
|------|-----|
| **来源** | `ARCHITECTURE.md` → `src/widgets/mcp-bridge.ts` |
| **描述** | MCP Bridge 类型已定义，但实际 MCP tool 调用的流式结果渲染仅有 `mcp_result` block 的 details/summary 折叠显示 |
| **当前状态** | 基础可用，但缺少 MCP tool 执行进度指示、错误恢复、结果格式化 |
| **复杂度** | L |

### #21 Accessibility (a11y) 缺口

| 字段 | 值 |
|------|-----|
| **来源** | `claude-error-toast` (aria-live), `claude-interaction-states` (focus), `claude-fonts` (OpenDyslexic) |
| **描述** | Claude 使用 `aria-live="polite"` 做 toast 播报、focus-visible 做键盘导航、OpenDyslexic 字体做阅读障碍支持 |
| **当前状态** | 缺少 aria 标注、screen reader 支持、键盘导航优化 |
| **复杂度** | M — 渐进式改进 |

---

## 已实现清单

以下功能已在当前代码中实现，作为 reference:

| 功能 | 实现位置 | Dump 来源 |
|------|----------|-----------|
| Warm neutrals 色板 (light/dark) | `globals.css` CSS variables | `claude-css-variables`, `claude-unique-values` |
| Sans + Serif 双字体 | `tailwind.config.js` fontFamily, MessageRenderer | `claude-fonts`, `claude-markdown-styles` |
| 用户消息右对齐 + bubble | MessageRenderer `flex items-end` | `claude-message-alignment` |
| 助手消息无气泡 serif | MessageRenderer `font-serif` | `claude-assistant-message` |
| Composer 浮卡阴影 | `globals.css` `--composer-shadow-*` | `claude-composer` |
| Terracotta 强调色 | `--accent: #AE5630` | `claude-css-variables` |
| Antialiased 渲染 | `globals.css` html rules | `claude-page` |
| Inline code coral 样式 | prose 覆盖 `[&_code]` | `claude-markdown-styles` |
| Markdown 排版 (p/strong/em/ol/table) | prose 覆盖 | `claude-markdown-styles` |
| Composer 多态阴影 (rest/hover/focus) | shadow-composer-* | `claude-composer` |
| Send 按钮 32px rounded-lg | ChatInterface button | `claude-composer` |
| Active press feedback | `active:scale-95` / `active:scale-[0.98]` | `claude-interaction-states` |
| Custom scrollbar (thin + thumb) | `.ck-scrollbar` | `claude-scrollbar` |
| ::selection terracotta | `::selection` rule | `claude-pseudo-elements` |
| ThinkingDots 动画 | ThinkingDots.tsx | `claude-loading-states`, `claude-special-components` |
| CodeBlock (语言标签 + 复制) | CodeBlock.tsx | `claude-markdown-styles` |
| Dark mode CSS variables | `.dark` + `prefers-color-scheme` | `claude-css-variables` |
| Easing curves (ease-claude) | `tailwind.config.js` | `claude-animations` |
| 响应式 max-w-3xl 约束 | ChatInterface `max-w-3xl mx-auto` | `claude-responsive` |
| Streaming cursor (▌ 字符) | ChatInterface useEffect | `claude-loading-states` |
| Link hover → accent color | `[&_a:hover]:text-ck-accent` | `claude-interaction-states` |
| Z-index 层级 (composer z-5) | design-system.md 参考 | `claude-zindex` |
| scrollbar-gutter: stable (#5) | `globals.css` `.ck-scrollbar` | `claude-scrollbar`, `claude-page` |
| Code block not-prose wrapper (#10) | `CodeBlock.tsx` `not-prose my-3` | `claude-markdown-styles`, `claude-special-components` |
