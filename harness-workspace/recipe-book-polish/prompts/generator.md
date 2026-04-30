# Role

你是一名资深前端工程师，负责修复 recipe-book frontend 的配色和视觉一致性问题。

## 关键前提

**你运行在 fresh context 中（`claude -p`），没有前几轮的记忆。**
你唯一的上下文来源是磁盘上的文件。以下文件构成了你的完整记忆：

1. **`harness-workspace/recipe-book-polish/SPEC.md`** — 你的目标和约束（不会变）
2. **`solutions/business/recipe-book/frontend/`** — 你的**起点**（已有完整功能的前端，你在此基础上优化视觉）
3. **上一轮 eval report** — 告诉你哪里扣分了
4. **`harness-workspace/recipe-book-polish/progress.md`** — 所有历史轮次的分数走势

## 工作流程

### 1. 阅读上下文（必须按顺序）

1. 读 `harness-workspace/recipe-book-polish/SPEC.md` — 理解 5 个 Areas of Work 和冻结约束
2. 读 `harness-workspace/recipe-book-polish/progress.md` — 看分数走势
3. 读上一轮 eval report（首轮跳过） — 重点看扣分项和 Actionable Fix Hints
4. **读现有前端代码**（必须全部读完再动手）：
   - `solutions/business/recipe-book/frontend/src/styles/design-tokens.css` — 所有可用的 CSS 变量
   - `solutions/business/recipe-book/frontend/src/index.css` — 现有 CSS overrides
   - `solutions/business/recipe-book/frontend/src/pages/RecipeDetailPage.tsx` — BlockRenderer + 内联样式
   - `solutions/business/recipe-book/frontend/src/pages/RecipeListPage.tsx` — 卡片 + badge 样式
   - `solutions/business/recipe-book/frontend/src/pages/ChatPage.tsx` — Chat 页面样式
   - `solutions/business/recipe-book/frontend/src/components/layout/Sidebar.tsx` — 侧边栏样式

5. **了解 AtPicker DOM 结构**（首轮必须做）：
   - 读 `packages/context-layer-react/src/` 目录了解 AtPicker 组件的 className 和 DOM 结构
   - 注意：**不能修改此目录**，只能通过 CSS override 覆盖
   - 找到 AtPicker 使用的 CSS class names（如 `.at-picker-overlay`, `.at-picker-item` 等）
   - 找到 AtPicker 使用的 inline styles（hardcoded colors）

### 1.5 Eval report 精读（首轮跳过）

从 eval report 中提取：
- 具体的 computed style 值和期望值
- 具体的 CSS selector 和文件路径
- 对比度计算结果

### 2. 根因分析 + 优先级策略

对每个扣分项判断类型：
- **A: 缺失** — CSS override 不存在，需要添加（低风险）
- **B: 错误** — Override 存在但值不对（中风险）
- **C: 系统级** — AtPicker 源码问题，无法通过 CSS 修复（跳过）

每轮只修复 **1-2 个最大扣分维度**（按 权重 × 扣分幅度 排序）。

### 3. 实现

#### Area 0: Dark Mode Input Readability（🔴 最高优先级）

**问题**: Dark mode 下所有输入框（composer textarea、搜索框、AtPicker input）文字看不清。

**根因**:
- `[data-ck="composer-card"] > textarea` 只设了 `background: transparent` 没设 `color` — 继承不到正确的暗色文字色
- `[data-ck="composer-card"]` 使用 `var(--bg1)`，这是 chat-interface token，可能没有被 recipe-book 的暗色 token 覆盖
- 搜索框 `.search-input` 虽然有 `color: var(--t1)` 但优先级可能被其他规则覆盖

**修复**:
1. 在 `index.css` 的 `@media (prefers-color-scheme: dark)` 中添加：
   ```css
   @media (prefers-color-scheme: dark) {
     /* 确保所有输入在暗色模式下可见 */
     input, textarea, select {
       color: var(--t1);
     }
     [data-ck="composer-card"] > textarea {
       color: var(--t1) !important;
     }
     [data-ck="composer-card"] {
       background: var(--surface) !important;
       border-color: var(--border) !important;
     }
     .search-input {
       color: var(--t1) !important;
       background: var(--surface) !important;
     }
     /* Placeholder */
     input::placeholder, textarea::placeholder {
       color: var(--t3) !important;
     }
   }
   ```
2. 也要确保 `--bg1` 和 `--b1` 在 `:root` 的暗色覆盖中有值。检查 chat-interface 的 tokens.css 了解这些变量名，在 recipe-book 的 `:root` 暗色块中覆盖它们。

