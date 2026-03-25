# Harness Audit Scoring Rubric

Each dimension is scored 0–5. Total score: 0–30.

Each dimension is annotated with:
- **Principle** — The industry-agnostic rule (why this matters in any domain)
- **Layer** — Which layer of the 4-Layer Harness Model it belongs to

---

## Dimension 0: Goal Alignment

**Principle**: The agent must be anchored to explicit, verifiable objectives — not its own interpretation of a vague instruction.

**Layer**: L1 — Goal Anchoring

Does the project make its goals machine-accessible so the agent solves the right problem?

| Score | Criteria |
|-------|----------|
| 0 | No goal documents exist; agent infers purpose from code alone |
| 1 | README describes the project, but no structured spec or feature list |
| 2 | Some goal documents exist (PRD, spec) but are not referenced from instruction files |
| 3 | Goal documents exist and are referenced from instruction file; agent can find them |
| 4 | Structured feature list or spec with clear acceptance criteria; instruction file links to them; task breakdown traces back to goals |
| 5 | Machine-readable goal definitions (e.g., features.json, structured ADRs); agent can verify task alignment; goal coverage is trackable; goals are versioned and updated with the project |

### What to Check

- Do goal documents exist? (`docs/PRD.md`, `docs/features.md`, `docs/requirements.md`, `docs/decisions/*.md`)
- Does the instruction file (CLAUDE.md) reference them?
- Can the agent trace "why am I doing this task?" back to a stated objective?
- Are goals structured enough for mechanical verification (not just prose)?
- Are goals versioned and up-to-date with current project state?

### Why This Dimension Matters

Without goal alignment, all other harness layers optimize for the wrong target. An agent can have perfect context, strict constraints, and excellent test coverage — and still build the wrong thing. The most dangerous failure mode is not a broken build; it is a successful build of the wrong feature.

---

## Dimension 1: Context Budget

**Principle**: Agent instructions should be concise, structured, and progressively disclosed — not a monolithic dump.

**Layer**: L2 — Context Engineering

How well does the project manage AI instruction files (CLAUDE.md, .cursorrules, etc.)?

| Score | Criteria |
|-------|----------|
| 0 | No instruction file exists |
| 1 | Instruction file exists but is unstructured or >300 lines |
| 2 | Under 200 lines, some organization (headers/sections) |
| 3 | Under 150 lines, uses progressive disclosure (some links to external docs) |
| 4 | Under 100 lines, clear TOC structure, links to package-specific docs, quick reference section |
| 5 | Under 100 lines, full progressive disclosure, package-level docs for every package, build/test commands prominent, quick reference covers top recurring rules |

### What to Check

- `wc -l CLAUDE.md` — raw line count
- Does it have a Quick Reference / cheat sheet section?
- Are detailed conventions in separate linked files?
- Do individual packages have their own instruction docs?
- Is the build order / dev setup front and center?

---

## Dimension 2: Memory Architecture

**Principle**: Lessons and patterns must persist across sessions in a retrievable, pruned, and semantically organized form.

**Layer**: L2 — Context Engineering

How are lessons and patterns stored for cross-session persistence?

| Score | Criteria |
|-------|----------|
| 0 | No persistent memory mechanism |
| 1 | Memory exists but is a single large file (>200 lines) or chronological dump |
| 2 | Memory file under 200 lines but no topic splitting |
| 3 | Memory file under 100 lines with some topic files, but no consistent organization |
| 4 | Index file under 100 lines, topic files by subject, semantic (not chronological) organization |
| 5 | Compact index (<50 lines), well-maintained topic files, clear quick rules section, no stale content, regular pruning evidence |

### What to Check

- `wc -l MEMORY.md` — size relative to truncation limit (usually 200 lines)
- Are there separate topic files (e.g., `serverurl-pattern.md`)?
- Is organization semantic (by topic) or chronological (by date)?
- Is there evidence of pruning/cleanup (not just appending)?
- Do critical patterns have their own dedicated files?

---

## Dimension 3: Executable Constraints

**Principle**: Rules that can be mechanically enforced must be mechanically enforced — not left to prompt compliance.

