# teacher-dashboard-api Harness

Iteratively enhance `classroom.service.ts` `getState()` to provide all data needed by the teacher dashboard design prototype.

## Mode
**Code Mode** — modifies live source code with validation + revert on failure.

## Gaps (G1–G7)
| Gap | Description | Priority |
|-----|-------------|----------|
| G1 | byDimension keys → human-readable names (from manifest) | P1 |
| G2 | per-student per-step duration + aiRoundsCount | P1 |
| G3 | Student status field (done/prog/stuck/reading) | P1 |
| G4 | alertTag generation for step cards | P1 |
| G5 | questionAggregates isHigh threshold ≥4 | P1 |
| G6 | Health Cards aggregate (furthest/median/stuck/aiTotal) | P1 |
| G7 | Issues generation (common wrong answer detection) | P1 |

## Target Files
- `solutions/business/live-lesson/backend/src/classroom/classroom.service.ts`
- `solutions/business/live-lesson/backend/src/classroom/classroom.service.spec.ts`

## Frozen Files (must not change)
- `solutions/business/live-lesson/backend/src/entities/*.entity.ts`

## Running

```bash
# Full run (up to 5 iterations)
bash .harness-workspace/teacher-dashboard-api/harness.sh

# Dry run (show plan without executing)
bash .harness-workspace/teacher-dashboard-api/harness.sh --dry-run

# Resume from last completed step
bash .harness-workspace/teacher-dashboard-api/harness.sh --resume

# Run a single step
bash .harness-workspace/teacher-dashboard-api/harness.sh --step generator --iteration 1

# Check status
bash .harness-workspace/teacher-dashboard-api/harness.sh --status

# Set max API cost
bash .harness-workspace/teacher-dashboard-api/harness.sh --max-cost 5.00
```

## DAGU Integration

```bash
# Register with DAGU
bash .harness-workspace/teacher-dashboard-api/harness.sh --register-dagu

# Unregister
bash .harness-workspace/teacher-dashboard-api/harness.sh --unregister-dagu

# Run via DAGU
dagu start .harness-workspace/teacher-dashboard-api/dag.yaml --params "ITERATION=1"
```

## Scoring
- **Pass**: 75/100
- **Target**: 90/100
- **Max iterations**: 5

See [EVAL_CRITERIA.md](./EVAL_CRITERIA.md) for full rubric.
