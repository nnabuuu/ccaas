# v4 Changelog — Article Analyzer Solution

## Summary
Resilience and data integrity improvements discovered through browser testing of actual runs.

## Root Cause Analysis
Browser testing revealed: run `run_1775717476851_so0uj4` completed 10 iterations with all null data (0 scores, 0 tokens, 33ms/iteration). Root cause chain:
1. CCAAS backend unreachable → `CcaasSessionProvider.waitForCompletion` catches error silently → returns `text: '{}'`
2. `extractOutput('{}')` → all required fields become null
3. `orchestrator.extractScore()` finds no score → never triggers exit conditions
4. Run exhausts all 10 maxIterations with zero useful data
5. `SqliteRunStore.mapIterationRow` returns `steps: []` and hardcodes `status: 'completed'` → exit-evaluator can't detect failures on DB reload

## Changes

### CcaasSessionProvider error propagation [P7 fix]
- **File**: `ccaas-session-provider.ts`
- Throw on HTTP errors and connection failures instead of returning empty data
- Added logger for all error cases
- Orchestrator now marks iterations as `failed` when session provider throws

### SqliteRunStore.mapIterationRow — step reconstruction [P8 fix]
- **File**: `sqlite-run-store.ts:mapIterationRow`
- Queries `step_outputs` table to reconstruct `StepRecord[]`
- Reads `status` column from DB (was hardcoded `'completed'`)

### SqliteRunStore.appendIteration — status persistence [P8 fix]
- **File**: `sqlite-run-store.ts:appendIteration`
- INSERT now includes `iteration.status`

### SqliteRunStore.getRun — summary without finalScore
- **File**: `sqlite-run-store.ts:getRun`
- Creates summary when any of `final_score`, `exit_reason`, `total_iterations` exist
- Exit reason visible even when all iterations failed (no scores)

### Database migration
- **File**: `database.module.ts`
- Added `status TEXT NOT NULL DEFAULT 'completed'` to iterations table schema
- Migration: `ALTER TABLE iterations ADD COLUMN status` for existing DBs (via pragma_table_info check)

## Browser Verification
- Old run (10 iterations, all null): still shows historical data correctly
- New run (CCAAS down): exits after 3 iterations with "3 consecutive iterations failed"
- Run progress page shows exit reason and correct iteration count
