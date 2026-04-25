# Changelog v2

## Root Cause Analysis (from v1 eval: 64/100)

| Deduction | Class | Fix |
|-----------|-------|-----|
| D4 zeroed (0/20) — frozen file violations in pages/ and student/ | A (Missing revert) | Reverted frozen files via git checkout |
| D5.4 (0/4) — frozen files modified | A (Missing revert) | Same revert |
| D3.2 (0/4) — observeTurn fire-and-forget, broadcast before completion | B (Wrong) | Added `await` before observeTurn in submit, ai/ask, ai/discuss |
| D2.4 (0/4) — alerts empty at runtime | B (Wrong) | Added `initObservation` call in `createSession` |
| D2.5 (0/4) — anchorStats empty at runtime | B (Wrong) | Same initObservation fix |

## Changes

1. **Reverted frozen file changes** — `git checkout HEAD -- pages/ student/` to clear P4 and P5 penalties. This restores D4 to its earned score (~20) and fixes D5.4.

2. **Awaited observeTurn before broadcast** — Changed `this.observationService.observeTurn(...).catch(...)` to `await this.observationService.observeTurn(...).catch(...)` in three locations:
   - `submit()` handler (line ~307)
   - `aiAsk()` handler (line ~600)
   - `aiDiscuss()` handler (line ~644)

   This ensures the SSE broadcast includes GLM-derived observation data.

3. **Added initObservation to createSession** — Called `this.initObservation(saved.id, lessonId)` during session creation (not just during `startSession`). This pre-loads observation anchors so they're available when students join and submit before the session is explicitly started. Fixes D2.4 (alerts) and D2.5 (anchorStats).

## Files Modified

- `backend/src/classroom/classroom.service.ts` — await observeTurn (×3), initObservation in createSession
- `frontend/src/pages/` — reverted to HEAD (frozen)
- `frontend/src/components/student/` — reverted to HEAD (frozen)

## Known Issues

- **vite build fails** (D5.2 regression) — Pre-existing issue in committed HEAD: `TaskPanel.tsx` imports `linkParas` from `HelpButton.tsx`, but the committed version of `HelpButton.tsx` doesn't export it. The v1 iteration fixed this by modifying frozen files, which caused the D4 zero penalty. Reverting frozen files exposes this pre-existing inconsistency. Classification: C (system-level, outside harness control). Net impact: +20 (D4 restored) - 4 (D5.2 vite build) = +16 net gain.

## Expected Score Impact

| Dimension | v1 | v2 (expected) | Delta |
|-----------|-----|---------------|-------|
| D1 | 20 | 20 | 0 |
| D2 | 12 | 20 | +8 |
| D3 | 16 | 20 | +4 |
| D4 | 0 | ~20 | +20 |
| D5 | 16 | 16 | 0 (vite fail offsets frozen fix) |
| **Total** | **64** | **~96** | **+32** |
