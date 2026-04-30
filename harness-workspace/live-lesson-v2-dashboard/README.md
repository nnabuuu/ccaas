# live-lesson-v2-dashboard Harness

Iterative code-mode harness that upgrades the live-lesson system to V2: backend data layer + teacher swimlane dashboard + student 4-phase task flow.

## Quick Start

```bash
# Full run (10 iterations max)
bash harness-workspace/live-lesson-v2-dashboard/harness.sh

# Dry run — estimate cost without executing
bash harness-workspace/live-lesson-v2-dashboard/harness.sh --dry-run

# Resume from last completed iteration (sub-step level via state.json)
bash harness-workspace/live-lesson-v2-dashboard/harness.sh --resume

# Check current state
bash harness-workspace/live-lesson-v2-dashboard/harness.sh --status
```

## CLI Flags

| Flag | Description |
|------|-------------|
| `--dry-run` | Print cost estimate and exit |
| `--resume` | Resume from last iteration (sub-step recovery via state.json) |
| `--max-cost=N` | Set cost cap in USD (default: 300) |
| `--status` | Print state.json summary and exit |
| `--step=<name> --iteration=<N>` | Run a single step for DAGU integration |
| `--register-dagu` | Show DAGU registration instructions |
| `--unregister-dagu` | Show DAGU unregistration instructions |

## Prerequisites

- `claude` CLI installed
- `jq` installed (`brew install jq`)
- `node` and `npm` available
- Dependencies installed (auto-checked by preflight)

## Directory Structure

```
harness-workspace/live-lesson-v2-dashboard/
├── harness.sh          # Main orchestrator script
├── SPEC.md             # Full specification
├── EVAL_CRITERIA.md    # Scoring rubric (5 dimensions × 20 pts)
├── dag.yaml            # DAGU DAG for step-level orchestration
├── state.json          # Runtime state (auto-created)
├── progress.md         # Iteration history table
├── prompts/
│   ├── generator.md    # Implementation agent prompt
│   └── evaluator.md    # Scoring agent prompt
├── eval-reports/       # v{N}-eval.md per iteration
└── changelogs/         # v{N}-changelog.md per iteration
```

## Iteration Loop (6 Steps)

1. **Generator** — Claude agent implements changes based on spec + eval feedback
2. **Frozen Check** — Verify no frozen directories were modified
3. **Validation** — Backend build + frontend typecheck + vite build
4. **Services** — Start core backend (:3001) + lesson backend (:3007) + frontend (:5283)
5. **Evaluator** — Claude agent scores the implementation via Playwright + curl
6. **Results** — Extract score, update progress, git snapshot

## Exit Conditions

- Score reaches 98/100
- Cost cap exceeded ($300 default)
- < 3 point improvement for 2 consecutive iterations
- Regression > 5 points triggers auto-revert

## Artifact

```
solutions/business/live-lesson/backend/src/   # Backend changes
solutions/business/live-lesson/data/           # Manifest data
solutions/business/live-lesson/frontend/       # Frontend V2
```
