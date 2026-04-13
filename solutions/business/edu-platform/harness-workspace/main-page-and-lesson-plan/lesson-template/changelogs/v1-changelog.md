# v1 Changelog

## 目标
从零创建 BlockEditor 核心组件 + 7 种 block 类型 + 4 个页面 + 辅助组件 + 类型定义 + 路由。
目标得分：30-45 分（v1 骨架阶段）。

## 修改清单

### 新增文件
- `frontend/src/types/lesson-plan.ts` — Block/LessonPlan/RequirementLink 类型定义
- `frontend/src/types/template.ts` — Template/TemplateScope/PromoteRequest 类型定义
- `frontend/src/components/editor/BlockEditor.tsx` — 核心共享 Block 编辑器，支持 lesson/template 双模式，@dnd-kit 拖拽排序，"+" 插入按钮（紫色线 + 圆形按钮），块类型选择器，删除按钮 hover 显示，drag handle
- `frontend/src/components/editor/BlockTypeSelector.tsx` — 7 种 block 类型选择弹出面板
- `frontend/src/components/editor/RequirementBanner.tsx` — 学业要求锚点：已关联 teal 底色 + 未关联 amber 虚线框
- `frontend/src/components/editor/blocks/SectionBlock.tsx` — 灰底粗体标题 (surface2 bg, 14px 600)
- `frontend/src/components/editor/blocks/TextBlock.tsx` — 教案 contenteditable / 模板灰色斜体
- `frontend/src/components/editor/blocks/ListBlock.tsx` — 有序/无序列表，可增删项
- `frontend/src/components/editor/blocks/TableBlock.tsx` — HTML 表格，th surface2 bg，td border-bottom
- `frontend/src/components/editor/blocks/TimelineBlock.tsx` — 时间段 + 时长 + 描述，可增删行
- `frontend/src/components/editor/blocks/CalloutBlock.tsx` — 教案蓝色 / 模板琥珀色左边框
- `frontend/src/components/editor/blocks/ImageBlock.tsx` — 图片占位（灰底 + 提示文字）
- `frontend/src/pages/LessonPlanList.tsx` — 教案列表，page-level tab，搜索 + 筛选 + debounce，状态 badge v2 色
- `frontend/src/pages/LessonPlanEditor.tsx` — 教案编辑器，grid 两栏 1fr+200px，RequirementBanner + BlockEditor mode=lesson + 操作栏
- `frontend/src/pages/TemplateList.tsx` — 模板列表，一级 tab + 二级 scope tab，block pills 箭头串联，推优按钮 + PromoteModal
- `frontend/src/pages/TemplateEditor.tsx` — 模板编辑器，max-width 640px，info banner + BlockEditor mode=template
- `frontend/src/components/template/PromoteModal.tsx` — 420px 推优弹窗，overlay 遮罩，select + textarea

### 修改文件
- `frontend/src/App.tsx` — 导入 4 个页面组件，替换 placeholder 路由为 6 个实际路由
- `frontend/package.json` — 新增 @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

## 自检结果
- npx tsc --noEmit: **PASS**
- 现有路由回归 (/ 和 /chat): **PASS** — 未修改 HomePage / ChatPage / 冻结文件
- BlockEditor 复用: **PASS** — LessonPlanEditor 和 TemplateEditor 都 import 同一个 BlockEditor
- Block 类型数: **7/7** (section, text, list, table, timeline, callout, image)
- 色值字面量检查: **PASS** — 0 处 white/#fff/#000/rgba()
- box-shadow 检查: **PASS** — 0 处
- v1 变量名检查: **PASS** — 0 处 --bg1/--b1/--info-t/--warn-t
- v2 变量使用: 73 处 var(--surface) / var(--border) 等
- API 端点覆盖: lesson-plans 6 处, templates 5 处, promote 8 处
- debounce: 教案列表搜索 300ms debounce

## 本轮跳过
- D2 视觉微调：v1 重点是骨架完整性和编译通过，视觉微调留 v2+
- D4 部分交互：分页 loading 指示器、发布按钮、更完整的错误处理留后续迭代
