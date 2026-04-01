# Evaluation Criteria

> 你是一个独立的 design QA reviewer。你没有参与代码编写过程。
> 按照以下标准严格评分。如果某些东西对你作为新读者来说不清楚，那它就是个问题。

## Pre-Scoring Gate (MANDATORY)

在打分前，Evaluator **必须**完成以下认证步骤：

1. 确认后端 `localhost:3001` 可达
2. 执行登录：`POST http://localhost:3001/api/v1/auth/login` with `{ "username": "admin", "password": "dev123" }`
3. 获取 `apiKey` 并记录

**如果认证失败**：
- D1 (Visual Alignment) 直接给 **0/5** — 因为无法验证真实数据状态下的视觉效果
- D4b (Functional Verification) 直接给 **0/5** — 因为无法验证交互功能
- 其他维度正常评分（基于代码分析）
- 在报告顶部注明 `⚠️ AUTHENTICATION FAILED — D1 and D4b scored 0 by gate rule`

## Scoring Dimensions

### 1. Design System Alignment (Weight: 35/100)
**What to evaluate**: 整体视觉效果与 `design-system.md` 规范的一致程度。重点检查 spacing、颜色、字体、圆角、阴影是否匹配设计系统文档。同时检查产品一致性（不应有不属于本产品的 UI 元素）。

**评估标准**：
- **视觉语言**对标 design-system.md（色彩、字体、间距、阴影、动效）
- **功能结构**对标产品自身需求（不要求 Claude Web 独有功能如 Projects/Artifacts/Code）
- **产品一致性**：不应有禁用的、不属于本产品的导航项或功能按钮

| Score | Description |
|-------|-------------|
| 5 | spacing、颜色、字体、圆角、阴影完全对齐 design-system.md。UI 中无多余/禁用的非产品元素。整体视觉专业精致 |
| 4 | 整体观感与设计系统一致，仅有 1-2 处细微偏差（如某个阴影值或边距差 2px） |
| 3 | 大方向对了（配色方案、布局结构），但细节有 5+ 处明显偏差（间距差 4px+、颜色值不匹配） |
| 2 | 能看出参考了设计系统，但多处明显不协调 |
| 1 | 整体观感差距大，设计系统规范基本未落实 |

**Hard cap**:
- 如果 sidebar 展开状态缺少搜索框、会话分组（Starred/Recents 等分区）、新建会话按钮中的任意 2 项，D1 **最高 2/5**
- 如果 sidebar 展开状态包含禁用的、不属于本产品的导航项（如 Projects/Artifacts/Code），D1 **最高 4/5**（产品一致性问题）

**Detection method**:
1. 检查 `design-system.md` 中的 checklist 各项是否满足
2. **必须使用认证后的浏览器截图**（有真实数据的状态），desktop 1440×900 + mobile 375×812
3. 逐项检查: warm neutrals、serif/sans 双字体、用户消息右对齐、composer 浮卡阴影、terracotta 强调色
4. 逐项检查 sidebar 展开状态: 搜索框、分组标题、会话项样式、新建会话按钮
5. 检查是否有不属于产品的 UI 元素（禁用的导航项、无功能的按钮等）
6. 检查产品特性组件的视觉质量:
   - Context chips（SessionContextBar）— 默认无 chips 时 bar 自动隐藏是正确行为（core 不注入基础设施参数）；通过 `?chips=` 传参时应正确渲染、样式符合设计系统
   - SkillBadge — 助手消息上是否展示 skill 标签、样式是否匹配 `chat-interface.html` 原型
   - QuickSuggestions — 是否可见、样式是否符合设计系统
   - **SkillPanel 排除评估**（即将重建）
7. 视觉层级微观检查（border/divider/separator）:
   - 所有分割线/边框不应比内容更 eye-catching
   - border 应使用 b2 或更淡的 token（b1 at reduced opacity）
   - 如果任何分割线在截图中一眼能看到（视觉权重 > 内容文字）→ 扣分
8. 默认/空状态首屏印象（D1 加扣分项）:
   - 打开应用首屏（无消息），整体观感是否协调、专业
   - **基础设施泄漏检查**: 是否有技术标识出现在用户界面？扫描：tenant='default' 或原始 tenantId 作为 chip/文本、内部 ID、调试文本、serverUrl 等开发者信息
   - **分层正确性**: chat-interface 是 core 组件库 — 无 Solution 注入数据时 context bar 应自动隐藏（空 chips → bar 不渲染），这是正确行为而非缺陷
   - 如果首屏有无意义的默认数据或基础设施参数泄漏 → D1 扣 0.5 分并列入 "Top 3 优先改进项"

---

### 2. Cross-Component Consistency (Weight: 15/100)
**What to evaluate**: 各组件间的样式是否统一使用 CSS 变量体系、相同的 spacing scale、相同的 border-radius/shadow token。

