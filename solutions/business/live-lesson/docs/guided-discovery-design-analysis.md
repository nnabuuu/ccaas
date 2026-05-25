# 引导探究（Guided Discovery）设计稿分析

**设计源文件：** `design/Guided Discovery 平方差公式.html` + `design/guided-discovery-app.jsx`

本文档对设计稿的每个页面元素和交互方案进行逐一拆解，并对比当前实现的差距。

---

## 1. 页面整体布局

### 设计稿结构

```
┌─────────────────────────────────────────────────┐
│ Topbar: 标题 + 班级 | 阶段 badge + 计时器        │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │ section-label-row: "引导探究 · 平方差公式"  │    │
│  │                                          │    │
│  │ ┌ step-progress (sticky) ──────────────┐ │    │
│  │ │ ①观察规律 ── ②符号表示 ── ③验证公式 ── ④文字描述│ │    │
│  │ └──────────────────────────────────────┘ │    │
│  │                                          │    │
│  │ ┌ q-card (Step 1) ────────────────────┐ │    │
│  │ │ ...                                 │ │    │
│  │ └────────────────────────────────────┘ │    │
│  │                                          │    │
│  │ ┌ q-card (Step 2) ────────────────────┐ │    │
│  │ │ ...                                 │ │    │
│  │ └────────────────────────────────────┘ │    │
│  │                                          │    │
│  │ ... (step 3, 4 逐步展开)                  │    │
│  │                                          │    │
│  │ ┌ summary-card ───────────────────────┐ │    │
│  │ │ 公式总结                              │ │    │
│  │ └────────────────────────────────────┘ │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
└──────────────────────────────────────────────────┘
```

- **最大宽度**：`max-width: 720px`，居中
- **内边距**：`padding: 24px 32px 80px`
- **滚动**：`task-scroll` 为 `overflow-y: auto` 容器

### 当前实现对比

| 元素 | 设计 | 当前实现 | 差距 |
|------|------|---------|------|
| Topbar | 设计独立 topbar | 由外层 `StudentShell` 提供 | ✅ 无差距（GD 组件不负责） |
| section-label-row | "引导探究 · 平方差公式" 10px 大写标签 | 由外层提供，GD 组件只接收 `title` prop | ✅ 无差距 |
| **step-progress** | **sticky 进度条** | **❌ 不存在** | **🔴 缺失** |
| q-card | 圆角卡片 12px | 当前用 10px border-radius 卡片 | ⚠️ 微小差异 |
| summary-card | teal 背景总结卡 | ✅ 已实现 | ✅ 基本一致 |

---

## 2. Step Progress 进度条（🔴 缺失）

### 设计稿规格

```
.step-progress
├── .step-item × N
│   ├── .step-dot (26px 圆形)
│   │   - 未到达: 灰色边框 + 数字
│   │   - 当前 (.active): teal 边框 + teal 背景 + 数字
│   │   - 已完成 (.done): green 实心 + ✓
│   └── .step-label (10px)
│       - 未到达: 灰色
│       - 当前 (.active): teal 加粗
│       - 已完成 (.done): green
└── .step-connector × (N-1) — 两点之间的连接线
    - 未到达: 灰色 2px
    - 已通过 (.filled): green 2px
```

### 交互方案

1. **初始**：第 1 步 active，后续灰色
2. **完成并前进**：当前步变 done(绿色✓)，下一步变 active(teal)
3. **Sticky 定位**：`position: sticky; top: 0; z-index: 10`，滚动时固定在顶部
4. **背景**：`background: var(--bg)` + `padding: 12px 0 16px` 防止内容透过

### CSS 类

```css
.step-progress { display: flex; align-items: center; sticky top:0 z:10 }
.step-item     { flex-direction: column; align-items: center }
.step-dot      { 26px circle, border: 2px solid var(--border) }
.step-dot.active { bg: teal-bg, border: teal, color: teal }
.step-dot.done   { bg: green, border: green, color: white }
.step-label       { 10px, color: t3 }
.step-label.active { teal, font-weight: 600 }
.step-label.done   { green }
.step-connector       { flex:1, h:2px, bg: border, top: -9px }
.step-connector.filled { bg: green }
```

### 当前实现状态

**完全缺失。** `GuidedDiscoveryExercise` 没有任何进度条渲染逻辑。设计中进度条的 `step` 状态对应实现中的 `currentStepIdx` prop，labels 来自 `steps[].title`。

---

## 3. Question Card (q-card)

### 设计稿规格

