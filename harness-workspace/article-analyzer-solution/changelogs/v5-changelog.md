# v5 Changelog — Article Analyzer Solution

## Summary
Code reviewer fix: batch step_outputs query + explicit maxConsecutiveFailures opt-in.

## Changes

### Batch step_outputs query [performance]
- **File**: `sqlite-run-store.ts:getRun`
- Single query loads all step_outputs for a run, grouped by iteration
- `mapIterationRow` now accepts pre-loaded rows as parameter
- Eliminates N+1 queries (was: 1 SELECT per iteration)

### Explicit maxConsecutiveFailures
- **File**: `article-task.ts:exitConditions`
- Added `maxConsecutiveFailures: 3` since harness core no longer defaults to 3

## Test Results
- Backend + frontend tsc zero errors
- Backend starts, task registered with correct exitConditions
- Existing runs load correctly with batch query
