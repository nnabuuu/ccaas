# v1 Changelog

## 改动文件
- `src/components/ChatSidebar.tsx` — Major structural rewrite: added search input, "Chats" navigation section, "Starred" group for pinned sessions, improved session item styling (single-line truncation), improved user profile area with avatar color accent, popover menu with shadow. Removed border-r for cleaner sidebar-to-content transition. Added ck-scrollbar to session list. SVG icons replace HTML entities.
- `src/components/chat/ChatInterfaceComposer.tsx` — Updated placeholder to "How can I help you today?", disclaimer to English, send button uses proper SVG arrow icon, attach/stop labels in English. Quick suggestion pills now rounded-full with larger hit targets, sparkle icon opacity refined.
- `src/components/chat/ChatInterfaceEmptyState.tsx` — Heading text "What shall we think through?" (matches Claude Web), font-size 28px/32px with tracking-tight, increased bottom padding to pb-8.
- `src/components/SessionContextBar.tsx` — Reduced border opacity (border-ck-b2/50), tighter vertical padding (py-1.5).
- `src/components/chat/ChatInterfaceContextBar.tsx` — Mobile menu icon replaced with proper SVG hamburger. Skill button uses rounded-full pill style, transparent bg, English label "Skills".
- `src/components/QuickSuggestions.tsx` — Pill buttons now rounded-full, slightly larger text (12px), added hover:text-ck-t1 for better hover contrast.
- `src/components/ScrollToBottom.tsx` — aria-label updated to English.
- `src/components/MessageRenderer.tsx` — Action toolbar hover transition refined with duration-150 and ease-claude.
- `src/components/__tests__/ScrollToBottom.test.tsx` — Updated aria-label assertions to match English labels.

## 对应维度
- D1 (Alignment): Sidebar now has search, nav sections ("Chats"), grouped sessions (Starred/Recents/Yesterday/Previous 7 Days/Earlier), user profile with avatar — closely matching Claude Web landing page structure. Empty state heading matches Claude Web verbatim. Composer placeholder matches Claude Web.
- D2 (Consistency): All text labels consistently in English to match Claude Web. All sidebar icons are SVG (not HTML entities). Button pill shapes consistent (rounded-full for pills, rounded-lg for action buttons). Border opacity reduced for subtler separation.
- D3 (Mobile): Mobile hamburger now uses proper SVG icon. Sidebar drawer styling maintained. Context bar padding optimized.
- D4a (Polish): Action toolbar hover transition smoothed. Sidebar scrollbar uses ck-scrollbar class. User avatar uses accent color tint.
- D4b (Functional): Verified message send works — user bubble right-aligned, assistant serif text, action toolbar (copy/retry) appears on hover. Sidebar search filters sessions. New chat button works.
- D5 (Code): No new dependencies. All colors use CSS variables. No hardcoded colors. TypeScript check passes. All 76 tests pass.

## Props 接口变更
- `ChatSidebarProps` — No new required props. `isPinned` on `SidebarSession` now used for "Starred" grouping (was already in interface but unused).

## 本轮重点
Major sidebar structural overhaul — added search, navigation section, improved session grouping (Starred/Recents/etc.), user profile with accent avatar. Updated all text to English to match Claude Web. Improved empty state heading and composer placeholder to match Claude Web verbatim.