| Score | Description |
|-------|-------------|
| 5 | 所有组件使用相同的 CSS 变量体系、相同的 spacing scale、相同的 border-radius/shadow token。零硬编码颜色值 |
| 4 | 95%+ 样式走 CSS 变量，个别边缘组件有 1-2 处硬编码 |
| 3 | 80%+ 的样式走 CSS 变量，但仍有若干硬编码值或组件间 spacing 不一致 |
| 2 | 核心组件基本统一，但 widget/辅助组件大量硬编码 |
| 1 | 各组件各自为政，大量硬编码颜色、不同的 spacing 值、不一致的 border-radius |

**Detection method**:
1. `grep -rn '#[0-9a-fA-F]\{3,8\}' packages/chat-interface/src/components/ packages/chat-interface/src/widgets/` — 统计硬编码颜色值（排除 globals.css 中的变量定义）
2. `grep -rn 'rgb(' packages/chat-interface/src/components/ packages/chat-interface/src/widgets/` — 同上
3. 对比各组件的 `rounded-` 类使用是否一致
4. 对比各组件的 padding/margin 值是否遵循统一的 spacing scale
5. 检查所有 `bg-` 和 `text-` 类是否使用 `ck-` 前缀的自定义颜色

---

### 3. Responsive & Mobile (Weight: 15/100)
**What to evaluate**: 320px-1440px 全范围的布局可用性。重点关注 Sidebar 折叠、Composer 位置、消息区域溢出、触摸目标尺寸。

| Score | Description |
|-------|-------------|
| 5 | 320px-1440px 全范围可用。Sidebar 在移动端正确折叠/展开，Composer 不被键盘遮挡，消息区域不溢出，触摸目标 ≥ 44px |
| 4 | 桌面和平板优秀，手机端仅有 1 处小问题 |
| 3 | 桌面端良好，平板勉强可用，手机端有 1-2 处布局问题（溢出、重叠） |
| 2 | 桌面端可用，但平板/手机端多处布局问题 |
| 1 | 手机端基本不可用，元素溢出、重叠、无法操作 |

**Detection method**:
1. 浏览器截图 at 375px, 768px, 1440px viewports
2. `grep -rn 'sm:\|md:\|lg:\|xl:' packages/chat-interface/src/` — 统计 responsive 类使用密度
3. 检查 `overflow-` 处理是否到位
4. 检查 `min-w-` / `max-w-` 约束是否合理
5. 检查可交互元素尺寸是否 ≥ 44px（移动端触摸目标）

---

### 4a. CSS & Interaction Polish (Weight: 10/100)
**What to evaluate**: 可交互元素的状态覆盖率（hover/active/focus）、过渡动画质量、loading 状态完整性。

| Score | Description |
|-------|-------------|
| 5 | 所有可交互元素有 hover/active/focus 状态，过渡动画流畅（150-300ms），loading 状态完整，键盘导航可用，focus ring 可见 |
| 4 | 主要交互元素状态完整，仅 1-2 处缺少过渡 |
| 3 | 主要按钮有 hover 状态，但部分元素缺少过渡或状态不全 |
| 2 | 只有少数元素有交互反馈 |
| 1 | 大部分交互无视觉反馈，点击没有响应感 |

**Detection method**:
1. `grep -rn 'hover:\|focus:\|active:' packages/chat-interface/src/` — 统计交互状态类覆盖率
2. `grep -rn 'transition' packages/chat-interface/src/` — 检查过渡属性
3. 浏览器交互验证：hover 按钮、focus 输入框、点击交互元素
4. 检查 `ease-claude` / `ease-claude-spring` easing 曲线使用
5. 检查 `active:scale-` press feedback 是否应用在所有按钮上

---

### 4b. Functional Verification (Weight: 15/100)
**What to evaluate**: 通过实际浏览器交互验证核心功能是否正常工作。**必须在认证后的状态下测试。**

| Score | Description |
|-------|-------------|
| 5 | 登录成功、发消息后正确渲染、cancel/stop 可用、sidebar 显示新会话、产品特性组件（context chips、skill badge、quick suggestions）可见且样式正确 |
| 4 | 核心流程正常，产品特性基本可见，仅有 1 处小问题 |
| 3 | 登录和发消息成功，但产品特性组件部分不可见或样式有瑕疵 |
| 2 | 登录成功但部分核心交互失败，或产品特性组件完全不可见 |
| 1 | 登录失败或基本交互不可用 |

**Detection method** (必须在浏览器中实际执行):
1. 打开 `http://localhost:5190/`，确认页面加载
2. 使用应用的登录界面或直接通过 API 登录
3. 发送一条测试消息，验证：
   - 用户消息正确显示（右对齐、气泡样式）
   - 助手回复正确渲染（Markdown、代码块）
3.5. 取消处理测试:
   - 发送一条会触发较长回复的消息（如 "写一篇 500 字的文章"）
   - 在助手生成回复过程中，点击 composer 区域的 stop/cancel 按钮
   - 验证: 生成是否停止、界面是否恢复到可输入状态
   - 按 Escape 键也应能取消（当 composer 未聚焦时）
   - 如果 cancel 不工作 → D4b 最高 3/5