```
.q-card
├── .q-header
│   ├── .q-num (22px teal 圆角正方形 + 白色数字)
│   └── .q-title (14px 加粗)
└── .q-body (13px, line-height 1.7)
    └── (step-type-specific content)
```

### 状态

| 状态 | 样式 |
|------|------|
| 当前步 | 正常可交互 |
| 已完成 | 正常但 locked（如果包含选择题则选项 disabled） |
| 未到达 | `.q-card.locked` → `opacity: .4; pointer-events: none` |

### 动画

- 新卡片入场：`@keyframes cardIn { from { opacity:0; translateY(10px) } to { opacity:1; translateY(0) } }`

### 当前实现对比

| 元素 | 设计 | 实现 | 差距 |
|------|------|------|------|
| 卡片容器 | `.q-card` 12px border-radius, 20px 24px padding | 10px border-radius, 12px 16px padding | ⚠️ 微小 |
| 序号 | `.q-num` 22px teal 圆角方块 | 22px borderRadius:6 — ✅ 一致 | ✅ |
| 标题 | `.q-title` 14px, 直接渲染 KaTeX | 14px, 之前不渲染 math → **已修复** | ✅ 已修复 |
| 卡片入场动画 | cardIn 0.35s | gdCardIn 0.35s | ✅ 一致 |
| 未到达卡片 | `.locked` opacity:0.4 | 不渲染（progressive reveal） | ✅ 无差距（不同方案都可以） |
| 完成状态 | 正常显示 | green border + green bg | ⚠️ 设计无 green 高亮边框 |

---

## 4. Step 1: 观察规律 (observation_choice)

### 设计稿元素

#### 4a. 观察表格 (.obs-table)

```
┌───────────────┬──────────┐
│ 乘法算式       │ 结果      │
├───────────────┼──────────┤
│ (x+2)(x-2)    │ x²-4     │ ← 红色高亮相同项，蓝色高亮相反项
│ (3+y)(3-y)    │ 9-y²     │
│ (2a+b)(2a-b)  │ 4a²-b²   │
└───────────────┴──────────┘
```

- 表头：`var(--surface2)` 背景，11px 大写
- 内容：KaTeX 渲染，1.1em 字号
- 颜色标注：`.hl-same` (红底红字) 和 `.hl-opp` (蓝底蓝字)

#### 4b. 行内选择题 (InlineChoice)

**这是设计中的核心交互：**

```
标红的项：x 和 x、3 和 3、2a 和 2a，这些完全相同的项我们称为 [相同项|相反项] ← 行内按钮
```

- **未答状态**：teal 边框按钮 + 呼吸动画 + "选一个" tag
- **选对**：green 边框/背景，锁定（不可再改）
- **选错**：red 边框/背景，opacity:0.5，不锁定（可重选）
- **已锁定（别的选项）**：`pointer-events: none; border: border; color: t3`

#### 4c. 反馈 + 继续按钮

- 全部正确后：green 反馈卡 `.ai-fb.fb-correct`
- "继续下一问 →" 全宽 teal 按钮 `.next-step-btn`

### 当前实现对比

| 元素 | 设计 | 实现 | 差距 |
|------|------|------|------|
| 表格 | `.obs-table` | 自定义 table + `<RenderMath>` | ✅ 基本一致 |
| 颜色标注 | `.hl-same`/`.hl-opp` | 无 — 由 manifest 数据决定 | ⚠️ manifest 层面问题 |
| 行内选择 | `InlineChoice` 组件 | `ChoiceButtons` + template 渲染 | ✅ 功能一致 |
| 呼吸动画 | `@keyframes btnBreathe` | ✅ 已实现 | ✅ |
| 全部正确反馈 | green 卡 | ✅ 已实现 | ✅ |
| 继续按钮 | `.next-step-btn` | ✅ 已实现 | ✅ |

---

## 5. Step 2: 符号表示 (formula_blanks)

### 设计稿元素

标题使用 KaTeX：`你能将发现的规律用符号 $a, b$ 表示出来吗？`

#### 5a. 布局

```
请填写等式的两边：

  [MathInput: 等号左边]  =  [MathInput: 等号右边]
```

- 居中排列，`gap: 16px`，flex-wrap
- 中间 "=" 号：24px 字号，灰色

#### 5b. MathInput 组件 ← 核心新组件

**折叠状态（默认）：**
```
┌─ ─ ─ ─ ─ ─ ─ ─ ─┐
│   点击作答          │  ← .math-input-collapsed
└─ ─ ─ ─ ─ ─ ─ ─ ─┘
```
- `min-width: 100px; min-height: 34px`
- teal 虚线边框（空）/ 实线边框（有内容）
- hover → teal 背景
- 有内容时显示文字预览或缩略图 + hover 显示 "点击修改"

