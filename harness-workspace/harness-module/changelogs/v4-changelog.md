# v4 Changelog — @kedge-agentic/harness Module

## Summary
Resilience improvements: fail-fast on consecutive failures, iteration status persistence, step reconstruction from DB.

## Changes

### ExitConditions: maxConsecutiveFailures (D3)
- **File**: `packages/harness/src/core/interfaces.ts`
- Added optional `maxConsecutiveFailures` field to `ExitConditions` (default: 3)
- **File**: `packages/harness/src/core/exit-evaluator.ts`
- Added consecutive failure check: if last N iterations all have `status: 'failed'`, exit early
- Checked before score-based conditions (fail-fast takes priority)

### ExitEvaluator tests (D6)
- **File**: `packages/harness/src/core/exit-evaluator.spec.ts`
- 4 new tests: default 3 failures, 2 failures not enough, non-consecutive failures, custom value

### Test results
- Total: 45 tests passing (was 41 in v3)
- `tsc --noEmit`: zero errors across harness, article-analyzer backend, and frontend

## Article-Analyzer Solution Changes

### SqliteRunStore.mapIterationRow — step reconstruction (P9 fix)
- **File**: `solutions/business/article-analyzer/backend/src/harness/sqlite-run-store.ts`
- Was: `steps: []` — all step data lost on DB reload
- Now: queries `step_outputs` table and reconstructs `StepRecord[]`
- Enables `/harness/runs/:runId/iterations/:n/outputs` endpoint to return data

### SqliteRunStore — iteration status persistence (P9 fix)
- **File**: `solutions/business/article-analyzer/backend/src/harness/sqlite-run-store.ts`
- `appendIteration` now stores `iteration.status` to DB
- `mapIterationRow` reads status back (was hardcoded `'completed'`)
- **File**: `solutions/business/article-analyzer/backend/src/database/database.module.ts`
- Added `status` column to `iterations` table
- Migration: `ALTER TABLE iterations ADD COLUMN status` for existing DBs

### SqliteRunStore.getRun — summary without finalScore
- Previously: `summary` was `undefined` when `final_score` was null (no scores)
- Now: summary created when any of `final_score`, `exit_reason`, `total_iterations` exist
- Exit reason visible even when all iterations failed with no scores

### CcaasSessionProvider — error propagation
- **File**: `solutions/business/article-analyzer/backend/src/harness/ccaas-session-provider.ts`
- Was: catches all errors silently, returns `text: '{}', finishReason: 'error'`
- Now: throws on connection errors with logged error messages
- Orchestrator marks steps as `failed` → triggers consecutive failure exit

## Browser-Verified Behavior
- New run with CCAAS down: exits after 3 iterations (was 10)
- Run progress shows "Exit: 3 consecutive iterations failed"
- Iteration outputs endpoint returns reconstructed step data
