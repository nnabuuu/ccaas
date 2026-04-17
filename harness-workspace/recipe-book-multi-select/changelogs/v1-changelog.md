# v1 Changelog

## Changes
- Added `staging` state array and `flashId` state to RecipePicker
- Space key toggles items in/out of staging (with `e.preventDefault()`)
- Enter commits all staged items + active item, then closes picker
- Escape commits all staged items then closes (never discards)
- Overlay click-outside commits staging if any, then closes
- Single-select backward compat: Enter with no staging = select + close
- Staging area UI with pills (icon + name + × remove) between search and list
- Staging count text "已选 N 个" in staging area
- List items get `.staged` class with green "✓ 已选" badge
- Flash-green CSS animation on Space-add (400ms)
- Updated placeholder text: reflects staging count when items staged
- All new CSS uses design tokens (`var(--blue-bg)`, `var(--blue)`, `var(--border)`, `var(--t3)`)
- `tsc --noEmit` passes, `vite build` succeeds
- No frozen packages modified
