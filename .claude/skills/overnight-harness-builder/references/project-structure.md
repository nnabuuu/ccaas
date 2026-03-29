# Project Structure Reference

Complete specification of the harness project directory layout. Each file has a specific role in the overnight iteration loop.

## Two Artifact Modes

### Document Mode (articles, reports, specs, data files)

Artifacts are self-contained files. Each iteration produces a new versioned file.

```
{task-name}/
├── SPEC.md                     # [FROZEN] Task specification — the target
├── EVAL_CRITERIA.md            # [CONFIGURABLE] Scoring rubric
├── prompts/
│   ├── generator.md            # Generator agent instructions
│   ├── evaluator.md            # Evaluator agent instructions
│   ├── planner.md              # (Optional) Planner agent
│   └── specialist-{name}.md    # (Optional) Domain specialist agents
├── harness.sh                  # Bash orchestrator script
├── progress.md                 # Cross-session iteration log
├── drafts/                     # Versioned artifacts + changelogs
│   ├── v0.{ext}                # (Optional) Initial artifact if pre-existing
│   ├── v1.{ext}                # First generated version
│   ├── v1-changelog.md         # What changed in v1 and why
│   ├── v2.{ext}
│   ├── v2-changelog.md
│   └── ...
├── eval-reports/               # Evaluation results
│   ├── v1-eval.md
│   ├── v2-eval.md
│   └── ...
├── inputs/                     # (Optional) Source materials
│   └── reference-doc.md
└── README.md
```

### Code Mode (live source code, UI components, configs)

Artifacts are live source files in the project. Git commits serve as version snapshots — no `drafts/` directory.

```
{task-name}/
├── SPEC.md
├── EVAL_CRITERIA.md
├── prompts/
│   ├── generator.md
│   ├── evaluator.md
│   └── ...
├── harness.sh
├── progress.md
├── changelogs/                 # Generator writes changelogs here
│   ├── v1-changelog.md
│   ├── v2-changelog.md
│   └── ...
├── eval-reports/
│   ├── v1-eval.md
│   ├── v2-eval.md
│   └── ...
├── screenshots/                # (Optional) Browser screenshots per version
│   ├── v1/
│   │   ├── desktop-main.png
│   │   └── mobile-main.png
│   └── v2/
│       └── ...
└── README.md
```

Note: In Code Mode, the artifact lives in the project source tree (e.g., `packages/foo/src/`), not in this directory.

**Choose mode based on HARNESS_SPEC.md's artifact type.** When in doubt, ask the user.

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
- **Contains**: Role, fresh context warning, reading order, constraints, output location
- **Key design**: Must reference SPEC.md, progress.md, and last eval report by path
- **MUST include**: Fresh context warning at the top (see prompt-templates.md)
- **Anti-pattern**: Do NOT embed eval criteria in the generator prompt — it should read them from the eval report, not replicate the rubric

### prompts/evaluator.md — Evaluator Instructions
- **Read by**: Orchestrator, passed to `claude -p` in a SEPARATE invocation
- **Contains**: Role (independent reviewer), rubric reference, input path, output format
- **Key design**: Must NOT mention that it's part of an iterative loop — it evaluates a standalone artifact
- **Critical property**: Must produce the exact score format the orchestrator's regex expects
- **Output**: Must write to a file (`eval-reports/v{N}-eval.md`), not to stdout

### progress.md — Cross-Session Memory
- **Created**: At harness setup with header + v0 row
- **Modified**: Appended by orchestrator after each iteration
- **Read by**: Generator (to understand iteration history), Planner (to detect patterns)
- **Format**: Markdown table with columns: Version, Timestamp, Score, Key Changes, Top Issue
- **Code Mode variant**: Can include per-dimension columns if eval has multiple scored dimensions
- **Size management**: For very long runs (>20 iterations), the Generator should read only the last 10 rows + a summary

### drafts/ — Version Archive (Document Mode only)
- **Naming**: v{N}.{ext} where N is the iteration number
- **Policy**: Never delete or overwrite previous versions — the archive is the audit trail
- **For `--resume`**: Orchestrator reads the highest-numbered file to determine where to continue
- **Changelog files**: Each version has a companion `v{N}-changelog.md`. The orchestrator reads these for the progress log instead of parsing stdout.

### changelogs/ — Changelog Archive (Code Mode only)
- **Naming**: v{N}-changelog.md
- **Written by**: Generator (each iteration)
- **Read by**: Orchestrator (for progress.md key changes column)
- **Purpose**: Same as document mode changelogs, but separated from drafts/ since there are no draft files

### eval-reports/ — Evaluation Archive
- **Naming**: v{N}-eval.md matching the version number
- **Policy**: Never delete — the evaluator's perspective may reveal patterns across iterations
- **Usage**: Generator reads v{N-1}-eval.md at iteration N; Planner reads multiple reports

### inputs/ — Source Materials (Optional)
- **For**: Reference documents, datasets, examples that the Generator needs
- **Policy**: Treat as read-only during harness runs
- **When to use**: When the task requires grounding in specific source material

## Naming Conventions

- **Task directory**: `{descriptive-name}` (e.g., `chat-interface-ui-polish`)
- **Draft files**: `v{N}.{ext}` — sequential, zero-padded not required
- **Changelog files**: `v{N}-changelog.md`
- **Eval reports**: `v{N}-eval.md` — always markdown
- **Agent prompts**: `{role}.md` — lowercase, hyphenated

## Git Integration

### Document Mode (recommended)

```bash
cd {task-name}
git init
git add SPEC.md EVAL_CRITERIA.md prompts/ harness.sh README.md progress.md
git commit -m "init: harness setup"

# Orchestrator commits after each iteration:
git add drafts/v${i}.${ARTIFACT_EXT} drafts/v${i}-changelog.md eval-reports/v${i}-eval.md progress.md
git commit -m "harness: v${i} — score ${score}/100"
```

### Code Mode (essential — git IS the version system)

```bash
# After Generator + validation passes:
git add -A
git commit -m "harness: v${VERSION} iteration"

# After Evaluator completes:
git add eval-reports/ changelogs/ progress.md
git commit -m "harness: v${VERSION} eval — score ${SCORE}/100"
```

`git log --grep='harness:'` gives the natural progress timeline. `git diff` between any two commits shows exactly what changed.
