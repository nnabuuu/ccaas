# live-lesson-teacher-v2-fidelity Harness

Iterative code-mode harness that rewrites TeacherShell to high-fidelity match the teacher.html reference design, while removing all mock/demo fallback data.

## Problem Statement

The v2-dashboard harness scored 99/100, but the teacher dashboard has two issues:
1. **Mock fallback**: TeacherShell uses `DEMO_STUDENTS` (26 hardcoded students) when no real students exist, giving the impression of fake data
2. **Design mismatch**: Current layout uses swim-row structure; reference teacher.html uses Step Card structure with different visual hierarchy

## Quick Start

```bash
# Full run (8 iterations max)
bash harness-workspace/live-lesson-teacher-v2-fidelity/harness.sh

# Dry run — estimate cost without executing
bash harness-workspace/live-lesson-teacher-v2-fidelity/harness.sh --dry-run

# Resume from last completed iteration
bash harness-workspace/live-lesson-teacher-v2-fidelity/harness.sh --resume

# Check current state
bash harness-workspace/live-lesson-teacher-v2-fidelity/harness.sh --status
```

## CLI Flags

| Flag | Description |
|------|-------------|
| `--dry-run` | Print cost estimate and exit |
| `--resume` | Resume from last iteration (sub-step recovery via state.json) |
| `--max-cost=N` | Set cost cap in USD (default: 200) |
| `--status` | Print state.json summary and exit |
| `--step=<name> --iteration=<N>` | Run a single step for DAGU integration |

## Artifact Scope (Narrow)

Only these files are writable:
```
solutions/business/live-lesson/frontend/src/components/teacher/TeacherShell.tsx
solutions/business/live-lesson/frontend/src/styles/teacher.css
solutions/business/live-lesson/frontend/src/components/teacher/*.tsx  (new sub-components)
```

Everything else is **frozen** — backend, hooks, pages, student components, data, packages.

## Evaluation Dimensions (5 × 20 pts)

| Dimension | Focus |
|-----------|-------|
| D1: Layout Fidelity | Band, timeline, health cards, step card structure, body grid |
| D2: Step Cards + Data Binding | 5 cards, headers, metrics, dots, click→detail, quality bars |
| D3: Student Modal + Journey | Modal open, journey strip, status icons, submission detail, class compare |
| D4: Real Data Only | Zero mock grep, empty state, live data, score display |
| D5: Polish + Build | tsc, vite build, patterns, coaching, queue, CSS tokens, frozen check |

## Directory Structure

```
harness-workspace/live-lesson-teacher-v2-fidelity/
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

1. **Generator** — Claude agent rewrites TeacherShell based on spec + eval feedback
2. **Frozen Check** — Verify no frozen directories were modified
3. **Validation** — Frontend typecheck + vite build
4. **Services** — Start core backend (:3001) + lesson backend (:3007) + frontend (:5283)
5. **Evaluator** — Claude agent creates test data via curl, then scores via Playwright
6. **Results** — Extract score, update progress, git snapshot

## Exit Conditions

- Score reaches 95/100
- Cost cap exceeded ($200 default)
- < 3 point improvement for 2 consecutive iterations
- Regression > 5 points triggers auto-revert

## Key Difference from v2-dashboard

| | v2-dashboard | teacher-v2-fidelity |
|---|---|---|
| Scope | Full stack (backend + frontend) | Frontend teacher only |
| Frozen | mcp-server, packages | Backend, hooks, pages, student, data + above |
| Threshold | 98/100 | 95/100 |
| Max iterations | 10 | 8 |
| Focus | Feature completeness | Design fidelity + real data |
