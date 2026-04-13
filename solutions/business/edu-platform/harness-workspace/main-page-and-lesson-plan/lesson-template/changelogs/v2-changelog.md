# v2 Changelog

## 目标

基于 v1 eval report (88/100) 的 Priority Fix 列表，修复 D2/D3/D4 扣分项。

### v1 扣分分析

- **D2 (Visual Fidelity) 4/5**: 列表页缺少分页控件
- **D3 (CRUD) 4/5**: 教案/模板列表缺少删除功能；教案编辑器缺少发布/状态变更；分页 API 参数未传递
- **D4 (Interaction) 4/5**: 列表无分页交互控件

## 修改清单

### 1. `frontend/src/pages/LessonPlanList.tsx` — 分页 + 删除

- 新增 `page`, `total`, `deleteConfirm` state
- `fetchList` 增加 `page`/`page_size` 参数传递到 API
- 筛选/搜索变更时重置 page=1
- 新增 `handleDelete` — 调用 `DELETE /api/lesson-plans/:id`
- 每个卡片右上角增加删除按钮（SVG trash icon），hover 变红 `var(--red)`
- 删除确认弹窗：`var(--overlay)` 遮罩 + `var(--surface)` 弹窗 + 12px 圆角
- 底部分页控件：共 X 条 + 上一页/下一页 + 页码显示

### 2. `frontend/src/pages/TemplateList.tsx` — 分页 + 删除

- 同 LessonPlanList 模式：`page`, `total`, `deleteConfirm` state
- `fetchList` 增加 `page`/`page_size` API 参数
- scope tab 切换时重置 page=1
- `handleDelete` — 调用 `DELETE /api/templates/:id`
- 每个卡片增加删除按钮（同 LessonPlanList）
- 删除确认弹窗
- 底部分页控件

### 3. `frontend/src/pages/LessonPlanEditor.tsx` — 发布

- 新增 `status` state (`LessonPlanStatus`)，从 API 响应中加载
- 新增 `publishing` state
- 新增 `handlePublish` — 调用 `POST /api/lesson-plans/:id/publish`
- 操作栏增加"发布"按钮（draft 状态时显示，`var(--green-bg)` + `var(--green)`）
- 发布后显示"已发布"文字标记

## 自检结果

- npx tsc --noEmit: **PASS**
- 现有路由回归: **PASS** (/, /chat 路由未修改)
- BlockEditor 复用: **PASS** (两个编辑器均 import BlockEditor)
- Block 类型数: **7/7**
- 色值字面量检查: **PASS** (0 处)
- box-shadow 检查: **PASS** (0 处)
- rgba 检查: **PASS** (0 处)
- v2 CSS 变量: 92 处 (≥15)
- v1 变量: 0 处

## 预期分数提升

- D2: 4/5 → 5/5 (+5 pts) — 分页控件已添加
- D3: 4/5 → 5/5 (+4 pts) — 删除 + 发布 + 分页 API 参数完整
- D4: 4/5 → 5/5 (+3 pts) — 分页交互控件已添加

## 本轮跳过

- 无，所有 Priority Fix 均已处理
