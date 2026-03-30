# v2 Changelog

## 改动文件
- `src/styles/prose.css` — [P0] 修复代码块换行渲染：将 `.ck-prose code` 选择器改为 `.ck-prose code:not(pre code)` 防止 inline code 样式（display:inline-flex）覆盖 code block；新增 `.ck-prose pre` 的 `white-space: pre` 和 `.ck-prose pre code` 重置规则（display:block, white-space:pre, 清除 border/bg/padding）
- `src/components/CodeBlock.tsx` — [P0] `<pre>` 和 `<code>` 元素增加 `whitespace-pre` Tailwind class，双重保障换行渲染
- `src/components/ChatSidebar.tsx` — [P1] 导航区从单一 "Chats" 扩展为 Chats/Projects/Artifacts/Code 四个导航项，匹配 Claude Web 侧栏结构；"Chats" 设为 active 状态（bg-ck-bg3 + text-ck-t1）；新增 IconProjects/IconArtifacts/IconCode SVG 图标组件；搜索输入框增加 `ease-claude` easing
- `src/components/chat/ChatInterfaceComposer.tsx` — [P2] Quick Suggestions 从 `rounded-full` pills 改为 `rounded-xl` icon+text 卡片按钮，新增 SuggestionIcon 组件提供 5 种旋转图标（pencil/book/code/compass/sparkle）匹配 Claude Web 的 Write/Learn/Code/Life stuff 风格；[P2] Send/Stop/Attach 按钮增加 `min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0` 移动端触摸目标
- `src/widgets/components/MiniOutline.tsx` — [P3] `paddingTop/paddingBottom` inline style 改为 Tailwind `py-[3px]`，仅保留动态 `paddingLeft` 的 inline style

## 对应维度
- D1 (Alignment): [P0] 代码块换行渲染修复 — 多行代码不再被压缩为连续流；[P1] Sidebar 导航从 1 项扩展为 4 项（Chats/Projects/Artifacts/Code）匹配 Claude Web；[P2] Quick Suggestions 改为 icon+text 卡片风格
- D2 (Consistency): 所有新增 SVG 图标使用 `text-ck-t2` / `text-ck-t1` design tokens；sidebar 搜索输入增加 `ease-claude`；MiniOutline 减少 1 个 inline style
- D3 (Responsive): Send/Stop/Attach 按钮移动端触摸目标从 32px 提升至 44px；Quick Suggestions `flex-wrap` 在 375px 正确换行
- D4a (Interaction): 搜索输入 `ease-claude` easing；Quick Suggestion 按钮保留 `focus-visible:ring-2`
- D4b (Functional): 认证成功，消息发送/接收正常，代码块正确渲染（含语法高亮+换行），Sidebar 实时更新，搜索过滤正常
- D5 (Code Quality): 0 个新 inline style（MiniOutline 减少 1 个）；76/76 测试通过；TypeScript 编译无错误

## Props 接口变更
- 无

## 本轮重点
修复代码块换行渲染（P0，影响 D1+D4b 两个维度），丰富 Sidebar 导航至 4 项匹配 Claude Web 结构（P1），Quick Suggestions 改为 icon+text 卡片按钮（P2），移动端触摸目标提升至 44px（P2）。
