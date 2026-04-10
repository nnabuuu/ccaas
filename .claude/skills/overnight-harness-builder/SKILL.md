---
name: overnight-harness-builder
description: "Generate runnable long-term agent harness projects from a HARNESS_SPEC.md. Three modes: (1) Document Mode for articles/reports, (2) Code Mode for live source code, (3) Investigation Mode for bug root cause analysis. Produces all artifacts needed for autonomous overnight execution — frozen specs, agent prompts, orchestration scripts, and progress tracking. Use when users have a defined HARNESS_SPEC.md (from the task-harness-definer skill) and want to build the actual harness, or when users say 'build the harness', 'generate the loop', 'create the overnight script', '构建harness', '生成迭代脚本', '生成调查harness', 'build investigation harness', or want to set up agent loops for iterative improvement or systematic bug investigation."
---

# Overnight Harness Builder

Generate complete, runnable harness projects for autonomous long-running agent iteration.

## Input

Expects a `HARNESS_SPEC.md` (from task-harness-definer) or a user description with artifact type, eval dimensions, and exit conditions. Flag gaps and ask before proceeding.

## Three Artifact Modes

**Document Mode** — articles, reports, data files. Versioned files in `drafts/v{N}.{ext}`.

**Code Mode** — live source code, UI components. Git commits as version snapshots, no `drafts/` directory.

**Investigation Mode** — bug root cause analysis, system debugging. Evidence files in `evidence/`, no `drafts/` directory. No Generator-Evaluator pair; uses a single Investigator agent that tests hypotheses sequentially.

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

**[Document/Code Mode]:**

**Generator must have**: fresh context warning (top), explicit reading order, root cause analysis section (classify fixes as A/B/C type), single-focus strategy (max 1-2 fixes per round), starting-point directive, changelog file path, constraint reminder.

**Evaluator must have**: independent reviewer role, rubric reference, anti-bias instruction, bug classification (`[COMPONENT]`/`[SYSTEM]`/`[DESIGN]`), actionable fix hints (file path + target value), file output (`eval-reports/v{N}-eval.md`), parseable score (`总分: XX/100`).

**[Investigation Mode]:**

**Investigator must have**: fresh context warning (top), hypothesis-driven workflow, one-hypothesis-per-round constraint, evidence file output (`evidence/h{N}-{name}.md`), CONFIRMED/ELIMINATED/INCONCLUSIVE judgment requirement.

### Step 4: Orchestrator Script
Read `references/orchestrator-templates.md` for bash template.

Must support: `--dry-run`, `--resume`, `--max-cost`. Must implement all exit conditions. Must extract data from files, not stdout.

### Step 5: progress.md
Initialize with v0 row. See `references/project-structure.md` for format.

### Step 6: README.md
How to run, prerequisites, morning review checklist.

### Step 7: Self-Review

**All modes:**
- [ ] `claude_safe()` wrapper defined (env -u CLAUDECODE pattern) — see orchestrator-templates.md Pattern 0
- [ ] ALL `claude -p` calls use `claude_safe -p` (not bare `claude`)
- [ ] Script uses `set -eu` (NOT `set -euo pipefail` — pipefail fails in some environments)
- [ ] Agent prompt(s) have fresh context warning at top
- [ ] `--allowedTools` set for each `claude -p`
- [ ] Git commits after each step
- [ ] All exit conditions implemented
- [ ] Orchestrator supports `--dry-run`

**Document/Code Mode:**
- [ ] Generator specifies changelog file path (not stdout)
- [ ] Generator has root cause analysis section (A/B/C classification)
- [ ] Generator has single-focus strategy (max 1-2 fixes per round)
- [ ] Evaluator writes report to file (not stdout)
- [ ] Evaluator has bug classification + actionable fix hints
- [ ] Orchestrator extracts data from files
- [ ] Orchestrator injects starting-point context per iteration
- [ ] Orchestrator has frozen file violation gate
- [ ] Orchestrator has regression detection (revert if score drops > 5)
- [ ] [Code Mode] Validation step with revert on failure
- [ ] [Code Mode] Dev server lifecycle managed

**Investigation Mode:**
- [ ] Investigator reads SPEC.md + progress.md + evidence/ for context
- [ ] Investigator writes to `evidence/h{N}-{name}.md`
- [ ] Investigator makes explicit CONFIRMED/ELIMINATED/INCONCLUSIVE judgment
- [ ] Orchestrator tracks hypothesis status in progress.md
- [ ] Dead-end detection: all hypotheses eliminated → generate new or escalate

## Adaptation Rules

**Code artifact**: Use Code Mode. Add validation step (typecheck/test) before eval. Revert on failure. See `references/orchestrator-templates.md` for patterns.

**Browser-visible UI**: Add Playwright tools to Generator + Evaluator. Include `screenshots/` directory.

**Subjective quality**: Weight rubric toward concrete detection methods. Consider human review gate.

**> 2 agents**: Pipeline extends linearly: Planner → Generator → [Specialist/Tool Agent] → Evaluator.

**Bug investigation**: Use Investigation Mode. Single Investigator agent. No eval rubric needed — exit condition is "root cause confirmed" not "score threshold". See `references/orchestrator-templates.md` for investigation orchestrator template.

## References

- `references/project-structure.md` — Directory layout, file roles, naming conventions, git integration
- `references/prompt-templates.md` — Generator/Evaluator/Specialist/Planner templates, tool table, customization checklist
- `references/orchestrator-templates.md` — Bash template, key patterns (injection, extraction, validation, dev server)

## Language

Match user's language for README and comments. Script variables stay in English.
