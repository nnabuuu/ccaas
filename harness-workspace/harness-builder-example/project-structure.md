# Project Structure Reference

Complete specification of the harness project directory layout. Each file has a specific role in the overnight iteration loop.

## Directory Layout

```
{task-name}-harness/
│
├── SPEC.md                     # [FROZEN] Task specification — the target
├── EVAL_CRITERIA.md            # [CONFIGURABLE] Scoring rubric
│
├── prompts/                    # Agent prompt files
│   ├── generator.md            # Generator agent instructions
│   ├── evaluator.md            # Evaluator agent instructions
│   ├── planner.md              # (Optional) Planner agent
│   └── specialist-{name}.md    # (Optional) Domain specialist agents
│
├── harness.sh                  # Bash orchestrator script
├── harness.ts                  # (Optional) TypeScript orchestrator
│
├── progress.md                 # Cross-session iteration log
│
├── drafts/                     # Versioned artifacts
│   ├── v0.{ext}                # (Optional) Initial artifact if pre-existing
│   ├── v1.{ext}                # First generated version
│   ├── v1-changelog.md         # What changed in v1 and why
│   ├── v2.{ext}                # Second iteration
│   ├── v2-changelog.md         # What changed in v2 and why
│   └── ...
│
├── eval-reports/               # Evaluation results
│   ├── v1-eval.md              # Evaluation of v1
│   ├── v2-eval.md              # Evaluation of v2
│   └── ...
│
├── inputs/                     # (Optional) Source materials
│   ├── reference-doc.md        # Reference documents for Generator
│   └── ...
│
└── README.md                   # Usage guide
```

## File Roles

### SPEC.md — The Frozen Target
- **Created**: Once, at harness setup
- **Modified**: Never during automated runs (human can edit between runs)
- **Read by**: Generator (every iteration), Planner (if present)
- **Purpose**: Prevents goal drift. The Generator should always know what it's building toward.
- **Critical property**: Must contain explicit frozen constraints — things the Generator must NOT change

### EVAL_CRITERIA.md — The Rubric
- **Created**: Once, at harness setup
- **Modified**: Rarely (human can adjust weights between runs)
- **Read by**: Evaluator (every iteration)
- **Purpose**: Ensures consistent, comparable scoring across iterations
- **Critical property**: Must contain a parseable score line (`总分: XX/100` or `Total: XX/100`)

### prompts/generator.md — Generator Instructions
- **Read by**: Orchestrator, passed to `claude -p`
- **Contains**: Role, task, constraints, output location
- **Key design**: Must reference SPEC.md, progress.md, and last eval report by path
- **Anti-pattern**: Do NOT embed eval criteria in the generator prompt — it should read them from the eval report, not replicate the rubric

### prompts/evaluator.md — Evaluator Instructions
- **Read by**: Orchestrator, passed to `claude -p` in a SEPARATE invocation
- **Contains**: Role (independent reviewer), rubric reference, input path, output format
- **Key design**: Must NOT mention that it's part of an iterative loop — it evaluates a standalone artifact
- **Critical property**: Must produce the exact score format the orchestrator's regex expects

### progress.md — Cross-Session Memory
- **Created**: At harness setup with header + v0 row
- **Modified**: Appended by orchestrator after each iteration
- **Read by**: Generator (to understand iteration history), Planner (to detect patterns)
- **Format**: Markdown table with columns: Version, Timestamp, Score, Key Changes, Top Issue
- **Size management**: For very long runs (>20 iterations), the Generator should read only the last 10 rows + a summary of earlier progress

### drafts/ — Version Archive
- **Naming**: v{N}.{ext} where N is the iteration number
- **Policy**: Never delete or overwrite previous versions — the archive is the audit trail
- **For `--resume`**: Orchestrator reads the highest-numbered file to determine where to continue
- **Changelog files**: Each version has a companion `v{N}-changelog.md` with structured changes (what changed, which eval suggestions were addressed, what was deliberately kept). The orchestrator reads these for the progress log instead of parsing stdout.

### eval-reports/ — Evaluation Archive
- **Naming**: v{N}-eval.md matching the draft version
- **Policy**: Never delete — the evaluator's perspective may reveal patterns across iterations
- **Usage**: Generator reads v{N-1}-eval.md at iteration N; Planner reads multiple reports

### inputs/ — Source Materials (Optional)
- **For**: Reference documents, datasets, examples that the Generator needs
- **Policy**: Treat as read-only during harness runs
- **When to use**: When the task requires grounding in specific source material (e.g., "rewrite this article based on these interview transcripts")

## Naming Conventions

- **Task directory**: `{descriptive-name}-harness` (e.g., `article-polishing-harness`)
- **Draft files**: `v{N}.{ext}` — sequential, zero-padded not required
- **Eval reports**: `v{N}-eval.md` — always markdown
- **Agent prompts**: `{role}.md` — lowercase, hyphenated

## Git Integration (Recommended)

Initialize a git repo in the harness directory:
```bash
cd {task-name}-harness
git init
git add SPEC.md EVAL_CRITERIA.md prompts/ harness.sh README.md progress.md
git commit -m "init: harness setup"
```

The orchestrator can optionally commit after each iteration:
```bash
git add drafts/v${i}.${ARTIFACT_EXT} drafts/v${i}-changelog.md eval-reports/v${i}-eval.md progress.md
git commit -m "iter ${i}: score ${score}/100"
```

This gives you `git log` as a natural progress timeline and `git diff` between any two versions.
