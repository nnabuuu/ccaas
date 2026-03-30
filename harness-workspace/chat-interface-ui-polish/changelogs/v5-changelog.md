# v5 Changelog

## 改动文件

### Core (`packages/chat-interface/src/`)

- `hooks/useSessionList.ts` — 新增 periodic polling 机制：空列表时 5s 间隔，有会话时 30s 间隔；新增 tab focus 自动刷新。修复 sidebar 会话列表不更新的 D4b blocker。
- `App.tsx` — 减少 session refresh 延迟（1000→500ms, 2000→800ms），新增 3s backup refresh，确保首条消息后 sidebar 及时更新。
- `components/ChatSidebar.tsx:305` — 三点菜单 dropdown `border` → `border-[0.5px]`，统一边框宽度。
- `components/QuickSuggestions.tsx` — suggestion chip `border` → `border-[0.5px]`。
- `components/SessionContextBar.tsx` — context chip `border` → `border-[0.5px]`。
- `components/CodeBlock.tsx` — 外层容器 `border` → `border-[0.5px]`；header separator `border-b` → `border-b-[0.5px] border-ck-b2`（更轻的分隔线）。
- `components/FileCard.tsx` — 所有 `border border-ck-b1` → `border-[0.5px] border-ck-b1`（replace_all）。
- `components/MermaidBlock.tsx` — 所有 `border border-ck-b1` → `border-[0.5px] border-ck-b1`（replace_all）。
- `components/ScrollToBottom.tsx` — FAB 按钮 `border` → `border-[0.5px]`。
- `components/ApiKeyLogin.tsx` — 卡片和 3 个 input 的 `border` → `border-[0.5px]`（replace_all，4 处）。
- `components/chat/ChatInterfaceComposer.tsx` — empty state suggestion button `border` → `border-[0.5px]`。
- `components/WidgetRenderer.tsx` — unknown widget fallback `border` → `border-[0.5px]`。
- `widgets/components/ActionRow.tsx` — 2 处 border → `border-[0.5px]`。
- `widgets/components/BarList.tsx` — 1 处 border → `border-[0.5px]`。
- `widgets/components/FormCollect.tsx` — 3 处 border → `border-[0.5px]`。
- `widgets/components/InfoCard.tsx` — 1 处 border → `border-[0.5px]`。
- `widgets/components/MetricDashboard.tsx` — 1 处 border → `border-[0.5px]`。
- `widgets/components/ReviewPanel.tsx` — 2 处 border → `border-[0.5px]`。
- `widgets/components/StepWizard.tsx` — 4 处 border → `border-[0.5px]`。
- `widgets/components/TreeSelector.tsx` — 1 处 border → `border-[0.5px]`。

### Solution (`solutions/business/edu-platform/frontend/src/`)

- `components/ClassSwitcher.tsx:36` — trigger button `border` → `border-[0.5px]`，新增 `transition-colors ease-claude active:scale-[0.98]` 交互反馈。

## 对应维度

- **D1 (Design System Alignment)**: Context chips、QuickSuggestions、ClassSwitcher 按钮边框统一为 0.5px，符合设计系统 "hairline borders" 规范。
- **D2 (Consistency)**: 全面统一边框宽度。排查并修复了 20+ 个文件中 `border`（1px）与 `border-[0.5px]` 混用问题。现在所有非 composer 的 decorative border 统一使用 0.5px。
- **D3 (Responsive)**: 无变更（v4 已达满分区间）。
- **D4a (CSS Polish)**: CodeBlock header separator 改用 `border-ck-b2`（更轻的颜色），视觉层次更清晰。ClassSwitcher 新增 hover/active 微交互。
- **D4b (Functional)**: **修复 sidebar 会话列表不更新的 blocker**。新增 periodic polling + visibility change refresh + faster post-message refresh + backup refresh。验证：发送消息后 sidebar "Recents" 下正确显示会话。
- **D5 (Code Quality)**: 无新依赖，无 !important，无硬编码颜色。所有变更使用 `ck-` 前缀 Tailwind 类。

## 验证结果

- TypeScript typecheck: PASS（0 errors）
- Vitest: PASS（81 tests, 11 files, 0 failures）
- Core (localhost:5190):
  - Desktop 1440x900: sidebar 展开，"Recents" 分组可见，会话列表正常 ✅
  - Mobile 375x812: sidebar 自动隐藏，hamburger 菜单可见 ✅
  - 消息收发正常，stop button 工作 ✅
- Edu-Platform (localhost:5290):
  - Desktop 1440x900: context chips (八(2)班/数学/树人中学) 可见，ClassSwitcher 可见 ✅
  - Mobile 375x812: context chips 缩写显示，布局正常 ✅

## Props 接口变更

无
