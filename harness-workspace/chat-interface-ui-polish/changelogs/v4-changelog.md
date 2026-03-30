# V4 Changelog — Chat Interface UI Polish

## Summary
Focused on v3 eval deductions: D1 (context bar empty state on desktop, chip active styling), D4b (sidebar border subtlety), D3/D4a (QuickSuggestions polish), and edu-platform LoginPage design-system compliance. Also fixed a TS build error blocking edu-platform consumption.

## Changes by File

### Core: `src/components/SessionContextBar.tsx`
- **Fixed empty context bar on desktop**: When `hideSkillToggle=true` and no chips, the context bar rendered as an empty border strip on desktop because `leading` (hamburger with `lg:hidden`) was truthy. Added `desktopHidden` logic: if no chips AND no trailing, the entire bar gets `lg:hidden` so it only appears on mobile (where the hamburger is needed).
- **Fixed chip active state**: Active chip was using `bg-ck-bg3 text-ck-t2` which didn't visually distinguish from inactive. Changed to `bg-ck-info-bg text-ck-info-t border-transparent` — uses the design system's info semantic color for clear active indication.
- **Null guard on empty state**: Added `if (chips.length === 0 && !leading && !trailing) return null` for complete empty scenario.

### Core: `src/components/chat/ChatInterfaceContextBar.tsx`
- **Fixed trailing prop truthiness**: The previous code always passed a React Fragment as `trailing`, which is truthy even when empty. Now computes `hasTrailing` from actual content (`!!trailing || showSkillToggle`) and passes `undefined` when nothing to show. This prevents SessionContextBar from rendering an empty trailing div.

### Core: `src/components/ChatSidebar.tsx`
- **Adjusted border opacity**: Changed sidebar right border and user menu separator from `border-ck-b2/30` to `border-ck-b2/50` for slightly more visible but still subtle separation. The 30% was too invisible.

### Core: `src/components/QuickSuggestions.tsx`
- **Matched design system tokens**: Ensured styling uses `text-[11px]`, `rounded-xl`, `border-ck-b1`, `ease-claude`, `active:scale-[0.98]`, `focus-visible:ring-2 focus-visible:ring-ck-accent` for full design-system compliance.
- **Mobile touch targets**: `min-h-[36px] sm:min-h-0` for proper mobile tap targets.
- **Responsive padding**: `px-3 sm:px-4` on container.

### Core: `src/context/ChatCoreContext.tsx`
- **Fixed TS2352 build error**: Changed `msg as Record<string, unknown>` to `msg as unknown as Record<string, unknown>` to satisfy strict type check when accessing `contentBlocks` property. This unblocked the chat-interface library build needed by edu-platform.

### Edu-Platform: `solutions/business/edu-platform/frontend/src/components/LoginPage.tsx`
- **Migrated all inline styles to Tailwind ck- classes**: Removed all `style={{}}` props and the `<style>` block with `.edu-login-input` CSS class. Every visual property now uses design-system tokens:
  - Background: `bg-ck-bg2` (page), `bg-ck-bg1` (card)
  - Borders: `border-[0.5px] border-ck-b1` (inputs, card)
  - Corners: `rounded-ck` (inputs, button), `rounded-ck-lg` (card)
  - Text: `text-ck-t1`, `text-ck-t3`, `placeholder:text-ck-t3`
  - Focus: `focus:border-ck-info-t`
  - Error: `text-ck-danger-t`
  - Button: `bg-ck-t1 text-ck-bg1 border-ck-t1` (primary), `text-ck-info-t` (link)
  - Extracted shared `inputClass` constant for DRY input styling

## 对应维度
- **D1 (Alignment)**: Empty context bar no longer renders on desktop when no chips/skills → eliminates empty strip. Chip active state uses semantic info color instead of barely-distinguishable background.
- **D2 (Consistency)**: QuickSuggestions uses same interaction patterns (ease-claude, active:scale, focus-visible ring) as all other interactive elements.
- **D3 (Mobile)**: QuickSuggestions has 36px min-height touch targets on mobile. Context bar hamburger still works on mobile even when bar is hidden on desktop.
- **D4a (Polish)**: Border opacity tuned from 30% to 50% for better visibility while remaining subtle. Chip active/inactive states have clear visual hierarchy.
- **D4b (Functional)**: Trailing content logic prevents empty elements from rendering. Edu-platform login page fully functional with design-system tokens.
- **D5 (Code)**: Zero inline styles in LoginPage (was the main offender). No new dependencies. TS build error fixed. All 81 tests pass.

## Props 接口变更
- 无（本轮仅修改内部实现逻辑，无新增 props）

## Verification
- `npx tsc --noEmit` — 0 errors (both core and edu-platform)
- `npx vitest run` — all 81 tests pass
- `npm run build` (chat-interface lib) — builds successfully
- Browser tested: core desktop (1440x900), core mobile (375x812), edu-platform desktop (1440x900), edu-platform login

## Screenshots
- `screenshots/v4/desktop-main.png` — Core desktop 1440x900, clean empty state, no empty context bar
- `screenshots/v4/mobile-main.png` — Core mobile 375x812, hamburger visible, action toolbar present
- `screenshots/v4/edu-desktop.png` — Edu-platform 1440x900, context chips (八(2)班/数学/树人中学) with active state
- `screenshots/v4/edu-login.png` — Edu-platform login page, fully tokenized with ck- classes

## 本轮重点
修复桌面端空 context bar 条带（D1），用 info 语义色区分 chip 激活态（D1），调整 sidebar 边框可见度（D4a），统一 QuickSuggestions 交互一致性（D2），并将教育平台 LoginPage 全面迁移至 Tailwind ck- 设计令牌（D5 + Edu 质量）。
