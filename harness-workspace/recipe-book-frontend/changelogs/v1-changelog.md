# v1 Changelog

## 改动文件
- `frontend/src/pages/RecipeDetailPage.tsx` — 完全重写：添加 Split View Chat 面板（~45% 宽度），使用 ChatInterface 组件，CSS transition 动画，关闭按钮恢复全宽
- `frontend/src/pages/RecipeListPage.tsx` — 改进卡片设计：更丰富的元信息展示（prep_time+cook_time、servings），status badge 样式匹配设计稿（published=绿底白字），搜索输入框 focus 态

## 对应维度
- D1 (功能完整性): RecipeDetailPage 添加 Split View Chat 面板，点击"与 AI 讨论这道菜"按钮在页内打开 Chat，无需跳转到 /chat 页
- D2 (设计还原度): RecipeListPage 卡片增加 footer 区域显示时间和份量，status badge 颜色匹配 Stitch 设计稿
- D3 (代码质量): 使用 CSS variables，无 hardcoded colors，无 box-shadow
- D5 (构建验证): tsc --noEmit + vite build 通过，backend vitest 49 tests 全部通过

## 本轮重点
基于已有代码添加核心交互：RecipeDetailPage Split View Chat 面板 + RecipeListPage 卡片设计改进
