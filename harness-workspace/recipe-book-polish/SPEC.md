# SPEC: Recipe Book Polish — UX/Color Fix

## Objective

修复 recipe-book frontend 的配色和视觉一致性问题。在已完成的前端基础上，通过 CSS overrides 让 AtPicker、表格、文字对比度和暗色模式达到统一的暖色调风格。

### 现状

前端已通过前一个 harness（recipe-book-frontend）验证所有功能可用。但存在以下视觉问题：

1. **🔴 Dark mode 下输入框文字看不清**（最高优先级）— Composer textarea 使用 `background: transparent` 但未显式设置 `color`，搜索框和 AtPicker 输入在暗色背景下文字不可见或对比度极低。`composer-card` 使用的 `var(--bg1)` / `var(--b1)` 是 chat-interface token，在 recipe-book 的暗色上下文中可能未正确覆盖
2. **AtPicker 使用 Google Material blue (`#1a73e8`)** — 与 recipe-book 的暖色调 beige/earth 色板（`--bg: #f4f3ef`, `--surface: #fbfaf7`）形成强烈反差
3. **低对比度文字** — `--t3: #9c9a92` 用于食材用量时在浅色背景上难以阅读
4. **表格样式太简陋** — 只有 `border-collapse` + 细边框，无交替行背景或间距优化
5. **AtPicker 无暗色模式覆盖** — recipe-book 有暗色模式 token，但 AtPicker 的硬编码白色/蓝色无暗色适配
6. **样式方式混杂** — BlockRenderer 中 inline styles + scoped `<style>` + Tailwind classes 混用，导致视觉不一致

**冻结约束**: `packages/context-layer-react/src/` (AtPicker 源码) 不能修改。所有 AtPicker 样式必须通过 recipe-book frontend 中的 CSS overrides 完成。

## Artifact Description

**Primary**: `solutions/business/recipe-book/frontend/` — 只修改此目录下的文件

**修改文件**（预期）:
```
solutions/business/recipe-book/frontend/
  src/index.css                        # 添加 AtPicker CSS overrides + 组件优化
  src/styles/design-tokens.css         # 可能微调 token（如新增 --menu-shadow）
  src/pages/RecipeDetailPage.tsx       # 改善 BlockRenderer 样式（--t3 → --t2）
  src/pages/RecipeListPage.tsx         # 卡片 hover + badge 优化
```

## 6 Areas of Work (按优先级排序)

### Area 0: Dark Mode Input Readability（最高优先级）

**核心问题**: Dark mode 下所有输入框文字看不清。

**根因分析**:
- `[data-ck="composer-card"]` 使用 `background: var(--bg1)` — `--bg1` 是 chat-interface 的 token，recipe-book 的 `:root` 可能没有正确覆盖其暗色值
- `[data-ck="composer-card"] > textarea` 设置了 `background: transparent` 但**没有设置 `color`** — 在暗色模式下，如果 textarea 继承的 color 仍是深色，就会在深色背景上看不见
- 搜索输入 `.search-input` 有 `color: var(--t1)` 但如果 CSS 变量优先级被 chat-interface 的 tokens 覆盖，可能不生效
- AtPicker 的输入框也可能有硬编码的深色文字

**修复策略**:
1. 在 `index.css` 中确保所有 input/textarea 在暗色模式下有正确的 `color`:
   ```css
   @media (prefers-color-scheme: dark) {
     [data-ck="composer-card"] > textarea {
       color: var(--t1) !important;  /* e8e6dc in dark mode */
     }
     .search-input {
       color: var(--t1) !important;
       background: var(--surface) !important;
     }
     input, textarea, select {
       color: var(--t1);
     }
   }
   ```
2. 确保 `--bg1` 和 `--b1`（chat-interface tokens）在暗色模式下被 recipe-book 正确覆盖
3. 验证 placeholder 文字在暗色模式下也可见（使用 `::placeholder { color: var(--t3) }`)

### Area 1: AtPicker Theme Override

