# live-lesson-ai-tutor-e2e Harness

Iterative code-mode harness that implements and validates the complete AI tutor pipeline: rich prompts, dynamic categorization, teacher visibility, and student UX.

## Problem Statement

The basic AI integration (GLM-4-Flash → `aiAsk` endpoint) has 4 gaps:
1. **Thin prompt**: Only step label, missing article text, answer key, reference Q&A
2. **No categorization**: All questions treated equally, no type filtering
3. **Teacher blind spot**: Question queue shows only question text, no AI answers or categories
4. **Generic student UX**: Hardcoded quick chips, no context awareness

## Quick Start

```bash
# Full run (10 iterations max)
bash harness-workspace/live-lesson-ai-tutor-e2e/harness.sh

# Dry run — estimate cost without executing
bash harness-workspace/live-lesson-ai-tutor-e2e/harness.sh --dry-run

# Resume from last completed iteration
bash harness-workspace/live-lesson-ai-tutor-e2e/harness.sh --resume

# Check current state
bash harness-workspace/live-lesson-ai-tutor-e2e/harness.sh --status

# Run individual smoke tests
bash harness-workspace/live-lesson-ai-tutor-e2e/tests/test-categorization.sh
bash harness-workspace/live-lesson-ai-tutor-e2e/tests/test-prompt-quality.sh
bash harness-workspace/live-lesson-ai-tutor-e2e/tests/test-teacher-api.sh
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
solutions/business/live-lesson/backend/src/classroom/classroom.service.ts
solutions/business/live-lesson/backend/src/classroom/classroom.controller.ts
solutions/business/live-lesson/frontend/src/hooks/useClassroom.ts
solutions/business/live-lesson/frontend/src/components/student/AiPanel.tsx
solutions/business/live-lesson/frontend/src/components/teacher/TeacherShell.tsx
solutions/business/live-lesson/frontend/src/styles/teacher.css
solutions/business/live-lesson/frontend/src/styles/student.css
solutions/business/live-lesson/data/lessons/ideal-beauty-reading/manifest.json
```

Everything else is **frozen** — entities, DTOs, lesson service, pages, orchestrator, types, packages.

## Design Documents

| Document | Purpose |
|----------|---------|
| `solutions/business/live-lesson/docs/ai-tutor-categorization.md` | Dynamic categorization system |
| `solutions/business/live-lesson/docs/ai-tutor-prompt-design.md` | 6-layer prompt engineering |
| `solutions/business/live-lesson/docs/ai-tutor-teacher-visibility.md` | Teacher question queue UX |

## Evaluation Dimensions (5 x 20 pts)

| Dimension | Focus |
|-----------|-------|
| D1: AI Response Quality | Substantive answers, Socratic for tasks, article references, Chinese 2-3 sentences |
| D2: Prompt Engineering | Article text, answer key, referenceQA, step strategy in prompt |
| D3: Dynamic Categorization | Category field, API return, predefined categories, regex parse, state output |
| D4: Teacher Visibility | Category grouping, AI answers, badges, type in ClassroomState |
| D5: Build + UX | nest build, tsc+vite, category labels, smart chips, frozen check |

## Directory Structure

```
harness-workspace/live-lesson-ai-tutor-e2e/
├── harness.sh              # Main orchestrator script
├── SPEC.md                 # Full specification (refs design docs)
├── EVAL_CRITERIA.md        # Scoring rubric (5 x 20 pts)
├── README.md               # This file
├── dag.yaml                # DAGU DAG for step-level orchestration
├── state.json              # Runtime state (auto-created)
├── progress.md             # Iteration history table
├── tests/
│   ├── test-categorization.sh  # Smoke test: categorization
│   ├── test-prompt-quality.sh  # Smoke test: AI response quality
│   └── test-teacher-api.sh     # Smoke test: teacher state API
├── prompts/
│   ├── generator.md        # Implementation agent prompt
│   └── evaluator.md        # Scoring agent prompt
├── eval-reports/           # v{N}-eval.md per iteration
└── changelogs/             # v{N}-changelog.md per iteration
```

## Iteration Loop (6 Steps)

1. **Generator** — Claude agent implements changes based on spec + eval feedback
2. **Frozen Check** — Verify no frozen directories were modified
3. **Validation** — Backend build + frontend typecheck + vite build
4. **Services** — Start core backend (:3001) + lesson backend (:3007) + frontend (:5283)
5. **Evaluator** — Claude agent creates test data, runs curl + Playwright checks
6. **Results** — Extract score, update progress, git snapshot

## Exit Conditions

- Score reaches 98/100
- Cost cap exceeded ($200 default)
- < 3 point improvement for 2 consecutive iterations
- Regression > 5 points triggers auto-revert

## Key Difference from teacher-v2-fidelity

| | teacher-v2-fidelity | ai-tutor-e2e |
|---|---|---|
| Scope | Frontend teacher only | Full stack (backend + frontend) |
| Frozen | Backend entirely frozen | Entities, DTOs, lesson, pages frozen |
| Focus | Design fidelity + real data | AI pipeline + categorization + visibility |
| Threshold | 98/100 | 98/100 |
| Max iterations | 12 | 10 |
| Smoke tests | None | 3 independent test scripts |
