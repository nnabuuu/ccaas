# Evaluation Criteria — Quiz Analyzer Style Consistency

> 你是一个独立的 design QA reviewer。你没有参与代码编写过程。
> 按照以下标准严格评分。如果某些东西对你作为新读者来说不清楚，那它就是个问题。

## Pre-Scoring Gate (MANDATORY)

在打分前，Evaluator **必须**完成以下验证步骤：

1. 确认 `npx tsc --noEmit` 通过（在 `frontend/` 目录下）
2. 确认 dev server 能正常启动

**如果 TypeScript 编译失败**：本轮直接 **0 分**，不做进一步评估。

## Scoring Dimensions (5 维度, 100 分)

### D1. Design Token Alignment (Weight: 30/100)
**What to evaluate**: CSS 变量和 Tailwind 配置是否与 chat-interface 的设计 token 体系对齐。

**评估标准**：
- `tailwind.config.js` 是否定义了 `ck` 色彩命名空间
- `index.css` 是否引入了完整的 CSS 变量定义（light + dark mode）
- 字体栈是否改为 `system-ui` 系统字体（移除 Satoshi）
- 圆角是否使用 `rounded-ck` (8px) / `rounded-ck-lg` (12px)
- 阴影是否使用 `composer-shadow` 系列（极淡）
- 边框是否使用 `var(--b1)` / `var(--b2)` 半透明值
- 过渡是否使用 `ease-claude` easing

| Score | Description |
|-------|-------------|
| 5 | tailwind.config 完全对齐 chat-interface，CSS 变量定义完整（light+dark），所有 token 命名一致 |
| 4 | 大部分 token 对齐，仅缺 1-2 个次要 token（如 animation keyframes） |
| 3 | 主要 token（颜色、圆角、阴影）已对齐，但字体或过渡等未完全迁移 |
| 2 | 部分 token 对齐但仍有大量原始配置残留 |
| 1 | tailwind.config 基本未修改，CSS 变量未引入 |

**Detection method**:
```bash
# 检查 tailwind.config 是否有 ck 命名空间
grep -c "ck:" frontend/tailwind.config.js
# 检查 CSS 变量定义
grep -c "var(--" frontend/src/index.css
# 检查 Satoshi 字体是否已移除
grep -i "satoshi" frontend/tailwind.config.js frontend/src/index.css
# 检查 ease-claude easing
grep "ease-claude\|cubic-bezier(0.4, 0, 0.2, 1)" frontend/tailwind.config.js
```

---

### D2. Visual Consistency (Weight: 25/100)
**What to evaluate**: 浏览器实际渲染效果是否与 chat-interface 的视觉语言一致。

**评估标准**（通过截图对比）：
- 背景色：暖灰调（`#F5F5F0` 系）而非冷灰调（`slate`/`zinc`）
- 字体：系统字体渲染，非 Satoshi
- 圆角：克制的 8px/12px，而非 bento 风格的 1.5rem+
- 阴影：极淡（几乎看不见），而非 `shadow-soft`/`shadow-glass`
- 边框：半透明 `rgba(0,0,0,0.08)` 而非 `border-slate-200` 实色
- 强调色：暖棕 accent 而非蓝色
- 整体色温：暖色调而非冷色调

| Score | Description |
|-------|-------------|
| 5 | 与 chat-interface 视觉语言完全一致 — 暖灰背景、系统字体、克制圆角/阴影、半透明边框 |
| 4 | 整体色调正确（暖色），仅 1-2 处细微差异（某个阴影过深或边框过重） |
| 3 | 色调基本正确但明显可感知差异 — 如部分卡片仍有 bento 风格圆角或蓝色残留 |
| 2 | 部分迁移但视觉上一眼能看出不同产品风格 |
| 1 | 基本仍是原始风格（蓝色主调、Satoshi 字体、bento 卡片） |

**Detection method**:
1. 启动 dev server，截图 desktop (1440×900) + mobile (375×812)
2. 与 chat-interface 页面截图并排对比色温、字体、圆角、阴影
3. 检查 header/footer 色调是否从冷灰变为暖灰
4. 检查卡片圆角是否从 `rounded-3xl` 变为 `rounded-ck-lg`

---

### D3. Component Polish (Weight: 20/100)
**What to evaluate**: 各具体组件是否正确遵循 ck 设计语言。

**评估标准**（按组件逐项检查）：
- **Header**: 背景 `var(--bg1)`，文字 `var(--t1)`，边框 `var(--b2)`
- **按钮（分析/新对话/快捷操作）**: `rounded-lg`，accent 色背景，`active:scale-[0.98]`
- **输入框**: `rounded-ck`，边框 `var(--b1)`，`focus:shadow-composer-focus`
- **卡片容器**: `rounded-ck-lg`，`shadow-composer` 极淡阴影，边框 `var(--b2)`
- **ViewModeToggle**: ck 风格 toggle，非蓝色
- **ConnectionStatus**: 状态色可保留语义，但容器样式对齐 ck
- **SkeletonLoader**: 动画使用 `ck-shimmer`
- **GeometryFigure**: 容器外框对齐 ck（内部图形不变）

