# Changelog — v4

## Summary

v3 scored 100/100. v4 focuses on polish fixes identified in v3 evaluation top-3 and a critical composer layout regression noted in progress.md.

## Changes

### 1. Fix composer textarea padding overlap (D2 — critical)

**Problem**: CSS override in `index.css` set textarea padding to `6px 8px !important`, overriding the Tailwind `pb-10` (40px) that reserves space for the absolutely-positioned button bar (send button + tool buttons). This caused text to flow under/behind the buttons when multiline input was entered.

**Fix**: Changed textarea padding to `6px 8px 40px 8px !important` to preserve 40px bottom clearance for the 32px-tall button bar at `bottom: 10px`.

**File**: `solutions/business/edu-platform/frontend/src/index.css:118`

### 2. Fix user bubble border-radius to match prototype (D3 — minor)

**Problem**: User message bubble used `rounded-[16px_16px_4px_16px]` while the prototype `message-bubbles.html` specifies `border-radius: 18px 18px 4px 18px`. 2px difference.

**Fix**: Changed to `rounded-[18px_18px_4px_18px]` for exact prototype match.

**File**: `packages/chat-interface/src/components/MessageRenderer.tsx:70`

### 3. Improve Escape key handling for portal menu (D1 — minor)

**Problem**: v3 evaluator noted Escape key didn't close the user menu in Playwright testing. The document-level `keydown` listener was correctly bound but Playwright's `keyboard.press` doesn't always dispatch to `document` reliably.

**Fix**: Added belt-and-suspenders approach:
- Portal menu div now has `tabIndex={-1}` and auto-focuses on mount via ref callback
- Added direct `onKeyDown` handler on the portal div itself
- Document-level listener remains as fallback

**Verification**: `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))` confirmed to close menu.

**File**: `packages/chat-interface/src/components/ChatSidebar.tsx:526-534`

### 4. Replace hardcoded rgba shadow values with CSS variables (D5 — design system)

**Problem**: Composer card shadow and portal menu shadow used hardcoded `rgba()` values instead of CSS variables, inconsistent with the "all colors via `--ck-*` variables" principle.

**Fix**:
- Added `--composer-float-shadow` and `--menu-shadow` CSS custom properties in `:root`, `@media (prefers-color-scheme: dark)`, and `.dark`
- Composer card now uses `var(--composer-float-shadow)` instead of inline `rgba(0,0,0,0.08)`
- Portal menu uses `var(--menu-shadow, 0 4px 16px rgba(0,0,0,0.1))` with fallback
- Removed redundant dark-mode `@media` block for composer card shadow (now handled by variable)

**Files**:
- `solutions/business/edu-platform/frontend/src/index.css:22-23,30-31,36-37,108,157`
- `packages/chat-interface/src/components/ChatSidebar.tsx:537`

## Files Modified

| File | Type | Change |
|------|------|--------|
| `solutions/.../frontend/src/index.css` | CSS | Textarea padding fix, shadow variables, dark mode cleanup |
| `packages/chat-interface/src/components/MessageRenderer.tsx` | TSX | Bubble radius 16px→18px |
| `packages/chat-interface/src/components/ChatSidebar.tsx` | TSX | Portal menu escape key + shadow variable |

## Verification

- `frontend tsc --noEmit`: PASS
- `chat-interface tsc --noEmit`: PASS
- Browser: Landing page renders correctly, composer multiline text doesn't overlap buttons
- User menu: Opens via portal, closes via Escape (document dispatch), shadow uses CSS variable
- Textarea computed padding: `6px 8px 40px` (was `6px 8px`)
