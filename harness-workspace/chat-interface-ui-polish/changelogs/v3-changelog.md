# v3 Changelog

## 改动文件
- `src/components/ChatSidebar.tsx` — (1) Desktop sidebar breakpoint `md:flex` → `lg:flex` so sidebar hides on tablet 768-1024px; mobile overlay `md:hidden` → `lg:hidden` to match. (2) Added `cn()` import and converted 4 template literal className conditionals to `cn()` calls (lines 288, 311, 332, 379). (3) Added `active:scale-[0.98]` to nav buttons, collapsed session icon buttons, user menu button, and logout button. (4) Added `focus-visible:ring-2 focus-visible:ring-ck-accent` to nav buttons. (5) Nav placeholder items (Projects, Artifacts, Code) changed from `text-ck-t2` to `text-ck-t3` with `cursor-default` and `aria-disabled="true"` to indicate decorative/coming-soon status. (6) Logout button: added `ease-claude`, changed `rounded` → `rounded-lg` for consistency.
- `src/components/SessionContextBar.tsx` — Active chip styling changed from `bg-ck-info-bg text-ck-info-t border-transparent` to `bg-ck-bg3 text-ck-t1 border-ck-b2` for more subtle appearance matching warm neutral palette. Added `transition-colors ease-claude active:scale-[0.98]` to all chips.
- `src/components/chat/ChatInterfaceContextBar.tsx` — Hamburger menu button: `md:hidden` → `lg:hidden` to match tablet breakpoint change. Added `ease-claude active:scale-[0.98]` to hamburger and Skills buttons.
- `src/components/chat/ChatInterfaceComposer.tsx` — Attach button: added `active:scale-[0.98]` for press feedback consistency.

## 对应维度
- D1 (Alignment): Session context bar "default" chip is now subtle warm neutral (`bg-ck-bg3`) instead of prominent blue (`bg-ck-info-bg`). Nav placeholder items visually dimmed with `text-ck-t3` + `aria-disabled` to avoid implying they're functional.
- D2 (Consistency): No change needed (already 5/5).
- D3 (Responsive): Sidebar breakpoint raised from `md` (768px) to `lg` (1024px). Tablet 768-1024px now uses mobile layout (full-width chat + hamburger overlay), resolving the 34% sidebar ratio issue.
- D4a (CSS & Interaction): All interactive elements now have complete hover/focus/active states. Added `active:scale-[0.98]` to 10+ buttons, `focus-visible:ring` to nav buttons, `ease-claude` to logout/hamburger. Zero buttons without transition now.
- D4b (Functional): Verified: hamburger opens sidebar overlay on tablet, sidebar nav items show disabled state, all existing functionality preserved.
- D5 (Code Quality): All 4 template literal className conditionals in ChatSidebar.tsx converted to `cn()` calls. Added `cn` import. Logout button `rounded` → `rounded-lg` for consistency with other sidebar buttons.

## Props 接口变更
- 无

## 本轮重点
Tablet 断点优化 (sidebar 768px→1024px)、交互状态补全 (10+ 按钮)、className 工具统一 (cn())、Session context bar 降低视觉突兀度。目标: D3 12→15, D4a 8→10, D5 8→10, D1 28→29+。
