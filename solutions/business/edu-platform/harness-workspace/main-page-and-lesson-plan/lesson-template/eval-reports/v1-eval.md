# v1 Evaluation Report

## Pre-gate
- TypeScript 编译: **PASS** (`npx tsc --noEmit` 零错误)

## Dimension Scores

| Dimension | Score | Weighted | Notes |
|-----------|-------|----------|-------|
| D1: BlockEditor | 5/5 | 30/30 | 7 种块类型全部存在且双模式正确；DnD 拖拽、"+"插入、删除、"建议保留" toggle 全部实现 |
| D2: Visual Fidelity | 4/5 | 20/25 | CSS 变量 213 处；关键尺寸匹配（960/240/420/640/10px）；零 box-shadow；badge/tag 颜色正确；侧边栏模板区为静态 placeholder 非动态列表 |
| D3: CRUD Completeness | 3/5 | 12/20 | 教案和模板的 List+Create+Read+Update+Blocks Save 完整；缺少 Delete、Publish、Fork、Save-as-template |
| D4: Interaction | 4/5 | 12/15 | RequirementBanner 双状态 ✓、BlockTypeSelector ✓、Tab 切换 ✓、PromoteModal ✓、debounce ✓、loading ✓；侧边栏模板切换仅 placeholder |
| D5: Code Quality | 5/5 | 10/10 | BlockEditor 独立复用（2 页面 import）；TypeScript 类型完整（lesson-plan.ts + template.ts）；0 个 any；7 个独立 block 文件 |

基础分: 84/100

## Penalty Deductions

| Rule | Count | Deduction |
|------|-------|-----------|
| BlockEditor 代码复制 | 0 | 0 (两个编辑器均 import BlockEditor，无重复渲染代码) |
| 使用 box-shadow | 0 | 0 |
| 破坏首页 | 0 | 0 (Route path="/" → HomePage ✓) |
| 破坏 Chat | 0 | 0 (Route path="/chat" → AppShell ✓) |
| 缺少 block 类型 | 0 | 0 (7/7 全部存在) |
| 硬编码颜色值 | 0 | 0 (grep 未发现 hex 颜色硬编码) |
| 修改冻结文件 | 0 | 0 (git diff 无冻结文件修改) |

- Total penalties: **0**

## Detailed Evidence

### D1: BlockEditor — 5/5

**文件结构** (全部存在):
- `src/components/editor/BlockEditor.tsx` — 核心组件，Props 接口正确 (`mode, blocks, onChange, readOnly`)
- `src/components/editor/BlockTypeSelector.tsx` — 7 种类型选择器
- `src/components/editor/blocks/` — SectionBlock, TextBlock, ListBlock, TableBlock, TimelineBlock, CalloutBlock, ImageBlock (7/7)

**功能覆盖**:
1. **7 种块类型** — `BLOCK_RENDERERS` Record 映射全部 7 种 ✓
2. **双模式切换** — mode prop 传递至每个 block renderer；TextBlock/ListBlock/CalloutBlock 在 template 模式下显示灰色斜体 placeholder ✓；SectionBlock 在两种模式下均正常显示 ✓
3. **拖拽排序** — @dnd-kit/core + @dnd-kit/sortable，`DndContext` + `SortableContext` + `useSortable`，`arrayMove` 更新 `sort_order` ✓
4. **"+" 插入按钮** — `InsertGap` 组件：紫色线 (`var(--purple-t)`)，20px 圆形按钮，hover 显示，点击展开 `BlockTypeSelector` ✓
5. **删除按钮** — 22×22px，hover 时 `bg: var(--bg2)`，block-actions 区域 hover 显示 ✓
6. **"建议保留" badge** — 模板模式专属，`is_required` toggle，teal bg/color 样式，9px font ✓
7. **Drag handle** — `position: absolute; left: 2px`，`opacity: 0 → hover: 1` ✓

### D2: Visual Fidelity — 4/5

**匹配项**:
- 零 box-shadow ✓
- 213 处 CSS 变量引用 ✓
- 教案列表 `maxWidth: 960px; padding: 28px 24px` ✓
- 列表项 `borderRadius: 10px; padding: 16px 20px; border: 1px solid var(--b1)` ✓
- 编辑器侧边栏 `width: 240px; flexShrink: 0` ✓
- 推优弹窗 `width: 420px; borderRadius: 12px; overlay: rgba(28,28,26,0.15)` ✓
- 模板编辑器 `maxWidth: 640px` ✓
- 状态 badge 4 种映射 (draft=灰/published=绿/in_use=蓝/ai_generated=紫) ✓
- 学业要求标签 teal dot + teal bg ✓，未关联 amber dot + warn bg ✓
- Scope badge (district=绿/school=蓝/teacher=灰/pending=amber) ✓
- Block pills `fontSize: 10px; padding: 2px 6px; borderRadius: 3px` with "→" 连接 ✓
- Info banner `padding: 10px 14px; bg: var(--bg2); borderRadius: 6px; fontSize: 11px` ✓
- 搜索框 `width: 220px` ✓
- 标题 `fontSize: 20px; fontWeight: 700` ✓
- "标" 图标 `20×20; borderRadius: 4px; bg: var(--teal-t)` ✓

**扣分项**:
- 侧边栏模板区仅为静态 "新授课模板" 文本，未实现模板卡片列表（原型有可切换模板列表）
- 侧边栏"关联数据"和"文件"区结构偏简化

