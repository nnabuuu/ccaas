# V7 Changelog

## Key Change: Send Button Position Fix (D7)

### Problem
`edu-platform/frontend/src/index.css` hides `[data-ck="composer-attach"]` with `display: none !important`. This collapses the `justify-between` flex layout in `ChatInterfaceComposer.tsx`, causing the Send button to appear at the LEFT edge of the composer instead of the RIGHT.

### Root Cause
The Composer bottom bar uses `flex justify-between` with two children: attach (left) and send (right). When attach is `display: none`, only one flex child remains, which defaults to the left position.

### Fix
Added CSS rule in `edu-platform/frontend/src/index.css`:
```css
[data-ck="composer-card"] button[aria-label="Send"],
[data-ck="composer-card"] button[aria-label="Stop generating"] {
  margin-left: auto;
}
```
This pushes the Send/Stop button to the right regardless of whether the attach button is visible.

### Verification
- Empty state: Send button at right ✓
- During agent execution: Stop button at right ✓
- After response: Send button at right ✓
- Sidebar collapsed: Send button at right ✓

### Files Modified
- `solutions/business/edu-platform/frontend/src/index.css` — Added `margin-left: auto` for Send/Stop buttons

### No Other Changes
V7 is a targeted D7 fix only. D1-D6 components (ToolActivityBlock, ToolGroup, etc.) are unchanged from v6.
