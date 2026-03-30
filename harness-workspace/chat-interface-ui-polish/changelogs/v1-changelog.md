# v1 Changelog (v4 Criteria)

## 改动文件
- `src/components/ChatSidebar.tsx` — Removed disabled navigation items (Projects/Artifacts/Code) that were Claude Web-specific and not part of this product. Only "Chats" nav remains. Removed unused icon components (IconProjects, IconArtifacts, IconCode). Added subtle right border (border-r border-ck-b2/50) to desktop sidebar for cleaner separation from main content.
- `src/App.tsx` — Improved mock data for product feature components: context chips now show ["default", "数学", "高一"] instead of just ["default"]; quick suggestions updated to education-domain content ["备课助手", "出题组卷", "学情分析", "教学设计"].
- `src/components/chat/ChatInterfaceEmptyState.tsx` — Increased bottom padding (pb-8 → pb-10) and added leading-tight to title for better vertical rhythm.
- `src/components/ApiKeyLogin.tsx` — Added `ease-claude` easing and `active:scale-[0.98]` press feedback to login/connect buttons for interaction consistency.
- `src/widgets/components/StepWizard.tsx` — Added `ease-claude` and `active:scale-[0.98]` to all navigation buttons (Previous/Next/Confirm) for consistent interaction feel.
- `src/widgets/components/ReviewPanel.tsx` — Added `ease-claude` and `active:scale-[0.98]` to all interactive buttons (item navigation, action buttons, submit) for consistent interaction feel.
- `src/widgets/components/FormCollect.tsx` — Added `ease-claude` and `active:scale-[0.98]` to toggle buttons for consistent interaction feel.
- `src/widgets/components/ActionRow.tsx` — Added `ease-claude` and `active:scale-[0.98]` to action buttons for consistent interaction feel.

## 对应维度
- D1 (Alignment): Removed disabled non-product navigation items → clears D1 hard cap (was max 4/5, now eligible for 5/5). Improved product feature component visibility with meaningful mock data (context chips, quick suggestions).
- D2 (Consistency): All widget buttons now consistently use `ease-claude` easing and `active:scale-[0.98]` press feedback, matching core component interaction patterns.
- D3 (Mobile): No changes needed — mobile layout already properly handles sidebar (overlay at <1024px), touch targets ≥44px, responsive text wrapping.
- D4a (Polish): Improved interaction consistency across all widget components — every button now has hover/active/focus states with consistent easing.
- D4b (Functional): Verified: login works, message send/receive works, sidebar shows session under "Recents" group, collapsed/expanded toggle works, mobile overlay works. Context chips ("default", "数学", "高一") render correctly. Quick suggestions ("备课助手" etc.) render correctly.
- D5 (Code): No new dependencies. Zero hardcoded colors in TSX. Zero !important (all in prefers-reduced-motion block). All inline styles are for dynamic values (widths/colors from data). TypeScript check passes. All 76 tests pass.

## Props 接口变更
- 无

## 本轮重点
移除禁用的 Claude Web 独有导航项 (Projects/Artifacts/Code)，清除 D1 产品一致性 hard cap；用有意义的教育领域 mock 数据展示产品特性组件；统一所有 widget 按钮的交互反馈 (ease-claude + active:scale)。
