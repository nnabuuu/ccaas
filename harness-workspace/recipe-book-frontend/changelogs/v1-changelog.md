# v1 Changelog

## 改动文件
- `frontend/src/pages/ChatPage.tsx` — Added custom Chinese welcome empty state (`RecipeWelcome` component) with greeting, subtitle, and 4 starter cards; wired via `emptyState` prop to `ChatInterface`

## 对应维度
- D4: Custom Chinese welcome message — replaced default English "What shall we think through?" with "你好，厨师！" + subtitle + 4 interactive starter cards (改良菜谱, 营养分析, 菜单规划, 烹饪问答) matching Stitch design

## 本轮重点
添加自定义中文欢迎态（RecipeWelcome 组件），使用 useChatCore + handleAction 让 4 张 starter card 可点击发送预设 prompt，替换默认英文空态。
