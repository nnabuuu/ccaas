# v2 Changelog — SkillPanel Rebuild

## Summary
v2 focuses on fixing the 3 issues identified in v1 evaluation (score: 86/100):
1. **[Critical]** Mobile drawer overlay blocking SkillPanel (D4: 3/5 → target 5/5)
2. **[Minor]** Border widths 1px → 0.5px to match HTML prototype (D1: 4/5 → target 5/5)
3. **[Minor]** Toggle enable/disable toast feedback (D3: 4/5 → target 5/5)

## Changes

### 1. Fix: Mobile drawer overlay blocking SkillPanel
**File**: `packages/chat-interface/src/components/ChatSidebar.tsx`
**Lines**: 294, 307

**Problem**: When clicking Skills from mobile drawer, the drawer overlay (z-40 backdrop + z-50 drawer) stayed open and blocked all SkillPanel interaction. Users could not click tabs, close button, or any skill card buttons.

**Fix**: Changed both Skills button `onClick` handlers (expanded and collapsed states) from:
```tsx
onClick={onSkillsClick}
```
to:
```tsx
onClick={() => { onMobileClose?.(); onSkillsClick?.() }}
```

This ensures the mobile drawer closes before the SkillPanel opens. On desktop, `onMobileClose` is a no-op (mobile drawer is hidden via `lg:hidden`), so no side effects.

**Verification**: Tested on 375x812 viewport — drawer closes, SkillPanel fully interactive, close button works, chat restores correctly.

### 2. Fix: Border widths from 1px to 0.5px
**File**: `packages/chat-interface/src/components/SkillPanel.tsx`
**Lines**: 48, 102, 154, 175, 303

**Problem**: HTML prototype uses `.5px` borders throughout (`.sp-frame`, `.sp-card`, `.sp-tabs`, `.sp-card-actions button`). v1 implementation used Tailwind default `border` (1px), making borders visually thicker than the prototype.

**Fix**: Changed all `border` classes to `border-[0.5px]`:
- Line 48: Outer frame `border border-ck-b1` → `border-[0.5px] border-ck-b1`
- Line 102: Tab bar `border-b border-ck-b1` → `border-b-[0.5px] border-ck-b1`
- Line 154: CardBtn `border` → `border-[0.5px]`
- Line 175: SkillCard `border border-ck-b1` → `border-[0.5px] border-ck-b1`
- Line 303: "新建 Skill" button `border border-ck-b1` → `border-[0.5px] border-ck-b1`

### 3. Feature: Toggle toast feedback
**File**: `packages/chat-interface/src/components/SkillPanel.tsx`
**Lines**: 243, 265

**Problem**: Clicking "停用" or "启用" buttons triggered `toggleSkill` but gave no visual feedback to the user.

**Fix**: Added `toast.success()` calls after toggle:
- "停用" button: `toast.success(\`已停用「${skill.name}」\`)`
- "启用" button: `toast.success(\`已启用「${skill.name}」\`)`

**Test fix**: Updated `SkillPanel.test.tsx` mock to include `toast.success: vi.fn()` (was missing, causing unhandled error).

## Files Changed
| File | Change |
|------|--------|
| `packages/chat-interface/src/components/ChatSidebar.tsx` | Skills onClick → close mobile drawer first |
| `packages/chat-interface/src/components/SkillPanel.tsx` | border-[0.5px] + toggle toast feedback |
| `packages/chat-interface/src/components/__tests__/SkillPanel.test.tsx` | Add toast.success to mock |

## Verification
- **TypeScript**: `npx tsc --noEmit` — PASS
- **Tests**: `npx vitest run` — 81 tests, 11 files, all PASS
- **Core (localhost:5190)**: Desktop + Mobile verified
- **Edu-Platform (localhost:5290)**: Desktop verified, 3 skills displayed correctly

## Screenshots
- `screenshots/v2/skill-panel-desktop.png` — Core desktop view
- `screenshots/v2/sidebar-skills-expanded.png` — Sidebar with Skills active
- `screenshots/v2/skill-panel-mobile.png` — Mobile 375x812
- `screenshots/v2/edu-desktop.png` — Edu-platform desktop view