### D3: CRUD Completeness — 3/5

**教案 — 已实现**:
| 端点 | 状态 |
|------|------|
| `GET /lesson-plans` (列表+分页+搜索+筛选) | ✓ |
| `GET /lesson-plans/:id` | ✓ |
| `POST /lesson-plans` (新建) | ✓ |
| `PUT /lesson-plans/:id` (更新 meta) | ✓ |
| `POST /lesson-plans/:id/blocks` (保存 blocks) | ✓ |
| `POST /lesson-plans/:id/link-requirement` | ✓ |
| `POST /lesson-plans/:id/export` (Word/PDF) | ✓ |
| `DELETE /lesson-plans/:id` | **✗ 缺失** |
| `POST /lesson-plans/:id/publish` | **✗ 缺失** |
| `POST /lesson-plans/:id/save-as-template` | **✗ 缺失** |

**模板 — 已实现**:
| 端点 | 状态 |
|------|------|
| `GET /templates` (列表+scope 筛选+搜索) | ✓ |
| `GET /templates/:id` | ✓ |
| `POST /templates` (新建) | ✓ |
| `PUT /templates/:id` (更新) | ✓ |
| `POST /templates/:id/promote` (推优) | ✓ |
| `DELETE /templates/:id` | **✗ 缺失** |

**跨功能**:
| 功能 | 状态 |
|------|------|
| Fork 模板→教案 (source_template_id) | **✗ 缺失** (仅在类型中定义) |

### D4: Interaction — 4/5

**已实现**:
- RequirementBanner 双状态 (teal linked / amber unlinked + "更换"/"点击关联") ✓
- BlockTypeSelector (7 种类型 icons + labels + hover 效果) ✓
- TemplateList 双层 Tab (一级: 教案|模板, 二级: 区级|校本|我的 with counts) ✓
- PromoteModal (target_scope select + reason textarea + submit loading) ✓
- 搜索 debounce 300ms (两个列表页) ✓
- Loading 状态 (4 处 loading indicator) ✓
- Pagination (lesson plan list, conditional 显示) ✓
- 状态 badge 颜色映射 ✓
- "提交推优" 按钮 (仅 teacher scope + 非 pending) ✓
- 教案卡片点击导航 ✓
- 模板卡片点击导航 ✓

**缺失**:
- 侧边栏模板切换功能 (当前是静态 placeholder，非可点击替换模板结构)

### D5: Code Quality — 5/5

- BlockEditor 独立复用: `grep -rn 'import.*BlockEditor' src/pages/` → 2 matches (LessonPlanEditor + TemplateEditor) ✓
- TypeScript 类型完整: `lesson-plan.ts` (Block, BlockType, LessonPlan, RequirementInfo, LessonPlanListResponse, createEmptyBlock) + `template.ts` (Template, TemplateScope, PromotionStatus, Promotion, TemplateListResponse) ✓
- 零 `any` 使用 ✓
- 7 个独立 block 组件文件 ✓
- CSS 全部使用 design-tokens 变量 ✓
- 组件拆分合理: BlockEditor / BlockTypeSelector / RequirementBanner / PromoteModal / 7 blocks ✓

## Priority Fix

1. **[INTEGRATION] 缺少 Delete 操作** — 教案列表和模板列表均无删除入口和 API 调用。需添加列表项/编辑器中的删除按钮 + `DELETE /api/lesson-plans/:id` 和 `DELETE /api/templates/:id` 调用。
2. **[INTEGRATION] 缺少 Publish 功能** — 教案编辑器无"发布"按钮，缺少 `POST /api/lesson-plans/:id/publish` 调用。需在 action bar 添加发布按钮。
3. **[INTEGRATION] 缺少 Fork 模板→教案** — `source_template_id` 仅在类型定义中存在，新建教案时未提供"从模板创建"入口。需在新建教案流程或模板列表添加 fork 入口。
4. **[COMPONENT] 侧边栏模板区为静态 placeholder** — LessonPlanEditor 侧边栏"模板"区仅显示静态文本，未加载可用模板列表。需 fetch 模板列表并支持点击替换教案 blocks。

## Actionable Fix Hints

- file: `frontend/src/pages/LessonPlanList.tsx`, issue: 缺少列表项删除按钮和确认, expected: 每行添加删除图标 + `fetch(\`${EDU_API}/lesson-plans/${id}\`, { method: 'DELETE' })`
- file: `frontend/src/pages/LessonPlanEditor.tsx`, issue: 缺少发布按钮, expected: action bar 添加"发布"按钮 → `POST /api/lesson-plans/${id}/publish` → 更新状态显示
- file: `frontend/src/pages/LessonPlanEditor.tsx`, issue: 缺少 fork 功能, expected: 新建模式下从 URL query 读取 `template_id` → `POST /api/lesson-plans { source_template_id }` → 预填 blocks
- file: `frontend/src/pages/TemplateList.tsx`, issue: 缺少模板删除, expected: 卡片添加删除入口 → `DELETE /api/templates/${id}`
- file: `frontend/src/pages/LessonPlanEditor.tsx`, issue: 侧边栏模板区静态, expected: fetch `GET /api/templates?scope=teacher` 加载模板列表 → 点击后确认替换当前 blocks
- file: `frontend/src/pages/LessonPlanEditor.tsx`, issue: 缺少 save-as-template, expected: action bar 添加"保存为模板"按钮 → `POST /api/lesson-plans/${id}/save-as-template`

总分: 84/100
