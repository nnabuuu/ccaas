# live-lesson-observation-e2e Harness

Iterative code-mode harness that completes and validates the observation system: event pipeline, state derivation, real-time push, and teacher observation panel.

## Problem Statement

The three-layer observation architecture (ObservationService 475 lines + 33 tests) has a basic implementation but 4 integration gaps remain:
1. **Event pipeline**: `addSystemEvent` not persisted synchronously, `submit()` doesn't trigger `observeTurn`, missing `step_complete` events
2. **State derivation**: `deriveStatus` ignores knowledge anchors, hardcoded thresholds, no mixed signal handling
3. **Real-time push**: No SSE broadcast after observation, frontend doesn't receive observation data
4. **Teacher panel**: No Glance view, no anchor progress bars, no alert badge rendering

## Quick Start

```bash
# Full run (8 iterations max)
bash harness-workspace/live-lesson-observation-e2e/harness.sh

# Dry run — estimate cost without executing
bash harness-workspace/live-lesson-observation-e2e/harness.sh --dry-run

# Resume from last completed iteration
bash harness-workspace/live-lesson-observation-e2e/harness.sh --resume

# Check current state
bash harness-workspace/live-lesson-observation-e2e/harness.sh --status
```

## CLI Flags

| Flag | Description |
|------|-------------|
| `--dry-run` | Print cost estimate and exit |
| `--resume` | Resume from last iteration (sub-step recovery via state.json) |
| `--max-cost=N` | Set cost cap in USD (default: 200) |
| `--status` | Print state.json summary and exit |
| `--step=<name> --iteration=<N>` | Run a single step for DAGU integration |

## Artifact Scope

```
solutions/business/live-lesson/backend/src/classroom/observation.service.ts
solutions/business/live-lesson/backend/src/classroom/observation.service.spec.ts
solutions/business/live-lesson/backend/src/classroom/classroom.service.ts
solutions/business/live-lesson/frontend/src/hooks/useClassroom.ts
solutions/business/live-lesson/frontend/src/components/teacher/TeacherShell.tsx
solutions/business/live-lesson/frontend/src/styles/teacher.css
solutions/business/live-lesson/data/lessons/ideal-beauty-reading/manifest.json
```

Everything else is **frozen** — entities, DTOs, lesson service, pages, student components, packages.

## Evaluation Dimensions (5 x 20 pts)

| Dimension | Focus |
|-----------|-------|
| D1: Event Pipeline Completeness | Sync persistence, submit→observeTurn, history passing, step_complete, enriched context |
| D2: State Derivation Accuracy | K-anchor awareness, named constants, mixed signals, alert severity, anchorStats |
| D3: Real-time Alert Push | SSE observation field, broadcast after observeTurn, incremental push, frontend reception |
| D4: Teacher Observation Panel | Glance dots, anchor progress bars, misconception sort, alert badges |
| D5: Build + Tests + Frozen Files | nest build, tsc+vite, jest observation, frozen check, ≥5 new tests |

## Directory Structure

```
harness-workspace/live-lesson-observation-e2e/
├── harness.sh              # Main orchestrator script
├── SPEC.md                 # Full specification
├── EVAL_CRITERIA.md        # Scoring rubric (5 x 20 pts)
├── README.md               # This file
├── state.json              # Runtime state (auto-created)
├── progress.md             # Iteration history table
├── prompts/
│   ├── generator.md        # Implementation agent prompt
│   └── evaluator.md        # Scoring agent prompt
├── eval-reports/           # v{N}-eval.md per iteration
└── changelogs/             # v{N}-changelog.md per iteration
```

## Iteration Loop (6 Steps)

1. **Generator** — Claude agent implements changes based on spec + eval feedback
2. **Frozen Check** — Verify no frozen directories were modified
3. **Validation** — Backend build + jest observation tests + frontend typecheck + vite build
4. **Services** — Start core backend (:3001) + lesson backend (:3007) + frontend (:5283)
5. **Evaluator** — Claude agent creates multi-student test data, runs curl + Playwright checks
6. **Results** — Extract score, update progress, git snapshot

## Exit Conditions

- Score reaches 80/100 (LLM-dependent behavior may lose points without API key)
- Cost cap exceeded ($200 default)
- < 3 point improvement for 2 consecutive iterations
- Regression > 5 points triggers auto-revert

## Key Differences from ai-tutor-e2e

| | ai-tutor-e2e | observation-e2e |
|---|---|---|
| Scope | AI prompt + categorization + teacher queue | Observation pipeline + state derivation + alerts |
| Validation gate | Build only | Build + jest observation tests |
| Test data | 3 students, 4 questions | 4 students, varied observation patterns |
| Threshold | 98/100 | 80/100 (LLM-dependent items) |
| Max iterations | 10 | 8 |
| Baseline tests | None | 33 (must not regress) |