**Layer**: L3 — Execution Constraints

Are lessons and rules enforced through automation, not just documentation?

| Score | Criteria |
|-------|----------|
| 0 | No automated enforcement beyond standard linting |
| 1 | Commitlint or basic pre-commit hooks |
| 2 | Commitlint + type checking in CI |
| 3 | Above + architecture tests or custom lint rules |
| 4 | Above + custom harness checks script (grep-based rules for project-specific patterns) |
| 5 | Custom harness checks in CI, architecture tests, known recurring errors all have automated checks, clear process for adding new checks when errors recur |

### What to Check

- Does CI have a dedicated harness/constraint check job?
- Is there a `scripts/harness-checks.sh` or equivalent?
- Are architecture boundaries enforced by tests?
- For each documented "don't do X" rule: is there an automated check?
- How easy is it to add a new check? (One grep line = frictionless)

---

## Dimension 4: Quality Visibility

**Principle**: The agent must be able to assess risk before acting — not discover problems after the fact.

**Layer**: L4 — Evaluation Loop

Can the agent assess module-level risk before making changes?

| Score | Criteria |
|-------|----------|
| 0 | No quality signals visible to the agent |
| 1 | Test coverage exists but isn't summarized or agent-accessible |
| 2 | Some quality info in docs, but scattered or incomplete |
| 3 | Quality scorecard exists but covers only some modules or dimensions |
| 4 | Module-level scorecard covering tests, docs, types; most modules graded; linked from project instructions |
| 5 | Complete scorecard (tests, docs, API coverage, types) for all modules, clear grade definitions (A-D), update triggers documented, regularly maintained |

### What to Check

- Does `docs/QUALITY_SCORE.md` or equivalent exist?
- Does it cover all modules in the project?
- Are grades clearly defined (what does A vs D mean)?
- Is it referenced from the main instruction file?
- When was it last updated? (Check git log)
- Are there instructions for when to update it?

---

## Dimension 5: Maintenance Mechanism

**Principle**: A harness that doesn't evolve is a harness that decays. The error→lesson→constraint flywheel must be turning.

**Layer**: L4 — Evaluation Loop

Is there a process to keep documentation and harness artifacts healthy?

| Score | Criteria |
|-------|----------|
| 0 | No maintenance process; write-once documentation |
| 1 | Occasional manual review, no defined process |
| 2 | Checklist exists for doc review, but not regularly executed |
| 3 | Defined maintenance skill/process that checks link validity and file sizes |
| 4 | Maintenance process covers links, sizes, quality score freshness, and memory pruning |
| 5 | Automated checks (link validity, size limits) + defined review cadence + clear error→lesson→constraint pipeline + evidence of regular execution |

### What to Check

- Is there a doc-gardening skill or equivalent process?
- Does it check broken links in documentation?
- Does it verify memory file sizes?
- Does it validate quality score freshness?
- Is there evidence of past execution (git log of doc maintenance commits)?
- Is the error→lesson→constraint pipeline documented?
- **Harness vitality**: How many commits touched harness artifacts in the last 30 days? (0 = the flywheel isn't turning)

---

## Overall Score Interpretation

| Range | Level | Layer Focus |
|-------|-------|-------------|
| 0–6 | **Critical** | Agent is flying blind. Verify Goal Alignment (L1) first, then add one quick Executable Constraint (L3). |
| 7–12 | **Basic** | Foundation exists but major gaps. Check if lowest-scoring layer is L1 — if so, fix that before anything else. |
| 13–18 | **Developing** | Good base. Focus on turning documented lessons into automated constraints (L3). |
| 19–24 | **Strong** | Well-harnessed. Focus on the flywheel: every new error → new constraint (L4). |
| 25–30 | **Excellent** | Mature harness. Focus on cross-project sharing and domain-specific adaptation. |

### Layer Priority Rule

When multiple layers score low, fix them in order: **L1 → L2 → L3 → L4**.

A perfect evaluation loop (L4) is useless if the agent is solving the wrong problem (L1). Strong constraints (L3) are useless if the agent lacks the right context (L2). Fix the foundation first.