Create CSS overrides in `index.css` targeting AtPicker's inline styles via `[class*="at-picker"]` selectors or the AtPicker container element. Replace:

- `#1a73e8` → `var(--t1)` or `var(--blue)` (warm blue `#1a5fa0`)
- `#f0f7ff`, `#e8f0fe` → `var(--surface)` / `var(--surface2)`
- `#f5f5f5` hover → `var(--surface2)`
- `white` background → `var(--surface)`
- `#e0e0e0` border → `var(--border)`
- `#666`, `#888`, `#999` grays → `var(--t2)` / `var(--t3)`
- Dark mode overrides for all above

**Strategy**: AtPicker uses inline styles extensively, so CSS overrides need `!important`. Target `.at-picker-*` classes and container elements. Add overrides in `index.css` after the existing chat-interface overrides.

### Area 2: Text Contrast Fix

Upgrade `--t3` usages where readability matters:

- Ingredient amounts: `--t3` → `--t2` (contrast ratio: 2.9:1 → 5.2:1)
- Meta labels (准备时间, etc.): keep `--t3` (small caps, acceptable)
- Loading/empty states: `--t3` → `--t2`

**WCAG AA compliance**: 4.5:1 minimum for normal text.
- `--t3` (#9c9a92) on `--surface` (#fbfaf7) = ~2.9:1 (FAIL)
- `--t2` (#5c5b56) on `--surface` (#fbfaf7) = ~5.2:1 (PASS)

### Area 3: Table & Component Polish

- Tables: alternating row backgrounds (`var(--surface2)` on even rows), better padding, rounded container
- Ingredient list: subtle separator between items, better alignment
- Callout blocks: refined padding (≥ 12px), icon support
- Cards (meta-grid): consistent shadow/border treatment

### Area 4: Typography Scale

Establish consistent scale:
- H1: 24px/700 (already fine)
- H2 section headings: 17px/600
- Body text: 14px
- Small text (badges, meta): 12px
- Micro text (loading): 13px
- Line-height: 1.5 for body, 1.3 for headings

### Area 5: Dark Mode Completeness

All new CSS overrides must include `@media (prefers-color-scheme: dark)` variants using the existing dark mode tokens from `design-tokens.css`.

## Frozen Constraints

| ID | Constraint | Files |
|----|-----------|-------|
| FC-1 | context-layer-react 源码不能修改 | `packages/context-layer-react/src/**` |
| FC-2 | chat-interface 源码不能修改 | `packages/chat-interface/src/**` |
| FC-3 | context-layer 核心不能修改 | `packages/context-layer/src/**` |
| FC-4 | entity-document 不能修改 | `packages/entity-document/src/**` |
| FC-5 | edu-platform 不能修改 | `solutions/business/edu-platform/**` |
| FC-6 | recipe-book backend 不能修改 | `solutions/business/recipe-book/backend/**` |
| FC-7 | 所有改动仅限于 frontend 目录 | `solutions/business/recipe-book/frontend/**` |
| FC-8 | Frontend port 5291 不变 | vite.config.ts 端口不变 |

## Key Reference Files

| File | Purpose |
|------|---------|
| `solutions/business/recipe-book/frontend/src/styles/design-tokens.css` | 设计 token 定义（颜色、圆角、间距） |
| `solutions/business/recipe-book/frontend/src/index.css` | 全局 CSS overrides（已有 chat-interface overrides） |
| `solutions/business/recipe-book/frontend/src/pages/RecipeDetailPage.tsx` | 食谱详情页（BlockRenderer、表格、食材列表） |
| `solutions/business/recipe-book/frontend/src/pages/RecipeListPage.tsx` | 食谱列表页（卡片、搜索、badge） |
| `solutions/business/edu-platform/frontend/src/index.css` | CSS override 参考模板 |

## Exit Conditions

- **Target**: ≥90/100
- **Pass**: ≥75/100
- **Max iterations**: 6
- **Diminishing returns**: <3 point improvement for 2 consecutive iterations
