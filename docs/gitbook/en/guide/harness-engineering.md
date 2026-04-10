# Harness Engineering

Harness Engineering is a practice for running long-running AI agent tasks with structured iteration, automated evaluation, and quality gates. It transforms vague improvement goals into measurable, reproducible agent workflows.

## When to Use

Use a harness when your task:

- Requires **multiple iterations** to reach acceptable quality (e.g., UI redesign, code refactoring)
- Has **measurable evaluation criteria** (scores, test pass rates, static analysis)
- Benefits from **automated feedback loops** where the agent reads its own evaluation and improves

## Architecture

A harness follows the **Generator-Evaluator** pattern:

```
┌─────────────┐     ┌───────────┐     ┌─────────────┐
│  Generator   │ ──→ │ Pre-gate  │ ──→ │  Evaluator   │
│ (implement)  │     │ (tsc/test)│     │  (score)     │
└─────────────┘     └───────────┘     └─────────────┘
       ↑                                      │
       └──────────── progress.md ←────────────┘
```

1. **Generator**: Reads the spec, previous eval reports, and current code. Makes improvements.
2. **Pre-gate**: Runs a fast validation (e.g., `tsc --noEmit`). If it fails, the version scores 0 and the generator must fix compilation first.
3. **Evaluator**: Reads the eval criteria and the current code. Produces a structured score report.
4. **Loop**: The orchestrator updates `progress.md` and checks exit conditions.

## Workspace Structure

Every harness task lives in `harness-workspace/<task-name>/`:

```
harness-workspace/<task-name>/
├── SPEC.md              # What to build — work items + frozen constraints
├── EVAL_CRITERIA.md     # How to score — dimensions, weights, detection methods
├── README.md            # How to run — prerequisites, commands
├── harness.sh           # Orchestration script
├── progress.md          # Iteration log (score trajectory table)
├── prompts/
│   ├── generator.md     # Generator agent instructions
│   └── evaluator.md     # Evaluator agent instructions
├── reference/           # Design tokens, prototypes, architecture docs
├── eval-reports/        # v{N}-eval.md — per-version evaluation
└── changelogs/          # v{N}-changelog.md — per-version changes
```

## Key Files

### SPEC.md

Defines **what** to build. Contains:

- **Goal**: Target score and max iterations
- **Work Items**: Numbered tasks (W1, W2, ...) mapping to evaluation dimensions
- **Frozen Constraints**: Files and APIs that must not be modified
- **Architecture**: File tree showing which files to create/modify

### EVAL_CRITERIA.md

Defines **how** to score. Contains:

- **Pre-gate**: A command that must pass before scoring (typically `tsc --noEmit`)
- **Dimensions**: Weighted scoring rubric (D1, D2, ...) with 1-5 scale per dimension
- **Detection Methods**: Bash commands or code patterns the evaluator uses to verify each dimension
- **Penalty Rules**: Deductions for regressions or constraint violations

### harness.sh

The orchestration script. Handles:

- Service startup (dev servers, backends)
- Iteration loop with configurable max rounds
- Git snapshots between versions
- Score parsing and exit condition checks
- `--resume` flag for continuing interrupted runs
- `--dry-run` flag for validation without execution

## Exit Conditions

The harness stops when any condition is met:

1. **Target reached**: Score >= target (e.g., 95/100)
2. **Max iterations**: Reached the configured limit (e.g., 15)
3. **Plateau detected**: Score improvement < threshold for N consecutive iterations (e.g., < 3 points for 2 rounds)

## Designing Evaluation Criteria

Good eval criteria are:

- **Weighted**: Not all dimensions are equally important. Assign points based on impact.
- **Verifiable**: Each dimension has concrete detection methods (grep, file existence, test results).
- **Graduated**: Use a 1-5 scale so partial progress is rewarded, not just pass/fail.
- **Actionable**: The evaluator's report tells the generator exactly what to fix next.

Example dimension structure:

| Dimension | Weight | 5/5 | 3/5 | 1/5 |
|-----------|--------|-----|-----|-----|
| Visual Hierarchy | 20/100 | Full design tokens + breadcrumb + consistent typography | Basic navbar, missing tokens | No improvement |
| Loading States | 15/100 | Skeleton + ErrorState + EmptyState on all pages | Some pages have loading states | No loading states |

## Prompt Engineering for Harness Agents

### Generator Prompt Tips

- Reference the spec by work item number (W1, W2)
- Include the latest eval report so the agent knows what scored low
- Specify a **phase strategy** (e.g., "v1-3: infrastructure, v4-6: visualization, v7+: polish")
- Remind about frozen constraints

### Evaluator Prompt Tips

- Include detection commands inline so the evaluator can verify mechanically
- Require structured output format: dimension scores, total, and "Top Issue" for the generator
- Emphasize that the evaluator must not fix code — only evaluate

## Running a Harness

```bash
# Dry run — validates workspace structure
bash harness-workspace/<task-name>/harness.sh --dry-run

# Full run
bash harness-workspace/<task-name>/harness.sh

# Resume after interruption
bash harness-workspace/<task-name>/harness.sh --resume
```

## Integration with Stitch

For UI-focused harness tasks, you can generate design prototypes with Stitch MCP before running the harness:

1. Create a Stitch project with a design system (colors, fonts, roundness)
2. Generate screens for each major view
3. Export screen HTML to `reference/` or `prototypes/`
4. The generator reads these prototypes as visual targets

## Case Studies

- [Article Analyzer UI/UX Redesign](../examples/article-analyzer-ui-redesign.md) — 4 iterations to 100/100
- [Context Layer @ Reference Picker](../examples/reference-picker.md) — Full-stack module from zero code
