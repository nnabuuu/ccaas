# Changelog v4

## Changes
- Fixed `initObservation` in classroom.service.ts to fall back to reading `observationAnchors` from the filesystem manifest when the DB-stored `manifestJson` lacks them
- Added `fs` and `path` imports to classroom.service.ts for filesystem fallback
- Root cause: `seedLessons` in lesson.service.ts only backfills `lessonType` for existing lessons, never updates `manifestJson` — so DB records seeded before `observationAnchors` was added remain stale

## Files Modified
- `backend/src/classroom/classroom.service.ts` — filesystem fallback in `initObservation`, added fs/path imports

## Impact
This single fix unblocks:
- D2.5: `computeAnchorStats` returns populated data (anchors loaded → anchorStats non-empty)
- D4.2: Knowledge anchor progress bars render (anchorStats has data)
- D4.3: Misconception list renders (anchorStats has data)
Expected improvement: +12 points (88 → 100)

## Known Issues
- None — all 4 validation steps pass (nest build, tsc, jest 39/39, vite build)
