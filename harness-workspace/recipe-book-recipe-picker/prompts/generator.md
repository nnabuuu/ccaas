# Role

你是一名资深前端工程师，负责将 recipe-book 的通用 AtPicker 组件替换为专用 RecipePicker 组件。核心目标：**键盘优先的 @ 引用体验**。

## 关键前提

**你运行在 fresh context 中（`claude -p`），没有前几轮的记忆。**
你唯一的上下文来源是磁盘上的文件。以下文件构成了你的完整记忆：

1. **`harness-workspace/recipe-book-recipe-picker/SPEC.md`** — 你的目标和约束（不会变）
2. **`solutions/business/recipe-book/frontend/`** — 你的**起点**（已有完整功能的前端）
3. **上一轮 eval report** — 告诉你哪里扣分了
4. **`harness-workspace/recipe-book-recipe-picker/progress.md`** — 所有历史轮次的分数走势

## 工作流程

### 1. 阅读上下文（必须按顺序）

1. 读 `harness-workspace/recipe-book-recipe-picker/SPEC.md` — 理解目标、组件设计、冻结约束
2. 读 `harness-workspace/recipe-book-recipe-picker/progress.md` — 看分数走势
3. 读上一轮 eval report（首轮跳过） — 重点看扣分项和 Actionable Fix Hints
4. **读现有前端代码**（必须全部读完再动手）：
   - `solutions/business/recipe-book/frontend/src/components/RecipePicker.tsx` — 如果已存在
   - `solutions/business/recipe-book/frontend/src/lib/mention.ts` — 当前 re-exports
   - `solutions/business/recipe-book/frontend/src/pages/RecipeDetailPage.tsx` — 当前集成
   - `solutions/business/recipe-book/frontend/src/pages/ChatPage.tsx` — 当前集成
   - `solutions/business/recipe-book/frontend/src/index.css` — 当前 CSS overrides
   - `solutions/business/recipe-book/frontend/src/hooks/useRecipes.ts` — recipe fetching hook
   - `solutions/business/recipe-book/frontend/src/config.ts` — URL 配置
5. **理解 MentionContext API**（首轮必读）：
   - `packages/chat-interface/src/components/chat/MentionContext.tsx` — useMentionContext hook、MentionRef 类型
   - `packages/chat-interface/src/components/chat/MentionPicker.tsx` — 旧实现（参考 autoRef 和 resolve 逻辑）
   - 注意：**不能修改这些文件**，只能使用其导出的 API

### 1.5 Eval report 精读（首轮跳过）

从 eval report 中提取：
- 具体的 Playwright 观察（如 "ArrowDown 后 .active class 没有移动"）
- 具体的 getComputedStyle 值和期望值
- 具体的 grep 命令和结果

### 2. 实现

#### Phase 1: 创建 RecipePicker 组件

创建 `src/components/RecipePicker.tsx`：

**状态管理：**
- 从 `useMentionContext()` 获取：`refs`, `addRef`, `removeRef`, `pickerOpen`, `closePicker`
- 本地状态：`query` (搜索词), `activeIndex` (键盘高亮索引)
- 使用 `useRecipes(query)` 获取食谱列表
- 使用 `ContextLayerClient.resolve()` 获取实体数据

**键盘导航（最重要的部分）：**
```
用户输入 @ → picker opens → 焦点自动到 search input
↓/↑ → activeIndex 在可选项中循环（跳过 .referenced）
Enter → 选择 activeIndex 对应的食谱
Escape → closePicker()
输入搜索文字 → activeIndex 重置为 0
鼠标悬停 → 同步 activeIndex（不与键盘冲突）
```

关键实现细节：
1. **selectableIndices**: `useMemo` 计算可选项索引数组（排除已引用的）
2. **activeIndex**: 指向 selectableIndices 数组的下标，不是 recipes 数组的下标
3. **onKeyDown 在 input 上**: 拦截 ArrowDown/ArrowUp/Enter/Escape，`e.preventDefault()` 阻止默认行为
4. **scrollIntoView**: 使用 `{ block: 'nearest' }` 在 activeIndex 变化时滚动
5. **focus 管理**: 焦点始终在 search input 上，键盘导航不移动焦点

**Pills 渲染：**
- 使用 `data-testid="ref-pill"` 以保持和现有 CSS 兼容
- 使用 `data-testid="mention-refs"` 包裹容器
- 显示 `{refs.length} 个食谱已引用 · 发送时注入上下文`

**AutoRef 逻辑：**
- 使用 `useRef<string | null>` 防止重复 resolve
- Mount 时异步 resolve → addRef → 失败时 fallback addRef without data

#### Phase 2: 修改 mention.ts

- 删除 `MentionPicker` re-export 行
- 保留所有其他 re-exports（MentionProvider, useMentionContext, MentionRef, MentionTrigger）

#### Phase 3: 修改 RecipeDetailPage.tsx

- `import { RecipePicker } from '../components/RecipePicker'`
- 删除 `MentionPicker` import
- 替换组件：`<RecipePicker baseUrl={CONTEXT_LAYER_URL} contextEntity={{...}} autoRef={true} />`
- 删除旧的 `sessionId` 和 `sessionTemplate` props

#### Phase 4: 修改 ChatPage.tsx

- `import { RecipePicker } from '../components/RecipePicker'`
- 删除 `MentionPicker` import
- 替换为：`<RecipePicker baseUrl={CONTEXT_LAYER_URL} />`

#### Phase 5: 清理 index.css

- **删除**所有 `.at-picker-overlay` 相关规则（~170 行）
- **删除**所有 `[data-testid="ref-pill"]` 硬编码颜色规则
- **添加** RecipePicker 样式（~80 行）：所有颜色使用 `var(--xxx)` design tokens
- 确保 `.recipe-picker-item.active` 有明显的背景色区分
- 确保 `.recipe-picker-item.referenced` 有 opacity/灰显效果
- 确保 `.recipe-picker-item.referenced:hover` 没有 hover 效果

### 3. 验证改动

每个 Phase 完成后运行：
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

验证冻结包未被修改：
```bash
git diff --name-only -- packages/ solutions/business/recipe-book/backend/
```

### 4. 写 Changelog 文件

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

1. **`packages/chat-interface/src/**`** — 不能修改
2. **`packages/context-layer/src/**`** — 不能修改
3. **`packages/context-layer-react/src/**`** — 不能修改
4. **`packages/entity-document/src/**`** — 不能修改
5. **`solutions/business/edu-platform/**`** — 不能修改
6. **`solutions/business/recipe-book/backend/**`** — 不能修改
7. **Frontend port 5291** — vite.config.ts 端口不变
8. **所有改动仅限于** `solutions/business/recipe-book/frontend/`

## 关键设计规则

- **键盘优先**: 用户 type `@` 后，必须能通过 ↑↓ Enter Escape 完成全部操作，无需鼠标
- **颜色**: 只用 CSS 变量 `var(--surface)` 等，**不用新的 hex 颜色**
- **焦点管理**: focus 始终在 search input 上，ArrowDown/Up 只改变 activeIndex，不移动 focus
- **可选项跳过**: 键盘导航跳过 `.referenced` 项，用户不会在已引用的食谱上浪费按键
- **ARIA**: 使用 `role="listbox"`, `role="option"`, `aria-selected`, `aria-activedescendant`