4. 检查 sidebar 展开状态：
   - 会话列表是否显示当前会话
   - 是否有搜索框和分组
   - hover/active 状态是否正常
   - 不应有禁用的非产品导航项（如 Projects/Artifacts/Code）
5. 检查 sidebar 收缩/展开切换：
   - 点击 toggle 收起 sidebar
   - 点击 toggle 展开 sidebar
   - 验证展开后恢复完整 sidebar
6. 检查产品特性组件（认证后状态下）：
   - Context chips（顶部栏）— 默认无 chips 时 bar 自动隐藏是正确行为；可通过 `?chips=[{"key":"test","label":"测试","active":true}]` 验证 chip 渲染和交互
   - SkillBadge — 助手消息上是否有 skill 标签（取决于后端是否返回 activeSkill）
   - QuickSuggestions — 消息下方是否有快捷建议按钮
   - **不检查 SkillPanel**（即将重建，排除）
7. 截图保存为证据

**Hard cap**:
- 如果 cancel/stop 按钮点击后生成不停止 → D4b 最高 3/5

**如果未认证或认证失败，此维度直接 0 分。**

---

### 5. Code Quality & Maintainability (Weight: 10/100)
**What to evaluate**: 代码整洁度 — CSS 变量使用率、`!important` 数量、inline style 数量、tailwind-merge 使用。

| Score | Description |
|-------|-------------|
| 5 | 样式全部走 design token，零 `!important`（`prefers-reduced-motion` 除外），className 逻辑清晰（tailwind-merge），零重复样式定义，零 inline style（非动态值） |
| 4 | 基本干净，仅 1-2 处可改进 |
| 3 | 偶有 `!important` 或重复定义（< 5 处） |
| 2 | 多处 `!important` 或 inline style（5-10 处） |
| 1 | 大量 inline style、`!important` hack、重复的颜色/spacing 值 |

**Detection method**:
1. `grep -rn '!important' packages/chat-interface/src/` — 统计（排除 `prefers-reduced-motion` 中的合理使用）
2. `grep -rn 'style={{' packages/chat-interface/src/` — 统计 inline style
3. `grep -rn 'tailwind-merge\|twMerge\|cn(' packages/chat-interface/src/` — 检查 className 合并工具使用
4. 检查是否有重复的样式定义（相同的 Tailwind class 组合出现在多处）

---

### 6. Edu-Platform Solution Quality (Bonus: +5)

**What to evaluate**: edu-platform 作为 Solution 层参考实现的视觉质量和分层正确性。**这是加分项**（最多 +5），不影响基础 100 分。

| Score | Description |
|-------|-------------|
| +5 | LoginPage 和 ClassSwitcher 完全符合 edu-platform DESIGN_SYSTEM.md，零 inline style，context chips 正确显示领域数据 |
| +3 | 大部分符合，仅 1-2 处 inline style 或设计偏差 |
| +1 | 有改进但仍有明显问题（多处 inline style、设计不一致） |
| +0 | 未改进或 edu-platform 不可用 |

**Detection method**:
1. 统计 edu-platform inline style: `grep -rn 'style={{' solutions/business/edu-platform/frontend/src/ | wc -l`
2. 截图 LoginPage — 对比 DESIGN_SYSTEM.md（零阴影、0.5px 边框、warm neutral）
3. 截图认证后界面 — 验证 context chips 显示班级/学科/学校
4. 检查 ClassSwitcher 样式是否使用 `ck-` 前缀类

**注意**: 如果 edu-platform dev server 不可用，此维度得 0 分（不扣分）。

---

## Penalty Rules
- 每个硬编码颜色值（`#` 或 `rgb()` 出现在 `.tsx` 文件中，`globals.css` 变量定义除外）: **-0.5 分**
- 每个 `!important`（`prefers-reduced-motion` 中的合理使用除外）: **-1 分**
- 每个 inline `style={{}}` 用于非动态值: **-0.5 分**
- 改动导致 `npm run typecheck` 失败: **本轮直接 0 分，回滚**
- 改动导致 `npm test` 失败: **本轮直接 0 分，回滚**
- 删除现有功能而非改进: **-5 分每处**

## Score Calculation
1. 每个维度: `(score / 5) × weight`
   - 例: Design System Alignment 得 4/5 → (4/5) × 35 = 28 分
   - 例: Functional Verification 得 3/5 → (3/5) × 15 = 9 分
2. 基础分: 六个维度加权分之和 - penalty 扣分（满分 100）
3. 加分: Edu-Platform Solution Quality bonus（最多 +5）
4. 总分: 基础分 + bonus（上限 105，但 target 仍以 85 为准）
5. **报告格式**: 必须在 eval report 最后一行包含 `总分: XX/100`

## Pass/Target Thresholds
- **Minimum pass**: 70/100
- **Target**: 85/100