**展开状态：**
```
┌─────────────────────────────────┐
│ [键盘] [手写] [拍照]     [▲ 收起] │ ← .math-input-tabs
├─────────────────────────────────┤
│                                  │
│  ┌─────────────────────────┐    │
│  │ (a+b)(a-b)              │    │ ← .math-input-field
│  └─────────────────────────┘    │
│  提示：² 可输入 ^2，× 可用 *     │ ← .math-input-kb-hint
│                                  │
│                    [✓ 确认输入]   │ ← .math-input-confirm
└─────────────────────────────────┘
```

**Tab 切换：**

| Tab | 内容 |
|-----|------|
| 键盘 | text input + 输入提示 |
| 手写 | 复用 Practice v3 的 `hw-*` 画布（toolbar + canvas） |
| 拍照 | 拍照上传区（支持拖拽，有预览和"重新选择"） |

**确认按钮 (.math-input-confirm)：**
- teal 背景白字，`padding: 8px 20px`
- 仅在有内容时显示
- 点击后：折叠面板，显示文字预览或缩略图

**状态样式（应用在 collapsed 上）：**

| 状态 | 边框 | 背景 | 文字色 |
|------|------|------|-------|
| 正确 `.correct` | green solid | green-bg | green |
| 错误 `.wrong` | red solid | red-bg | red |

#### 5c. 提交 + 反馈

- "确认" 按钮（step-level，不是 MathInput 内的确认）
- 正确/错误反馈卡
- 错误时显示 "修改答案" 按钮

### 当前实现对比

| 元素 | 设计 | 当前实现 | 差距 |
|------|------|---------|------|
| MathInput 折叠态 | 虚线框 "点击作答" | ✅ 已实现 | ✅ |
| MathInput 展开态 | 三 tab + 收起 | ✅ 已实现 | ✅ |
| 键盘输入提示 | "提示：² 可输入 ^2" | ✅ 已实现 | ✅ |
| 手写 tab | 复用 hw-* 画布 | ✅ HandwritingCanvas | ✅ |
| 拍照 tab | 上传 + 预览 | ✅ 已实现 | ✅ |
| 确认按钮 | "确认输入" teal | ✅ 已实现 | ✅ |
| 标题 KaTeX | `<K tex="a, b" />` | ✅ `<RenderMath>` 已修复 | ✅ |
| `status` prop | correct/wrong 边框色 | prop 已定义，consumers 未传递 | ⚠️ 后续接入 |

---

## 6. Step 3: 验证公式 (derivation_blank)

### 设计稿元素

```
(a+b)(a-b)
= a² - ab + ab - b²
= [MathInput: 补充结果]
```

- 背景：`var(--surface2)` 圆角 8px，padding 14px 18px
- 每行前有灰色 "=" 号
- 最后一行嵌入 MathInput（行内）

### 当前实现对比

| 元素 | 设计 | 实现 | 差距 |
|------|------|------|------|
| 推导行布局 | surface2 背景块 | flex column, 无背景 | ⚠️ 缺背景块样式 |
| MathInput 行内 | MathInput 嵌入行末 | ✅ GdInputField 嵌入 | ✅ |
| 行首 "=" | 灰色前缀 | 由 `line.text` 数据决定 | ✅ manifest 层面 |

---

## 7. Step 4: 文字描述 (text_blanks)

### 设计稿元素

```
两个数的 [___] 与这两个数的 [___] 的乘积等于这两个数的 **平方差**。
```

- 背景：`var(--surface2)` 圆角 8px
- 行内 blank：下划线样式 `.blank-input`（不是 MathInput，只是简单输入框）
- `font-size: 14px; font-weight: 500`

### 当前实现对比

| 元素 | 设计 | 实现 | 差距 |
|------|------|------|------|
| 模板渲染 | 文字 + `{{blankId}}` 占位 | ✅ TextBlanksStep 实现 | ✅ |
| 输入框样式 | `.blank-input` 下划线 | border 框样式 | ⚠️ 微小差异 |
| 背景块 | surface2 | 无 | ⚠️ 缺背景 |

---

## 8. Summary Card

### 设计稿元素

```
┌──────────────────────────────────┐
│          公式总结                  │  ← .summary-label (10px teal 大写)
│                                   │
│    (a+b)(a-b) = a² - b²          │  ← KaTeX display mode, 1.3em
│                                   │
│        平方差公式                  │  ← .summary-title (16px bold teal)
│                                   │
│  两个数的和与...的平方差。          │  ← 13px teal
└──────────────────────────────────┘
```

