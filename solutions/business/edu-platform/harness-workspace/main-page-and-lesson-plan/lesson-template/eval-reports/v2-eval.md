# v2 Evaluation Report

## Pre-gate
- TypeScript 编译: PASS (`npx tsc --noEmit` — zero errors)

## Dimension Scores

| Dimension | Score | Weighted | Notes |
|-----------|-------|----------|-------|
| D1 BlockEditor | 5/5 | 30/30 | 7 种块类型齐全；v2 变量 37 处、v1 变量 0 处；紫色插入线+BlockTypeSelector；删除按钮 hover var(--surface2)；dnd-kit 拖拽；教案/模板双模式正确；"建议保留" teal toggle；Callout 蓝/琥珀双色 |
| D2 Visual Fidelity | 5/5 | 25/25 | 0 处 box-shadow；0 处色值字面量；v2 变量 ~92 处 (surface+border)；卡片 10px、按钮 6px、侧边栏 200px、弹窗 420px、列表 860px 全部匹配；状态 badge 四色(green/blue/purple/amber)；RequirementBanner teal/amber 双状态；page-level tab 双向切换；block pills → 箭头串联 |
| D3 CRUD Completeness | 4/5 | 16/20 | 教案：列表分页+debounce搜索+筛选+新建+编辑+删除(确认弹窗)+blocks保存+发布 全齐。模板：列表scope筛选+新建+编辑+删除(确认弹窗)+推优提交 全齐。缺 Fork 模板→教案的 UI 入口（source_template_id 仅定义在类型中，无使用按钮） |
| D4 Interaction | 4/5 | 12/15 | RequirementBanner 双状态渲染正确但 onLink/onChange 为空函数(noop)，关联/更换功能不可用；BlockTypeSelector 完整；page-level tab 切换正常；scope 二级 tab 三档切换；PromoteModal target_scope+reason 完整；loading 状态双列表；卡片 hover border-color 变化；分页正常。TemplateList 搜索无 debounce(minor) |
| D5 Code Quality | 5/5 | 10/10 | BlockEditor 独立组件被两个编辑器共用；lesson-plan.ts + template.ts 类型完整；0 处 any；7 个 block 类型各自独立文件；v2 CSS 变量全面使用 |

基础分: 93/100

## Penalty Deductions

| Check | Result |
|-------|--------|
| BlockEditor 代码复制 | 无 — 两个编辑器均 import 共享 BlockEditor |
| box-shadow | 0 处 |
| 破坏首页 | 无 — `<Route path="/" element={<HomePage />}` 正常 |
| 破坏 Chat | 无 — `<Route path="/chat" element={<ChatPage />}` 正常 |
| 缺少 block 类型 | 0 — 全部 7 种存在 |
| 硬编码颜色值 | 0 处（pages + editor + template 组件中无 hex 字面量） |
| v1 变量名 | 0 处（editor/template/pages 范围内） |
| 纯白 #fff | 0 处 |
| 修改冻结文件 | 0 文件 |
| 组件色值字面量 | 0 处（无 'white'/'#fff'/rgba） |

- Total penalties: **0**

## Priority Fix

1. [INTEGRATION] Fork 模板→教案 UI 缺失 — 在 TemplateList 卡片或 TemplateEditor 增加"使用此模板"按钮，调用 `POST /api/lesson-plans` 时传入 `source_template_id`
2. [COMPONENT] RequirementBanner 关联/更换功能为 noop — LessonPlanEditor 中 `onLink={() => {}}` 和 `onChange={() => {}}` 需接入学业要求选择弹窗或 API
3. [STYLE] TemplateList 搜索无 debounce — 每次 keystroke 触发 fetchList，应加 debounce（LessonPlanList 已有正确实现，可复用模式）

## Actionable Fix Hints

- file: `frontend/src/pages/TemplateList.tsx`, issue: 缺少"使用此模板"按钮, expected: 在卡片 footer 或详情页添加按钮，点击后 `navigate('/lesson-plans/new?template_id=' + item.id)` 并在 LessonPlanEditor 中读取 query param 加载模板 blocks
- file: `frontend/src/pages/LessonPlanEditor.tsx:154-156`, issue: `onLink={() => {}}` / `onChange={() => {}}` noop, expected: 实现学业要求选择弹窗，调用 API 查询课标列表并回填 requirement state
- file: `frontend/src/pages/TemplateList.tsx:184`, issue: `setSearch` 直接触发 useEffect 无 debounce, expected: 参照 LessonPlanList 使用 `useRef<ReturnType<typeof setTimeout>>` + `setTimeout` 模式

总分: 93/100
