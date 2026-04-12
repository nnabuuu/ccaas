# v1 Changelog

## 目标
首轮迭代：创建 BlockEditor 核心组件 + 7 种 block 类型 + 4 个页面骨架 + 路由 + 类型定义。
重点维度：D1 (BlockEditor 存在 + 基础渲染) + D5 (文件结构正确)。

## 修改清单

### 新增文件
- `frontend/src/types/lesson-plan.ts` — Block 类型定义（BlockType, Block, SectionContent 等 7 种内容类型, LessonPlan, RequirementInfo, createEmptyBlock helper）
- `frontend/src/types/template.ts` — Template, TemplateScope, PromotionStatus, Promotion 类型
- `frontend/src/components/editor/BlockEditor.tsx` — 核心共享编辑器，接受 mode/blocks/onChange/readOnly props；集成 @dnd-kit 拖拽排序；块间 "+" 插入按钮（紫色线 + 圆形按钮）；拖拽 handle + 删除按钮 hover 显示；模板模式 "建议保留" toggle
- `frontend/src/components/editor/BlockTypeSelector.tsx` — 7 种 block 类型选择器弹出面板
- `frontend/src/components/editor/blocks/SectionBlock.tsx` — 灰底粗体标题，双模式相同
- `frontend/src/components/editor/blocks/TextBlock.tsx` — 教案模式 contentEditable，模板模式灰色斜体 placeholder
- `frontend/src/components/editor/blocks/ListBlock.tsx` — 有序/无序列表，可增删项
- `frontend/src/components/editor/blocks/TableBlock.tsx` — HTML 表格，可编辑表头和单元格
- `frontend/src/components/editor/blocks/TimelineBlock.tsx` — 时间段+时长+描述，可增删行
- `frontend/src/components/editor/blocks/CalloutBlock.tsx` — 左边框彩色提示框（教案蓝色，模板琥珀色）
- `frontend/src/components/editor/blocks/ImageBlock.tsx` — 图片占位框
- `frontend/src/components/editor/RequirementBanner.tsx` — 学业要求关联状态（teal 已关联 / amber 未关联虚线框）
- `frontend/src/components/template/PromoteModal.tsx` — 推优弹窗（目标层级 + 模板信息 + 推荐理由 + 提交）
- `frontend/src/pages/LessonPlanList.tsx` — 教案列表（搜索 debounce + 学科/状态筛选 + 分页 + 状态 badge + 学业要求标签）
- `frontend/src/pages/LessonPlanEditor.tsx` — 教案编辑器（RequirementBanner + 标题 + meta 选择器 + BlockEditor mode="lesson" + 侧边栏 240px + 操作栏）
- `frontend/src/pages/TemplateList.tsx` — 模板列表（一级 Tab 教案/模板 + 二级 Tab 区级/校本/我的 + 搜索 + 模板卡片 + block pills + 推优按钮）
- `frontend/src/pages/TemplateEditor.tsx` — 模板编辑器（标题+描述 + meta + info banner + BlockEditor mode="template" + 操作栏）

### 修改文件
- `frontend/src/App.tsx` — 新增 6 条路由：/lesson-plans, /lesson-plans/new, /lesson-plans/:id, /templates, /templates/new, /templates/:id
- `frontend/src/config.ts` — 新增 EDU_API 常量（端口 3011）
- `frontend/package.json` — 新增 @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities 依赖

## 自检结果
- npx tsc --noEmit: **PASS**
- 现有路由回归: **PASS**（/, /chat 路由未修改）
- BlockEditor 复用: **PASS**（LessonPlanEditor 和 TemplateEditor 均 import 同一个 BlockEditor）
- Block 类型数: **7/7**（section, text, list, table, timeline, callout, image）
- box-shadow 数量: **0**
- `: any` 数量: **0**
- 所有 17 个新文件存在: **PASS**

## 本轮跳过
- D2 视觉精调：未对照 HTML 原型逐像素调整（留给 v2）
- D3 完整 CRUD 流程测试：需要后端运行（留给 v2）
- D4 交互细节：学业要求关联面板为 mock，搜索需后端验证（留给 v2）