- 背景：`var(--teal-bg)`
- 边框：`1px solid rgba(13,82,69,.15)`
- 居中文字
- 条件渲染：所有步完成后才显示

### 当前实现对比

✅ 基本一致。已实现 `summary` 区域。

---

## 9. 交互流程

### 设计稿交互流程

```
1. 页面加载
   ├── 显示 section label
   ├── 显示 step-progress（step 1 active）
   └── 显示 Q1 card

2. 学生完成 Q1（所有 InlineChoice 选对）
   ├── 显示 green 反馈卡
   ├── 显示 "继续下一问 →" 按钮
   └── step-progress: step 1 → done

3. 点击 "继续下一问 →"
   ├── step-progress: step 2 → active
   ├── Q2 card 入场动画（cardIn）
   └── 页面滚动到 Q2

4. 学生填写 Q2 MathInput
   ├── 点击空白框 → 展开 MathInput 面板
   ├── 输入内容 → 点击 "确认输入" → 折叠
   ├── 点击 step-level "确认" 按钮
   └── 服务器返回对/错

5. 重复步骤 3-4 直到 Q4 完成

6. 所有步完成
   └── 显示 summary-card
```

### 关键交互差距

| 交互 | 设计 | 实现 | 差距 |
|------|------|------|------|
| **step-progress** | sticky 进度条跟随 | **❌ 无** | **🔴 缺失** |
| progressive reveal | 逐步展示新卡片 | ✅ currentStepIdx 控制 | ✅ |
| 卡片入场滚动 | smooth scroll 到底 | ⚠️ 靠外层 | ⚠️ |
| MathInput 折叠/展开 | 完整实现 | ✅ 已实现 | ✅ |
| 行内选择互斥 | 选对锁定，选错可重选 | ✅ 已实现 | ✅ |

---

## 10. 完整差距汇总

### 🔴 缺失（需新增）

| # | 元素 | 说明 | 工作量 |
|---|------|------|--------|
| 1 | **step-progress 进度条** | sticky 进度指示器（圆点 + 连接线 + 标签） | 中 |

### ⚠️ 差异（可改进）

| # | 元素 | 设计 | 现状 | 工作量 |
|---|------|------|------|--------|
| 2 | 完成卡片样式 | 无绿色高亮 | green border + bg | 小（可能是设计意图差异） |
| 3 | 推导步骤背景 | surface2 背景块包裹 | 无背景 | 小 |
| 4 | text_blanks 背景 | surface2 背景块 | 无背景 | 小 |
| 5 | q-card padding/radius | 20px 24px / 12px | 12px 16px / 10px | 小 |
| 6 | status prop 接入 | correct/wrong 输入框 | prop 定义了但未传递 | 小 |
| 7 | text_blanks 输入框 | 下划线样式 | border 框样式 | 小 |

### ✅ 已实现

- MathInput 折叠/展开 + 三 tab + 确认输入 + 键盘提示
- step.title KaTeX 渲染
- 行内选择题 + 呼吸动画 + 对/错反馈
- 表格 + KaTeX
- progressive reveal + 卡片入场动画
- summary card
- step-level 提交 + 反馈条
- 继续下一问按钮

---

## 11. 附录：设计稿 CSS 类速查

| CSS 类 | 用途 | 当前有无 |
|--------|------|---------|
| `.step-progress` | 进度条容器 | ❌ |
| `.step-item` | 单个进度点+标签 | ❌ |
| `.step-dot` / `.active` / `.done` | 进度圆点状态 | ❌ |
| `.step-label` | 进度文字 | ❌ |
| `.step-connector` / `.filled` | 连接线 | ❌ |
| `.q-card` | 问题卡片 | ⚠️ 用 inline style |
| `.q-header` / `.q-num` / `.q-title` | 卡片头部 | ⚠️ 用 inline style |
| `.obs-table` | 观察表格 | ⚠️ 用 inline style |
| `.hl-same` / `.hl-opp` | 颜色标注 | ❌ (manifest 层面) |
| `.inline-choice` | 行内选择按钮 | ⚠️ 用 inline style 实现 |
| `.blank-input` | 文字填空输入框 | ⚠️ 用 inline style |
| `.ai-fb` / `.fb-correct` / `.fb-wrong` | AI 反馈卡 | ⚠️ 用 inline style |
| `.summary-card` | 总结卡 | ⚠️ 用 inline style |
| `.math-input-*` | MathInput 全系列 | ✅ 已添加 |
| `.next-step-btn` | 继续按钮 | ⚠️ 用 inline style |
