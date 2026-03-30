# Evaluation Report — v1

## Authentication Status
✅ 认证成功 — `POST http://localhost:3001/api/v1/auth/login` 返回 apiKey `sk-defaultx-5Gaq4I6Q-H0YXoMr9INmuKYl7pCrETak`，通过 `localStorage.setItem('ck-api-key', ...)` 注入并刷新页面。所有 API 调用正常，sidebar 显示会话列表，消息发送/接收功能正常。

## 截图对比摘要

所有截图均在**认证后状态**拍摄，包含真实会话数据。截图文件保存于 `screenshots/v1/eval-*.png`。

### Desktop 1440×900 vs Claude Web Reference

**匹配项 (正面)**:
- 整体色温与 Claude Web 高度一致 — warm off-white 背景 (`#F5F5F0`)，非纯白/纯黑
- 用户消息右对齐 + warm taupe 气泡 (`#DDD9CE`)，与 Claude Web 一致
- 助手消息左对齐、无背景气泡、使用 serif 字体，符合设计系统
- Composer 为 `rounded-[20px]` 浮卡 + shadow，无可见 border，与 Claude Web 一致
- Send 按钮使用 terracotta 强调色 (#AE5630)，32px 尺寸，rounded-lg
- 空状态标题 "What shall we think through?" 使用 serif 字体，与 Claude Web landing 页一致
- Action toolbar (时间戳 "刚刚" + 复制/重试 + tooltip) 匹配 Claude Web 行为
- Sidebar 具有 New chat + Search + Chats 导航 + Recents 分组 + 用户资料

**差距 (负面)**:
- Sidebar 结构简化 — 仅 "Chats" 单一导航项，Claude Web 有 Chats/Projects/Artifacts/Code/Customize 等
- 代码块渲染缺陷 — 多行 TypeScript 代码未保持原始换行，被压缩为 2-3 行连续流式显示
- 快捷 action chips（总结/分析/规划/帮助）位于 Composer 上方，Claude Web 放在 greeting 下方居中
- 顶部 "default" skill badge 和 "Skills" 按钮是平台特有元素，增加了非 Claude 的视觉噪声
- Sidebar "Recents" 仅有一个分组（代码支持 Starred/Yesterday，但当前无数据验证）

### Mobile 375×812
- Sidebar 正确折叠为汉堡菜单 ✅
- 主内容区域全宽 ✅
- Composer 固定在底部 ✅
- 消息可读且适当尺寸 ✅
- Action toolbar 在移动端常驻显示（非 hover）✅

### Tablet 768×1024
- Sidebar 可见，布局合理 ✅
- 用户资料在左下角 ✅
- 内容适应宽度，可用 ✅

## 代码分析指标
| Metric | Count |
|--------|-------|
| 硬编码颜色值 (.tsx) | 0（grep 2 个结果均为 HTML entity &#9612;/&#9654;，非颜色值）|
| `bg-[#] / text-[#] / border-[#]` 硬编码 | 0 |
| `ck-` 前缀 token 引用 | 168 |
| !important (排除 reduced-motion) | 0（4 个全在 `@media (prefers-reduced-motion)` 中）|
| inline style={{}} (总计) | 10（全为动态值：width%、depth padding、grid columns）|
| hover:/focus:/active: classes | 56 |
| transition properties | 48 |
| ease-claude 使用 | 21 |
| active:scale 使用 | 11 |
| focus-visible: 可访问性 | 27+ |
| responsive classes (sm:/md:/lg:) | 13 |
| cn() / twMerge 使用 | 9 |
| font-serif 引用 | 3 |
| typecheck (tsc --noEmit) | PASS |
| tests (vitest) | 76/76 PASS (11 files) |

## 逐维度评分

### 1. Claude Web Visual Alignment (35/100)
**Score: 3/5**
**加权分: 21/35**

- 观察:
  - ✅ Warm neutrals 背景色 (#F5F5F0) 匹配
  - ✅ 用户消息右对齐 + warm taupe 气泡 (#DDD9CE)，`max-w-[min(75ch,85%)]`，`leading-[1.4]`
  - ✅ 助手消息 serif 字体、无气泡、`leading-[1.65rem]`、`pb-3` 间距
  - ✅ Composer `rounded-[20px]` + `shadow-composer` 三态过渡
  - ✅ Send 按钮 `w-8 h-8 rounded-lg bg-ck-accent` (32px, terracotta)
  - ✅ 空状态 serif heading "What shall we think through?"
  - ✅ Antialiased 渲染 + scroll-behavior: smooth
  - ✅ `::selection` 使用 accent 背景色
  - ❌ 代码块换行渲染缺陷 — 多行代码被压缩为连续流
  - ❌ Sidebar 导航简化（仅 Chats，缺 Projects/Artifacts/Code）
  - ❌ 快捷 chips 位置与 Claude Web 不同（Composer 上方 vs greeting 下方）
  - ❌ "default" skill badge 为额外视觉噪声
  - ⚠️ Quick suggestion 样式差异（rounded-full pills vs Claude 的 icon+text 按钮）

- Sidebar 结构检查: [搜索框: ✅] [分组标题: ✅ (Recents)] [新建按钮: ✅]
- Hard cap 触发: 否（3 项结构性元素均存在）
- 扣分原因: 配色/布局/字体体系/核心组件大方向正确，但代码块渲染缺陷 + sidebar 简化 + chips 位置 + 额外 UI + suggestion 样式差异 = 5+ 处明显偏差，符合 3/5 rubric "大方向对了但细节有 5+ 处明显偏差"
- 改进建议:
  1. **[P0] 修复代码块换行**: `MessageRenderer.tsx` — 确保 fenced code block `<pre><code>` 内容保留原始换行符，检查 `white-space: pre` 是否生效
  2. **[P1] 丰富 Sidebar 导航**: `ChatSidebar.tsx` — 添加 Projects/Artifacts 占位导航项，对齐 Claude Web 视觉结构
  3. **[P2] Quick suggestions 改为 icon+text 卡片按钮**: 参考 Claude Web 的 Write/Learn/Code 样式

---

### 2. Cross-Component Consistency (15/100)
**Score: 4/5**
**加权分: 12/15**

- 观察:
  - ✅ 168 次 `ck-` 前缀 token — 几乎所有颜色通过 CSS 变量系统
  - ✅ 0 个硬编码 `bg-[#] / text-[#] / border-[#]`
  - ✅ `ease-claude` 统一使用 21 次
  - ✅ `active:scale` 统一 11 处
  - ✅ Shadow tokens: `shadow-composer` / `-hover` / `-focus` CSS variable 管理
  - ✅ Border-radius 使用一致: rounded-lg (buttons), rounded-full (dots/pills), rounded-[20px] (composer), rounded-xl (user bubble)
  - ⚠️ Widget 组件 (BarList, MetricDashboard, MiniOutline) 使用 inline style 传递动态值，与核心组件纯 Tailwind 方式略有不同
  - ⚠️ cn() 仅 9 次使用 — 部分条件 className 直接用 template string，未通过 tailwind-merge

- 扣分原因: Widget 组件的 inline style 模式与核心组件不完全一致；cn() 使用率可更高
- 改进建议:
  1. Widget 组件中静态 style 属性改用 Tailwind class (如 `MiniOutline.tsx:25` 的 `paddingTop/Bottom`)
  2. 统一条件 className 通过 `cn()` 合并

---

### 3. Responsive & Mobile (15/100)
**Score: 4/5**
**加权分: 12/15**

- 观察:
  - ✅ Desktop 1440px: 正确 2 栏布局，主内容 max-w-3xl 居中
  - ✅ Tablet 768px: Sidebar 可见 + 内容区域正常
  - ✅ Mobile 375px: Sidebar 折叠为 hamburger，overlay 遮罩 (`bg-black/40`)，全宽内容
  - ✅ Composer 在所有视口正确定位
  - ✅ 消息不溢出，无水平滚动
  - ✅ Quick suggestions `flex-wrap` 在窄屏正确换行
  - ✅ ActionToolbar 移动端常驻 (`opacity-100 md:opacity-0 md:group-hover:opacity-100`)
  - ⚠️ 仅 13 个 responsive classes — 密度偏低
  - ⚠️ Send 按钮 32px (w-8 h-8) 低于 44px 移动端触摸目标标准

- 扣分原因: Send/Attach 按钮 32px 低于 44px 触摸标准；responsive class 密度偏低
- 改进建议:
  1. **[P1]** 移动端 Send/Attach 按钮增加 touch 区域（`min-w-[44px] min-h-[44px]` 或 padding 扩展）
  2. 在 320px 极窄视口下测试 Composer 和 chips 是否溢出

---

### 4a. CSS & Interaction Polish (10/100)
**Score: 4/5**
**加权分: 8/10**

- 观察:
  - ✅ 56 个 hover/focus/active 交互类 — 覆盖率良好
  - ✅ 48 个 transition 属性 — 过渡动画充分
  - ✅ 21 次 `ease-claude` 自定义缓动 — 统一动效
  - ✅ 11 次 `active:scale` — 按钮 press feedback
  - ✅ Composer shadow 三态: rest → hover → focus-within
  - ✅ `focus-visible:ring-2` 在关键按钮上 — 键盘可访问
  - ✅ Tooltip 用于 Copy/Retry 按钮
  - ✅ ThinkingDots bounce + streaming cursor blink — loading 状态完整
  - ⚠️ Quick suggestion pills 可能缺少 `focus-visible` ring
  - ⚠️ Sidebar conversation items 的 hover transition 可能缺少 `ease-claude`

- 扣分原因: 主要交互元素状态完整，但个别元素 (quick suggestions, sidebar items) 可能缺少过渡或 focus ring
- 改进建议:
  1. `ChatInterfaceComposer.tsx` — Quick suggestion buttons 确保有 `focus-visible:ring-2 focus-visible:ring-ck-accent`
  2. `ChatSidebar.tsx` — Session items 增加 `ease-claude` easing

---

### 4b. Functional Verification (15/100)
**Score: 3/5**
**加权分: 9/15**

- Authentication: ✅ 成功 — `ck-api-key` localStorage 注入后刷新，401 错误消失
- 消息发送: ✅ 成功 — 输入文本后 Send 激活，点击发送
- 消息渲染:
  - 用户消息: ✅ 右对齐、warm taupe 气泡、正确样式
  - 助手文本: ✅ 左对齐、serif 字体、无气泡
  - 代码块: ⚠️ **有语法高亮 + language label + 复制按钮**，但**代码未正确换行** — 多行 TypeScript 被压缩为 2-3 行连续流
- Sidebar 更新: ✅ 新会话立即出现在 Recents ("Test message from evaluator: ple...")
- Sidebar 搜索: ✅ 输入 "test" 正确过滤匹配会话
- Action toolbar: ✅ "刚刚" 时间戳 + 复制/重试按钮 + tooltip
- 会话切换: ✅ 可在不同会话间切换
- Console 错误: ⚠️ SSE events endpoint 返回错误 (Failed to load resource)，但消息仍通过 polling 或其他机制返回
- New chat: ✅ 新建会话按钮正常工作，清空并重置为空状态

- 扣分原因:
  1. **代码块换行渲染缺陷** — 内容正确但格式不正确（多行代码被压缩）
  2. **SSE 连接报错** — events endpoint 返回 error，可能影响流式渲染稳定性
- 改进建议:
  1. **[P0]** 修复代码块 `<pre>` 元素的 white-space 处理，确保保留原始换行符
  2. 排查 SSE events endpoint (`/conversations/{id}/events`) 连接失败原因

---

### 5. Code Quality & Maintainability (10/100)
**Score: 4/5**
**加权分: 8/10**

- 观察:
  - ✅ 0 个 `!important`（排除 prefers-reduced-motion 合理使用）
  - ✅ 0 个硬编码颜色值
  - ✅ 168 个 `ck-` prefix token — 设计系统 token 化完整
  - ✅ 76/76 测试全部通过
  - ✅ TypeScript 编译无错误
  - ✅ prose.css 独立管理 Markdown 样式
  - ✅ globals.css 结构清晰: light default → dark media query → .dark class
  - ⚠️ 10 个 inline `style={{}}` — 全为动态值但数量偏高
  - ⚠️ cn() 使用 9 次 — 可更广泛使用

- 扣分原因: inline style 数量偏高（虽合理），cn() 采用不够全面
- 改进建议:
  1. `MiniOutline.tsx:25` — `paddingTop: '3px', paddingBottom: '3px'` 改用 Tailwind `py-[3px]`
  2. 增加 cn() 使用覆盖率，特别是有条件 className 的组件

## Penalty 扣分明细
| Rule | Count | Deduction |
|------|-------|-----------|
| 硬编码颜色 (.tsx) | 0 | 0 |
| !important (排除 reduced-motion) | 0 | 0 |
| inline style (非动态值) | 0（10 个均为动态值）| 0 |
| typecheck 失败 | 否 (PASS) | 0 |
| test 失败 | 否 (76/76 PASS) | 0 |
| 功能删除 | 0 | 0 |
| **Penalty 小计** | | **0** |

## Top 3 优先改进项
1. **[P0] 修复代码块换行渲染** — `MessageRenderer.tsx` 中 fenced code block 的 `<pre><code>` 内容未保留换行符，导致多行代码被压缩为连续流显示。需检查 Markdown 渲染器对 newline 的处理，确保 `white-space: pre` 正确生效。此项影响 D1 和 D4b 两个维度。
2. **[P1] 丰富 Sidebar 导航结构** — 当前仅有 "Chats" 单一导航，Claude Web 有 Chats/Projects/Artifacts/Code 等。添加至少 2-3 个占位导航项以对齐 Claude Web 视觉结构。同时验证 "Starred" 分组在有 starred 数据时能正确显示。此项影响 D1 提升。
3. **[P2] 移动端触摸目标 + Quick suggestion 样式优化** — Send 按钮 32px 低于 44px 标准（增加 touch padding）；Quick suggestion pills 改为 icon+text 卡片按钮以对齐 Claude Web 风格。此项影响 D1 和 D3。

## 分数汇总
| Dimension | Score | Weighted |
|-----------|-------|----------|
| Claude Web Alignment (35) | 3/5 | 21 |
| Consistency (15) | 4/5 | 12 |
| Responsive (15) | 4/5 | 12 |
| CSS & Interaction (10) | 4/5 | 8 |
| Functional Verification (15) | 3/5 | 9 |
| Code Quality (10) | 4/5 | 8 |
| **维度小计** | | **70** |
| Penalties | | **0** |

总分: 70/100
