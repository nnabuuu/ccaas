# Changelog v1

## Changes

### Phase 1: Event Pipeline Hardening
- Made `addSystemEvent` async with `await` on DB persist (no longer fire-and-forget)
- Added `submit()` → `observeTurn()` integration with enriched systemContext (real exerciseCorrectRate from student submission)
- Added `step_complete` system event emission when student advances to next task
- Updated `aiAsk` and `aiDiscuss` observeTurn calls to pass real exerciseCorrectRate from latest submission

### Phase 2: State Derivation Enhancement
- Extracted magic number thresholds to named constants: `IDLE_THRESHOLD_MS`, `RECENT_WINDOW_MS`, `STRUGGLE_EVENT_COUNT`, `CRUISING_CORRECT_RATE`, `CRUISING_MAX_MESSAGES`, `PROGRESS_ANCHOR_MIN`
- Added K-anchor (knowledge anchor) awareness in `deriveStatus`:
  - If K-anchor events >= PROGRESS_ANCHOR_MIN and K > M, single misconception is counterbalanced → 'active' instead of 'struggling'
  - If K-anchors outweigh 3+ misconceptions → downgraded from 'stuck' to 'struggling'
- `generateAlerts` now uses dynamic idle threshold in message text (`${idleMinutes} 分钟`)

### Phase 3: Real-time Push
- Verified: `getState()` already includes observation data (logs, alerts, anchorStats, anchors) in broadcast payload
- Verified: heartbeat sends SSE comment only (`: heartbeat\n\n`), does NOT reset observation state
- Verified: `useTeacherStream` in frontend receives observation data via SSE `onmessage`

### Phase 4: Teacher Observation Panel
- Added observation CSS classes per spec: `.obs-dot`, `.obs-dot-ok`, `.obs-dot-warn`, `.obs-dot-alert`, `.obs-anchor-bar`, `.obs-anchor-fill`, `.obs-alert-badge`, `.obs-alert-urgent`, `.obs-alert-warning`, `.obs-alert-info`
- ObservationPanel, GlanceView, AlertView components already existed with glance dots, anchor progress bars, misconception sort, and alert badges

### Phase 5: Test Extension
- Added 6 new test cases (33 → 39 total):
  1. `addSystemEvent persists event to DB synchronously (await)` — verifies sync DB persistence
  2. `K-anchors outweigh single M-anchor → active` — mixed signal handling
  3. `mixed K+M but K doesn't outweigh → struggling` — insufficient K-anchor counterbalance
  4. `stuck downgraded to struggling when K outweighs 3+ M` — mixed signal downgrade
  5. `distinct students with K and M mixed events` — cross-student anchor counting
  6. `urgent and warn severity in same session` — multi-severity alert generation

## Files Modified
- `backend/src/classroom/observation.service.ts` — async addSystemEvent, named constants, K-anchor deriveStatus logic
- `backend/src/classroom/observation.service.spec.ts` — 6 new test cases
- `backend/src/classroom/classroom.service.ts` — submit→observeTurn, step_complete events, enriched exerciseCorrectRate
- `frontend/src/styles/teacher.css` — observation dot/bar/badge CSS classes

## Validation Results
- `npx nest build` — PASS
- `npx jest observation --no-coverage` — 39/39 PASS
- `npx tsc --noEmit` — PASS (frontend)
- `npx vite build` — PASS (frontend)

## Known Issues
- `observeTurn` after `submit()` is still fire-and-forget (not awaited) to avoid blocking the HTTP response — observation data may lag by one broadcast cycle
- Without ZHIPU_API_KEY, LLM-based observation events won't be generated (only system events work)