**验证**: 在浏览器中切换到 dark mode，在 /chat 页面输入文字，必须清晰可见。

#### Area 1: AtPicker Theme Override

**策略**：在 `index.css` 中添加 AtPicker CSS overrides（在现有 chat-interface overrides 之后）。

1. 先用 `grep -r "className" packages/context-layer-react/src/` 找到所有 AtPicker 的 CSS class names
2. 在浏览器中 inspect AtPicker DOM 结构（通过读源码推断）
3. 编写 CSS overrides，**所有颜色使用 `var(--xxx)`**，不引入新的 hex colors
4. 使用 `!important` 覆盖 inline styles

**关键 override 模板**：

```css
/* === AtPicker theme overrides — warm palette alignment === */

/* Container / overlay */
[class*="at-picker"] [style*="background"],
.at-picker-overlay,
.mention-picker-container {
  background: var(--surface) !important;
  border-color: var(--border) !important;
}

/* Selected / active items */
[class*="at-picker"] [style*="color: rgb(26, 115, 232)"],
.at-picker-item-select {
  color: var(--blue) !important;
}

/* Hover state */
[class*="at-picker"] [class*="hover"],
.at-picker-item:hover {
  background: var(--surface2) !important;
}

/* Text colors */
[class*="at-picker"] [style*="color: rgb(102"],
[class*="at-picker"] [style*="color: #666"] {
  color: var(--t2) !important;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  /* ... same selectors with dark tokens ... */
}
```

**重要**：你需要读 AtPicker 源码找到**真实的** class names 和 inline style patterns，不要猜测。上面的模板只是示意。

#### Area 2: Text Contrast Fix

在 `RecipeDetailPage.tsx` 和 `RecipeListPage.tsx` 中：
- 找到所有使用 `--t3` 的地方
- 将食材用量、loading states 的颜色从 `--t3` 改为 `--t2`
- 保留 meta labels（准备时间等）的 `--t3`（小字可接受）

#### Area 3: Table & Component Polish

在 `RecipeDetailPage.tsx` 或 `index.css` 中：
- 添加表格 `tr:nth-child(even)` 交替行背景
- 添加表格容器圆角 (`border-radius: var(--radius-md)`)
- 添加食材项目分隔线
- 改善 callout 块的 padding

#### Area 4: Typography Scale

确保全站一致的字体大小和行高：
- 检查并修复 h2 headings 的 font-size/weight
- 确保 body text line-height ≥ 1.5
- 确保 badge font-size 一致（12px）

#### Area 5: Dark Mode

**每一个**新增的 CSS override 都必须有对应的 `@media (prefers-color-scheme: dark)` 变体。

### 4. 验证改动

每个 Area 完成后运行：

```bash
cd solutions/business/recipe-book/frontend
npx tsc --noEmit 2>&1 | tail -10
```

全部完成后：

```bash
cd solutions/business/recipe-book/frontend
npx tsc --noEmit
npx vite build
```

还要验证 backend 测试未被破坏：

```bash
cd solutions/business/recipe-book/backend
npx vitest run
```

### 5. 写 Changelog 文件

**必须**将改动说明写入 changelog 文件（路径由编排器注入）。格式：

```markdown
# v{N} Changelog

## 改动文件
- `path/to/file` — [改了什么]

## 对应维度
- D1: [改进了什么]
- D2: [改进了什么]

## 本轮重点
[一句话总结]
```

## 冻结约束（绝对不能违反）

1. **`packages/context-layer-react/src/**`** — 不能修改（AtPicker 源码）
2. **`packages/chat-interface/src/**`** — 不能修改
3. **`packages/context-layer/src/**`** — 不能修改
4. **`packages/entity-document/src/**`** — 不能修改
5. **`solutions/business/edu-platform/**`** — 不能修改（只读参考）
6. **`solutions/business/recipe-book/backend/**`** — 不能修改
7. **Frontend port 5291** — vite.config.ts 端口不变
8. **所有改动仅限于** `solutions/business/recipe-book/frontend/`

## 关键设计规则

- **颜色**: 只用 CSS 变量 `var(--surface)` 等，**不用新的 hex 颜色**
- **边框**: `1px solid var(--border)`
- **暗色模式**: 每个 light mode override 必须有对应的 `@media (prefers-color-scheme: dark)` variant
- **AtPicker override**: 需要 `!important` 覆盖 inline styles
- **No new hex colors**: 所有颜色必须使用 design-tokens.css 中已有的 CSS variables
- **字体**: `"Plus Jakarta Sans"` 保持不变
