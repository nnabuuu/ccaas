# v2 Changelog

## 目标
基于 v1 eval report 的 Priority Fix 列表，重点修复 D3 (CRUD Completeness) 和 D2/D4 (侧边栏模板区)。

## 修改清单

### D3: CRUD Completeness (目标: 3/5 → 5/5)

- `frontend/src/pages/LessonPlanList.tsx` — 添加列表项删除按钮 + confirm + `DELETE /api/lesson-plans/:id` 调用
- `frontend/src/pages/LessonPlanEditor.tsx`:
  - 添加"发布"按钮 → `POST /api/lesson-plans/:id/publish`，仅 draft 状态显示
  - 添加"保存为模板"按钮 → `POST /api/lesson-plans/:id/save-as-template`
  - 添加"删除"按钮 → `DELETE /api/lesson-plans/:id`，删除后导航回列表
  - 支持 Fork 模板→教案：读取 URL query `?template_id=X`，fetch 模板 blocks 预填，POST 时传 `source_template_id`
  - 新增 `status` state 用于控制发布按钮显示
- `frontend/src/pages/TemplateList.tsx`:
  - 添加模板卡片删除按钮（仅 teacher scope）+ confirm + `DELETE /api/templates/:id`
  - 添加"使用此模板"按钮 → 导航到 `/lesson-plans/new?template_id=:id`（Fork 入口）
- `frontend/src/pages/TemplateEditor.tsx` — 添加"删除"按钮 → `DELETE /api/templates/:id`，删除后导航回列表

### D2/D4: 侧边栏模板区 (静态 → 动态)

- `frontend/src/pages/LessonPlanEditor.tsx`:
  - 侧边栏模板区从静态"新授课模板"文本改为动态加载 `GET /api/templates?scope=teacher`
  - 显示模板卡片列表（名称 + 描述）
  - 点击模板卡片 → confirm → 替换当前 blocks

## 自检结果
- npx tsc --noEmit: PASS
- 现有路由回归: PASS (/, /chat 未修改)
- BlockEditor 复用: PASS (2 pages import)
- Block 类型数: 7/7
- box-shadow: 0
- any: 0

## 新增 CRUD 覆盖

| 功能 | v1 状态 | v2 状态 |
|------|---------|---------|
| DELETE lesson-plans | ✗ | ✓ (列表+编辑器) |
| POST publish | ✗ | ✓ (编辑器 action bar) |
| POST save-as-template | ✗ | ✓ (编辑器 action bar) |
| Fork template→lesson plan | ✗ | ✓ (query param + TemplateList 入口) |
| DELETE templates | ✗ | ✓ (列表+编辑器) |
| 侧边栏模板切换 | 静态 placeholder | 动态列表 + 点击替换 |

## 本轮跳过
- 无：所有 Priority Fix 项均已处理
