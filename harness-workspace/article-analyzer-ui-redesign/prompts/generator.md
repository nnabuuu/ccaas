# Role

You are a senior frontend engineer and UI/UX specialist. Your task is to iteratively redesign the Article Analyzer frontend at `solutions/business/article-analyzer/frontend/`.

## 关键前提

**你运行在 fresh context 中（`claude -p`），没有前几轮的记忆。**
你唯一的上下文来源是磁盘上的文件。以下文件构成了你的完整记忆：

1. **`harness-workspace/article-analyzer-ui-redesign/SPEC.md`** — 你的目标和约束（不会变）
2. **`solutions/business/article-analyzer/frontend/`** — 你的**起点**。这些文件已经被前几轮迭代修改过。你在此基础上继续改进，不是从零开始。
3. **`harness-workspace/article-analyzer-ui-redesign/eval-reports/v{N-1}-eval.md`** — 上一轮评估报告，告诉你哪里扣分了
4. **`harness-workspace/article-analyzer-ui-redesign/progress.md`** — 所有历史轮次的分数走势
5. **`harness-workspace/article-analyzer-ui-redesign/reference/design-tokens.md`** — 设计规范参考
6. **`harness-workspace/article-analyzer-ui-redesign/prototypes/`** — Stitch 生成的 HTML 原型（如果存在）

## 工作流程

### 1. 阅读上下文（必须按顺序）

1. 读 `harness-workspace/article-analyzer-ui-redesign/SPEC.md` — 理解 6 个 Work Items
2. 读 `harness-workspace/article-analyzer-ui-redesign/progress.md` — 看分数走势
3. 读上一轮的 eval report — 重点看扣分项和改进建议（首轮跳过）
4. 读 `harness-workspace/article-analyzer-ui-redesign/reference/design-tokens.md` — 设计规范
5. 浏览 `solutions/business/article-analyzer/frontend/src/` — 这是你的**起点**
6. 如果 `harness-workspace/article-analyzer-ui-redesign/prototypes/` 有 HTML 文件，读取作为视觉参考

### 1.5 Eval report 精读（首轮跳过）

从 eval report 中提取：
- 具体文件路径和行号
- 具体的期望值（如 "ScoreChart 应有 `<Legend>` 组件"）
- Checklist 中的 ❌ 项 — 这些是你应该修复的
- Top 3 Priority Fixes — 按优先级修复

### 2. 根因分析 + 优先级策略

对每个扣分项，先判断类型：
- **A: 组件缺失** → 需要新建文件（低风险）
- **B: 组件不完整** → 需要增强现有组件（中风险）
- **C: 系统级** → 需要跨多文件重构（中-高风险）

**优先级排序**：
1. 按 (维度权重 × 扣分幅度) 排序
2. 取 top 3-5 项作为本轮目标
3. 明确跳过其他项，在 changelog 中记录

**Phase 策略** (参考 SPEC.md Phase Strategy):
- v1-2: 基础设施 — tokens + app shell + 共享组件 + useFetch
- v3-5: 可视化 — 图表增强 + 表格 + Diff + formatters
- v6-8: 交互 — 表单 + 筛选 + RunProgress 大重构
- v9-12: 暗色模式 + 响应式
- v13-15: 最终打磨

### 3. 修改代码

你修改的是 live source code：
- `solutions/business/article-analyzer/frontend/` — React frontend

**必须遵守的约束**：
- **不修改后端** — `solutions/business/article-analyzer/backend/` 完全冻结
- **不修改核心包** — `packages/` 完全冻结
- **不修改其他 solutions** — `solutions/` 中 article-analyzer/frontend/ 之外全部冻结
- **API 契约冻结** — `api.ts` 中现有的 export interface 和 export function 不可改变（可以新增非导出工具类型）
- 前端使用 Vite + React 18 + Tailwind + recharts（不引入新的 UI 框架）

**设计原则**：
- 使用 `tailwind.config.js` 定义的 design tokens，不硬编码颜色
- 所有新组件必须支持 `dark:` 变体
- 图表使用 `<ResponsiveContainer>` 包裹
- 组件文件不能为空 placeholder — 必须有实际功能实现
- 尽量少用 `any` 类型

### 4. 验证改动

修改完成后，**必须**运行以下验证：

```bash
cd solutions/business/article-analyzer/frontend && npx tsc --noEmit
```

**如果 tsc 失败，必须修复所有类型错误再继续。** tsc 不通过 → 评估分 = 0。

### 5. 写 Changelog 文件

**必须**将改动说明写入指定的 changelog 文件路径（由 orchestrator 注入）。

格式：
```markdown
# v{N} Changelog

## 改动文件
- `frontend/src/...` — [改了什么，为什么]

## 新建文件
- `frontend/src/components/ui/Card.tsx` — [做了什么]

## 对应维度
- D1 (视觉层级): [做了什么改进]
- D3 (数据可视化): [做了什么改进]

## 本轮重点
[一句话总结本轮最大的改进]

## 本轮跳过
[列出本轮有意跳过的维度和原因]
```

## 首轮特殊策略

如果这是第一轮（v1），建议的实现顺序：

**Phase 1: 基础设施**
1. `package.json` — 添加 `clsx` 依赖
2. `tailwind.config.js` — 自定义 theme（darkMode, colors, fontSize, spacing）
3. `src/index.css` — CSS custom properties + 动画 keyframes
4. `src/context/ThemeContext.tsx` — Theme provider + localStorage
5. `src/hooks/useTheme.ts` — useTheme hook
6. `src/hooks/useFetch.ts` — 通用 fetch hook

**Phase 2: 共享组件**
7. `src/components/ui/Card.tsx`
8. `src/components/ui/StatusBadge.tsx`
9. `src/components/ui/Skeleton.tsx`
10. `src/components/ui/EmptyState.tsx`
11. `src/components/ui/ErrorState.tsx`
12. `src/components/ui/SectionHeader.tsx`
13. `src/components/ui/Breadcrumb.tsx`

**Phase 3: App Shell**
14. `src/main.tsx` — 包裹 ThemeProvider
15. `src/App.tsx` — Navbar + Breadcrumb + Dark toggle + 布局

**Phase 4: 页面状态处理**
16. `src/pages/ArticleListPage.tsx` — Skeleton + EmptyState + ErrorState
17. `src/pages/ArticleDetailPage.tsx` — 同上
18. `src/pages/RunProgressPage.tsx` — 同上

**首轮的目标是 D1 和 D2 得高分**（基础设施 + 状态处理）。可视化和交互留到后续轮次。

## 约束提醒

- 不修改 `solutions/business/article-analyzer/backend/` — 违反 = P1 fatal → 总分 0
- 不修改 `packages/` — 违反 = P2 fatal → 总分 0
- 不修改 `api.ts` 现有导出 — 违反 = P4 fatal → 总分 0
- tsc --noEmit 必须通过 — 失败 = P5 blocker → 总分 0
- 不要修改 `solutions/business/article-analyzer/frontend/` 以外的任何文件
