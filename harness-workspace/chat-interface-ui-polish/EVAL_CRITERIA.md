# Evaluation Criteria

> 你是一个独立的 design QA reviewer。你没有参与代码编写过程。
> 按照以下标准严格评分。如果某些东西对你作为新读者来说不清楚，那它就是个问题。

## Scoring Dimensions

### 1. Claude Web Visual Alignment (Weight: 30/100)
**What to evaluate**: 整体视觉效果与 Claude Web 参考截图的一致程度。重点检查 spacing、颜色、字体、圆角、阴影是否匹配 `design-system.md` 的规范。

| Score | Description |
|-------|-------------|
| 5 | 截图对比与 Claude Web 参考几乎无法区分。spacing、颜色、字体、圆角、阴影完全对齐设计系统文档 |
| 4 | 整体观感一致，仅有 1-2 处细微偏差（如某个阴影值或边距差 2px） |
| 3 | 大方向对了（配色方案、布局结构），但细节有 5+ 处明显偏差（间距差 4px+、颜色值不匹配） |
| 2 | 能看出参考了 Claude Web，但多处明显不协调 |
| 1 | 看起来像"参考了 Claude 但明显是另一个产品"，整体观感差距大 |

**Detection method**:
1. 对照 `packages/chat-interface/reference/` 中的截图进行视觉比对
2. 检查 `design-system.md` 中的 checklist 各项是否满足
3. 浏览器截图（desktop 1440×900 + mobile 375×812）与参考对比
4. 逐项检查: warm neutrals、serif/sans 双字体、用户消息右对齐、composer 浮卡阴影、terracotta 强调色

---

### 2. Cross-Component Consistency (Weight: 25/100)
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

### 3. Responsive & Mobile (Weight: 20/100)
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

### 4. Interaction Polish (Weight: 15/100)
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

## Penalty Rules
- 每个硬编码颜色值（`#` 或 `rgb()` 出现在 `.tsx` 文件中，`globals.css` 变量定义除外）: **-0.5 分**
- 每个 `!important`（`prefers-reduced-motion` 中的合理使用除外）: **-1 分**
- 每个 inline `style={{}}` 用于非动态值: **-0.5 分**
- 改动导致 `npm run typecheck` 失败: **本轮直接 0 分，回滚**
- 改动导致 `npm test` 失败: **本轮直接 0 分，回滚**
- 删除现有功能而非改进: **-5 分每处**

## Score Calculation
1. 每个维度: `(score / 5) × weight`
   - 例: Claude Web Alignment 得 4/5 → (4/5) × 30 = 24 分
2. 总分: 五个维度加权分之和 - penalty 扣分
3. **报告格式**: 必须在 eval report 最后一行包含 `总分: XX/100`

## Pass/Target Thresholds
- **Minimum pass**: 70/100
- **Target**: 85/100
