# v1 Changelog

## 改动文件
- `src/components/MessageRenderer.tsx` — 修正用户消息气泡：bg-ck-bg3→bg-ck-user-bubble（正确的暖色调背景），rounded-[16px_16px_4px_16px]→rounded-xl（统一 12px 圆角），text-sm→text-base（16px），leading-[1.5]→leading-[1.4]（匹配设计系统），px-3.5→px-4
- `src/components/chat/ChatInterfaceComposer.tsx` — 修正发送按钮：rounded-full→rounded-lg（8px），bg-ck-t1→bg-ck-accent（terracotta #AE5630），添加 hover:bg-ck-accent-hover。修正停止按钮同样 rounded-lg。修正 textarea pb-14 md:pb-8→pb-10（匹配设计系统）。所有按钮添加 ease-claude easing。快捷建议按钮添加 active:scale-[0.98] 和 ease-claude
- `src/components/chat/ChatInterfaceEmptyState.tsx` — 修正图标颜色：text-orange-400/90→text-ck-accent（消除硬编码颜色，使用 CSS 变量）
- `src/components/SessionContextBar.tsx` — 降低视觉突兀感：bg-ck-bg1→bg-ck-bg2，border-ck-b1→border-ck-b2，py-2.5→py-2
- `src/components/ChatSidebar.tsx` — 侧边栏背景 bg-ck-bg1→bg-ck-bg2（与页面背景融合），border-ck-b1→border-ck-b2，添加 ease-claude 过渡，新对话按钮添加 active:scale-[0.98]。移动端抽屉同步 bg-ck-bg2
- `src/components/ActionToolbar.tsx` — 所有按钮添加 ease-claude easing 和 active:scale-[0.98] 按压反馈
- `src/components/ScrollToBottom.tsx` — 添加 backdrop-blur-sm、shadow-sm、transition-all、ease-claude、active:scale-[0.98]，提升浮动按钮质感
- `src/components/NextActions.tsx` — 添加 ease-claude easing 和 active:scale-[0.98]
- `src/components/QuickSuggestions.tsx` — hover 背景 bg-ck-bg2→bg-ck-bg3（更明显），添加 ease-claude 和 active:scale-[0.98]
- `src/styles/prose.css` — 段落行高 line-height: 1.5→normal（24px，匹配设计系统规范）。内联代码边框 1px→0.5px（匹配 Claude Web 细边框）

## 对应维度
- D1 (Alignment): 用户气泡使用正确的 --user-bubble-bg 颜色、rounded-xl 圆角、text-base 字号、leading-[1.4] 行高。发送按钮使用 terracotta accent 色 + rounded-lg。段落行高修正为 leading-normal
- D2 (Consistency): 消除硬编码 text-orange-400/90，统一使用 CSS 变量。侧边栏和 context bar 背景统一为 bg2。所有交互元素统一 ease-claude easing
- D3 (Mobile): 移动端侧边栏抽屉背景同步 bg-ck-bg2。Composer padding 统一 pb-10 避免移动端按钮遮挡
- D4 (Interaction): 全面添加 active:scale-[0.98] 按压反馈（ActionToolbar、NextActions、QuickSuggestions、Sidebar、ScrollToBottom）。统一 ease-claude 过渡曲线
- D5 (Code): 内联代码边框精确匹配 0.5px。无新依赖引入

## Props 接口变更
- 无

## 本轮重点
修正用户气泡颜色/圆角、发送按钮 terracotta accent 色、消除硬编码颜色值，全面添加 active:scale 按压反馈，使 UI 从"功能正确"提升到"视觉对标 Claude Web"的初始水准。
