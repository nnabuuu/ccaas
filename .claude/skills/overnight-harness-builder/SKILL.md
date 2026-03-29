---
name: overnight-harness-builder
description: "Generate runnable long-term agent harness projects from a HARNESS_SPEC.md. Produces all artifacts needed for autonomous overnight iteration: frozen specs, eval rubrics, agent prompts, orchestration scripts, and progress tracking — ready to run with Claude Code CLI. Use when users have a defined HARNESS_SPEC.md (from the task-harness-definer skill) and want to build the actual harness, or when users say 'build the harness', 'generate the loop', 'create the overnight script', '构建harness', '生成迭代脚本', or want to set up a Generator-Evaluator agent loop for any iterative improvement task. Also triggers when users provide a task description with clear eval criteria and want an executable iteration pipeline."
---

# Overnight Harness Builder

Generate complete, runnable harness projects for autonomous long-running agent iteration.

## Input

Expects a `HARNESS_SPEC.md` (from task-harness-definer) or a user description with artifact type, eval dimensions, and exit conditions. Flag gaps and ask before proceeding.

## Two Artifact Modes

**Document Mode** — articles, reports, data files. Versioned files in `drafts/v{N}.{ext}`.

**Code Mode** — live source code, UI components. Git commits as version snapshots, no `drafts/` directory.

Choose based on HARNESS_SPEC.md. When in doubt, ask.

## Critical Design Rules

1. **Fresh context**: Agents run via `claude -p` with ZERO memory. Generator prompt MUST list files to read as its complete memory. See `references/prompt-templates.md`.

2. **File-based communication**: All data extraction (score, changelog, top issue) reads from files agents write — NEVER from `claude -p` stdout.

3. **Separate invocations**: Generator and Evaluator in separate `claude -p` calls. Evaluator positioned as independent reviewer.

4. **Per-agent tools**: Each `claude -p` needs explicit `--allowedTools`. See tool table in `references/prompt-templates.md`.

5. **Git snapshots**: Commit after each step. For Code Mode, this IS the version system.

6. **Starting-point injection**: Orchestrator appends iteration-specific context (version, artifact path, changelog path) at invocation time. See `references/orchestrator-templates.md`.

## Generation Pipeline

Complete each step in order. Read reference files for templates and details.

### Step 1: SPEC.md
Frozen target extracted from HARNESS_SPEC.md. Contains objective, artifact description, frozen constraints.

### Step 2: EVAL_CRITERIA.md
Scoring rubric. Must be concrete enough for a stranger to score consistently. Verify detection methods are actionable.

### Step 3: Agent Prompts
Read `references/prompt-templates.md` for base templates.

**Generator must have**: fresh context warning (top), explicit reading order, starting-point directive, changelog file path, constraint reminder.

**Evaluator must have**: independent reviewer role, rubric reference, anti-bias instruction, file output (`eval-reports/v{N}-eval.md`), parseable score (`总分: XX/100`).

### Step 4: Orchestrator Script
Read `references/orchestrator-templates.md` for bash template.

Must support: `--dry-run`, `--resume`, `--max-cost`. Must implement all exit conditions. Must extract data from files, not stdout.

### Step 5: progress.md
Initialize with v0 row. See `references/project-structure.md` for format.

### Step 6: README.md
How to run, prerequisites, morning review checklist.

### Step 7: Self-Review
- [ ] Generator prompt has fresh context warning at top
- [ ] Generator specifies changelog file path (not stdout)
- [ ] Evaluator writes report to file (not stdout)
- [ ] Orchestrator extracts data from files
- [ ] Orchestrator injects starting-point context per iteration
- [ ] `--allowedTools` set for each `claude -p`
- [ ] Git commits after each step
- [ ] All exit conditions implemented
- [ ] [Code Mode] Validation step with revert on failure
- [ ] [Code Mode] Dev server lifecycle managed

## Adaptation Rules

**Code artifact**: Use Code Mode. Add validation step (typecheck/test) before eval. Revert on failure. See `references/orchestrator-templates.md` for patterns.

**Browser-visible UI**: Add Playwright tools to Generator + Evaluator. Include `screenshots/` directory.

**Subjective quality**: Weight rubric toward concrete detection methods. Consider human review gate.

**> 2 agents**: Pipeline extends linearly: Planner → Generator → [Specialist/Tool Agent] → Evaluator.

## References

- `references/project-structure.md` — Directory layout, file roles, naming conventions, git integration
- `references/prompt-templates.md` — Generator/Evaluator/Specialist/Planner templates, tool table, customization checklist
- `references/orchestrator-templates.md` — Bash template, key patterns (injection, extraction, validation, dev server)

## Language

Match user's language for README and comments. Script variables stay in English.
