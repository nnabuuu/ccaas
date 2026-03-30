# v2 Changelog

## 改动文件
- `src/components/chat/ChatInterfaceComposer.tsx` — Quick Suggestions 从 `rounded-full` 纯文字 pills 改为 `rounded-ck-lg` icon+text 按钮（对齐 Claude Web 的 Write/Learn/Code 样式）；Composer 底部从单按钮改为 flex 布局，左侧新增 "+" 附件按钮占位；所有 suggestion 按钮增加 `focus-visible:ring-2 focus-visible:ring-ck-accent`
- `src/components/chat/ChatInterfaceEmptyState.tsx` — 将 ✺ Unicode 字符替换为 SVG 4-pointed sparkle icon，使用 `animate-ck-sparkle` 微动画（4s 缓慢脉冲）
- `src/components/ChatSidebar.tsx` — 会话列表项增加 `ease-claude` easing 和 `active:scale-[0.98]` 按压反馈
- `tailwind.config.js` — 新增 `ck-sparkle` keyframe（scale+opacity 脉冲）和 `animate-ck-sparkle` 动画

## 对应维度
- D1 (Claude Web Alignment): Quick Suggestions 改为 icon+text `rounded-ck-lg` 按钮卡片（最大视觉差距修复）；Empty State 的 ✺ 替换为 SVG sparkle + 脉冲动画；Composer 新增左侧 "+" 附件按钮占位，匹配 Claude Web 的 bottom-bar 布局
- D2 (Consistency): 新增的 sparkle icon 和 suggestion icons 使用 `text-ck-accent` / `text-ck-t2` 等 design token 类，零硬编码颜色
- D3 (Responsive): Mobile 375px 验证 — 4 个 suggestion 按钮在窄屏正确换行，sparkle icon 使用 `w-7 h-7 sm:w-8 sm:h-8` 响应式尺寸
- D4 (Interaction): Quick Suggestion 按钮新增 `focus-visible:ring-2` 键盘焦点环；Sidebar 会话项增加 `ease-claude` + `active:scale-[0.98]`
- D5 (Code Quality): 动画通过 Tailwind config keyframe 定义，非 inline style；SVG icon 内联组件中，无新依赖

## Props 接口变更
- 无

## 本轮重点
Quick Suggestions 从纯文字 pills 改为 Claude Web 风格的 icon+text bordered 按钮，并配合 Empty State SVG sparkle 动画和 Composer 附件按钮占位，缩小与 Claude Web 的最大视觉差距。