| Score | Description |
|-------|-------------|
| 5 | 所有组件完全遵循 ck 设计语言 — 圆角、阴影、边框、按钮、输入框无一例外 |
| 4 | 核心组件（header、按钮、卡片）完全对齐，1-2 个边缘组件有细微偏差 |
| 3 | 主要组件对齐但部分组件（如 SkeletonLoader、GeometryFigure）未迁移 |
| 2 | 仅 header 和按钮做了迁移，卡片和其他组件仍是旧风格 |
| 1 | 大部分组件未迁移 |

**Detection method**:
1. 逐组件截图审查
2. 代码 grep 检查各组件的 Tailwind 类：
   ```bash
   grep -n "rounded-3xl\|rounded-xl\|shadow-soft\|shadow-glass\|border-slate\|border-zinc\|bg-slate\|bg-zinc\|text-primary-\|text-zinc-\|bg-primary-\|bg-cta-" frontend/src/components/*.tsx frontend/src/App.tsx
   ```
3. 检查按钮是否有 `active:scale-[0.98]` 和 `ease-claude`

---

### D4. Responsive & Interaction (Weight: 10/100)
**What to evaluate**: 桌面/移动端布局可用性，hover/focus/active 状态，过渡动画质量。

| Score | Description |
|-------|-------------|
| 5 | 桌面/移动端布局均可用，所有交互元素有 hover/focus/active 反馈，过渡动画使用 `ease-claude` |
| 4 | 布局可用，交互反馈基本完整，仅 1-2 处缺失 |
| 3 | 布局基本可用但交互反馈不全（缺少 focus ring 或 active scale） |
| 2 | 桌面可用但移动端有问题，或交互反馈严重不足 |
| 1 | 布局或交互有明显可用性问题 |

**Detection method**:
1. 截图 desktop (1440×900) + mobile (375×812)
2. 检查可交互元素的 hover/focus/active 状态
3. ```bash
   grep -c "hover:\|focus:\|active:" frontend/src/components/*.tsx frontend/src/App.tsx
   grep -c "ease-claude\|transition" frontend/src/components/*.tsx frontend/src/App.tsx
   ```

---

### D5. Code Quality (Weight: 15/100)
**What to evaluate**: 代码整洁度 — 硬编码颜色、!important、typecheck、残留旧样式。

| Score | Description |
|-------|-------------|
| 5 | 零硬编码 hex（badge 语义色除外），零 `!important`，typecheck 通过，无旧样式残留（`slate-`, `zinc-`, `primary-`, `cta-` Tailwind 色彩类全部清除） |
| 4 | 1-3 处非语义硬编码颜色，零 `!important`，typecheck 通过 |
| 3 | 4-8 处硬编码颜色或 1-2 处 `!important`，typecheck 通过 |
| 2 | 较多硬编码颜色（8+）或多处 `!important` |
| 1 | 大量硬编码颜色、`!important`、或 typecheck 失败 |

**Detection method**:
```bash
# 硬编码颜色（排除 CSS 变量定义文件和知识点 badge 语义色）
grep -rn '#[0-9a-fA-F]\{3,8\}' frontend/src/components/ frontend/src/App.tsx | grep -v 'badge\|question\|solution\|both' | wc -l
# !important
grep -rn '!important' frontend/src/ | grep -v 'prefers-reduced-motion' | wc -l
# 旧样式残留
grep -rn 'border-slate\|border-zinc\|bg-slate\|bg-zinc\|text-primary-\|bg-primary-\|bg-cta-\|text-cta-\|text-zinc-\|text-slate-' frontend/src/components/ frontend/src/App.tsx | wc -l
# TypeScript 编译
cd frontend && npx tsc --noEmit
```

---

## Penalty Rules

| Rule | Deduction |
|------|-----------|
| 硬编码颜色（`#hex` 或 `rgb()` 在 `.tsx` 中，badge 语义色除外） | -0.5/个 |
| `!important` 使用（`prefers-reduced-motion` 除外） | -1/个 |
| TypeScript 编译失败 | 本轮直接 0 分 + 回滚 |
| 功能性回归（消息发送、分析流程中断） | -5/个 |
| 旧 Tailwind 色彩类残留（`slate-`, `zinc-`, `primary-`, `cta-` 前缀） | -0.3/个 |

## Score Calculation

1. 每个维度: `(score / 5) × weight`
2. 基础分: 5 个维度加权分之和 - penalty 扣分（满分 100）
3. **报告格式**: 必须在 eval report 最后一行包含 `总分: XX/100`

## Pass/Target Thresholds
- **Minimum pass**: 70/100
- **Target**: 85/100
