# v5 Changelog — @kedge-agentic/harness Module

## Summary
Code reviewer HIGH issue fixes: opt-in maxConsecutiveFailures, N+1 query elimination, run_failed event emission.

## Changes

### maxConsecutiveFailures opt-in only [P10 fix]
- **File**: `packages/harness/src/core/exit-evaluator.ts`
- Changed from implicit default `?? 3` to only checking when `maxConsecutiveFailures != null`
- Tasks must explicitly configure this to enable fail-fast behavior
- Updated tests: new "does not check when not configured" test, all existing tests now pass explicit value

### Batch step_outputs loading [P11 fix]
- **File**: `solutions/business/article-analyzer/backend/src/harness/sqlite-run-store.ts`
- `getRun`: single query loads ALL step_outputs for the run, grouped by iteration
- `mapIterationRow` now accepts pre-loaded step output rows as parameter
- Eliminates N+1 queries (was: 1 query per iteration)

### run_failed event emission [P12 fix]
- **File**: `packages/harness/src/core/orchestrator.ts`
- Both `startRun` and `resumeRun` catch handlers now emit `run_failed` instead of `error`
- Added `activeRuns.delete(runId)` in catch handlers (was missing — memory leak)
- `harness.module.ts` stream cleanup already handles `run_failed` event type

### article-task explicit maxConsecutiveFailures
- **File**: `solutions/business/article-analyzer/backend/src/harness/article-task.ts`
- Added `maxConsecutiveFailures: 3` to exitConditions (required since default removed)

## Test Results
- 46 tests passing (1 new test added for opt-in behavior)
- tsc zero errors across harness, article-analyzer backend, and frontend
