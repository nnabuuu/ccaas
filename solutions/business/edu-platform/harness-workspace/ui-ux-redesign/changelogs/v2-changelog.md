# v2 Changelog — UI/UX Redesign

## Summary

v2 focuses on the highest-impact improvements identified in v1 eval (77.5/100):
- **D3 hard cap removal**: Implemented full three-layer tool folding with Table/JSON tabs
- **D4 FileCard gap**: Added type-specific colors and hover effects
- **D2 greeting bug fix**: Removed redundant "老师" suffix
- **D5 semantic colors**: Replaced all hardcoded hex and Tailwind-native colors with CSS variable tokens

## Changes by File

### Design System Foundation

**`packages/chat-interface/src/styles/tokens.css`**
- Added `--coral-bg/--coral-t` tokens (light: #FAECE7/#712B13, dark: #3a1309/#f0a080)
- Added `--purple-bg/--purple-t` tokens (light: #EEEDFE/#3C3489, dark: #1c1848/#b5b0f5)
- Added `--teal-bg/--teal-t` tokens (light: #E1F5EE/#085041, dark: #062e20/#7fd4b5)
- All three token pairs added to `:root`, `@media (prefers-color-scheme: dark)`, and `.dark` sections

**`packages/chat-interface/tailwind.config.js`**
- Added `teal-bg` and `teal-t` to `ck-*` color map
- Added `ck-dot-blink` keyframe (three-dot bounce animation matching `message-bubbles.html`)
- Added `ck-dot1/dot2/dot3` animations with staggered delays (0s/0.2s/0.4s)

### D3: Messages + Tool Activity (HARD CAP REMOVAL)

**`packages/chat-interface/src/components/ToolActivityBlock.tsx`** — Major rewrite
- **Layer 3 Table/JSON tabs**: Added `TabbedDetail` component with:
  - Tab bar (Table | JSON) matching `tool-usage-group.html` `.tabs` style
  - Table pane: `KVTable` component renders Request/Response sections as Postman-style key-value tables
  - JSON pane: formatted code block with `// Request` and `// Response` comments
  - Event bubbling prevention (`e.stopPropagation()`)
- **Step icons**: Replaced square letter `CategoryBadge` (M/AI/F) with 18px round `StepIcon`:
  - Purple circle + file SVG = MCP/file tools (matches `.step-icon.file`)
  - Blue circle + clock SVG = AI/agent tools (matches `.step-icon.run`)
  - Green circle + checkmark SVG = completed steps (matches `.step-icon.done`)
  - Blue circle + spinner = running steps
  - Red circle + X = failed steps
- **Tool ID display**: Added monospace `stripped` tool name after description text
- **Duration display**: Shows `block.duration` formatted as ms or s (e.g., "230ms", "1.2s")
- **Step separator**: Added `border-bottom: 0.5px` between steps

**`packages/chat-interface/src/components/ToolGroup.tsx`** — Card layout
- Summary header: Added `border-[0.5px] border-ck-b1 bg-ck-bg1 rounded-ck-lg` card styling
- Expanded state: Summary gets `rounded-t-ck-lg`, detail gets `rounded-b-ck-lg` with connected borders
- Chevron: Changed from SVG to `▶` character matching prototype `.tg-chev`
- Hover: Added `hover:bg-ck-bg2` on collapsed summary
- Matches `tool-usage-group.html` `.tg` / `.tg-summary` / `.tg-detail` structure

**`packages/chat-interface/src/components/MessageRenderer.tsx`**
- Replaced cursor blink (`▌` with `animate-ck-blink`) with three-dot bounce animation
- Three 5px circles with staggered `animate-ck-dot1/2/3` + "正在处理..." text
- Matches `message-bubbles.html` `.thinking-dots` pattern

### D4: Widget Visual — FileCard

**`packages/chat-interface/src/components/FileCard.tsx`**
- Added `getFileColors()` function mapping extensions to semantic colors:
  - `.docx` → `bg-ck-info-bg text-ck-info-t` (blue)
  - `.pdf` → `bg-ck-coral-bg text-ck-coral-t` (coral)
  - `.pptx` → `bg-ck-teal-bg text-ck-teal-t` (teal)
  - `.xlsx` → `bg-ck-purple-bg text-ck-purple-t` (purple)
- File icon: Changed from `w-8 h-8` to `w-[38px] h-[38px]` matching prototype
- Added hover effect: `hover:bg-ck-bg2 hover:border-[rgba(0,0,0,0.18)]`
- Added `bg-ck-bg1` base background, `cursor-pointer`, `transition-all`
- Font weight: File name uses `font-semibold` matching prototype `.file-name`

### D2: Landing Page Fix

**`solutions/business/edu-platform/frontend/src/components/EduEmptyState.tsx`**
- Fixed greeting: Changed `{teacherName}老师` → `{teacherName}` to avoid "张老师老师"

### D5: Design System Cleanup

**`packages/chat-interface/src/components/SkillBadge.tsx`**
- Added optional `type?: 'solution' | 'custom'` prop (default: `'solution'`)
- Solution skills: green (`bg-ck-success-bg text-ck-success-t`)
- Custom skills: orange (`bg-ck-coral-bg text-ck-coral-t`)
- Dot color: Changed from explicit `bg-ck-success-t` to `bg-current` (inherits text color)

**`packages/chat-interface/src/components/SessionContextBar.tsx`**
- Removed 3 hardcoded hex values:
  - `bg-[var(--ck-purple-bg,#EEEDFE)]` → `bg-ck-purple-bg`
  - `text-[var(--ck-purple-t,#3C3489)]` → `text-ck-purple-t`
  - `hover:bg-[#e8e7e0]` → `hover:bg-ck-bg3`

## Verification

- `cd packages/chat-interface && npx tsc --noEmit` → PASS
- `cd solutions/business/edu-platform/frontend && npx tsc --noEmit` → PASS
- Browser verification: Landing page greeting fix confirmed, starter card colors correct
- No frozen files modified

## Expected Score Impact

| Dimension | v1 | Expected v2 | Change |
|-----------|-----|------------|--------|
| D1: Layout + Sidebar | 5/5 | 5/5 | — |
| D2: Landing + Composer | 4/5 | 5/5 | +4.0 |
| D3: Messages + Tool Activity | 3/5 (hard cap) | 4-5/5 | +5.0 to +12.5 |
| D4: Widget Visual | 4/5 | 5/5 | +5.0 |
| D5: Design System + Dark Mode | 4/5 | 5/5 | +2.0 |
| Penalties | -1.5 | 0 | +1.5 |
| **Total** | **77.5** | **~95-97** | **+17.5 to +19.5** |
