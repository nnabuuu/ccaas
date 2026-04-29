# Harness Audit Scoring Rubric

Optional numerical scoring for users who want to track progress over time. Each self-deception is scored 0-5. Total score: 0-25.

**Primary output is always narrative diagnosis.** Scores are supplementary — use them to measure improvement between audits, not as the main deliverable.

---

## Self-Deception 1: The Stale Goal (L1)

**What you think:** "I have a goal."
**What's actually true:** Your goal doc is stale, disconnected from the agent, or nonexistent.

| Score | What it looks like |
|-------|-------------------|
| 0 | No goal/spec/PRD document exists. Agent infers purpose from code alone. |
| 1 | Goal document exists but is generic ("build a good product") with no acceptance criteria. |
| 2 | Goal document has some specificity but is not referenced from the instruction file — agent can't find it. |
| 3 | Goal document exists, is referenced from instruction file, but last updated 60+ days ago. Likely drifted from reality. |
| 4 | Goal document is current (updated within 30 days), referenced from instruction file, has verifiable acceptance criteria. |
| 5 | Goal document is machine-readable, versioned, updated with the project. Agent can verify task alignment against stated objectives. |

### Detection signals
- Does a goal doc exist? (PRD, spec, features, requirements)
- Does the instruction file reference it?
- How old is it relative to recent project activity?
- Does it contain verifiable criteria, or just vague descriptions?

---

## Self-Deception 2: The Monolith (L2)

**What you think:** "I have instructions."
**What's actually true:** Everything is in one file with no priority structure. Agent makes its own priority judgments.

| Score | What it looks like |
|-------|-------------------|
| 0 | No instruction file exists. |
| 1 | Instruction file exists but is >150 lines, no sections, no links — a wall of text. |
| 2 | Some organization (headers/sections) but critical rules and preferences still mixed. Emphasis ratio >50%. |
| 3 | Under 100 lines, some links to external docs, but no package/module-level files. |
| 4 | Compact core (<80 lines), clear separation of critical rules vs preferences, links to detailed docs. Some module-level instruction files. |
| 5 | Full progressive disclosure: compact index, every module has its own instruction file, tool-based access to external knowledge. Agent has a "map," not a "manual." |

### Detection signals
- Line count of main instruction file
- Number of links to external docs (progressive disclosure)
- Existence of module-level instruction files
- "Must/never/always" ratio — if >50%, nothing is actually prioritized

---

## Self-Deception 3: The Paper Rule (L3)

**What you think:** "I have checks."
**What's actually true:** Your checks are generic defaults. Project-specific rules are documented but not enforced.

| Score | What it looks like |
|-------|-------------------|
| 0 | No automated checks of any kind. |
| 1 | Framework-default lint/typecheck only. Zero project-specific rules automated. |
| 2 | Some custom checks exist, but the majority of "don't do X" rules in the instruction file have no corresponding automated enforcement. |
| 3 | Most common error patterns have automated checks. A few paper rules remain. |
| 4 | All documented "don't do X" rules have automated enforcement. Adding a new check is easy (one line in a script). |
| 5 | Comprehensive checkpoint system including project-specific checks, security constraints, and a clear process for converting new errors into new checks. |

### Detection signals
- Count "don't/never/must not" rules in instruction file
- Count corresponding automated checks in CI/hooks/scripts
- Gap = paper rules (documented but unenforced)
- Existence of custom check scripts (not just framework defaults)

---

## Self-Deception 4: The Gut Review (L4)

**What you think:** "I review everything."
**What's actually true:** No systematic criteria. Quality depends on how busy you are that day.

| Score | What it looks like |
|-------|-------------------|
| 0 | No review process. Agent output accepted without inspection. |
| 1 | Human reviews output, but with no checklist, no reference, no criteria — pure gut feel. |
| 2 | Some review criteria exist informally but aren't consistently applied. |
| 3 | Written review criteria or quality scorecard exists. Clear definition of "done right." |
| 4 | Review partially automated — quality scorecard with module grades, test coverage thresholds, or a review agent. Human review focused on judgment calls. |
| 5 | Systematic review with execution/review separation. Automated comparison against goals. Human review only for edge cases. |

### Detection signals
- Existence of quality scorecard (QUALITY_SCORE.md or equivalent)
- Test coverage configuration
- Review automation in CI
- Evidence of structured review criteria anywhere in project docs

---

## Self-Deception 5: The Frozen Harness (L4)

**What you think:** "I set up my harness."
**What's actually true:** Nothing harness-related has changed since initial setup. The flywheel isn't turning.

| Score | What it looks like |
|-------|-------------------|
| 0 | No harness artifacts exist to update. |
| 1 | Harness artifacts exist but last modified 90+ days ago. Write-once, never maintained. |
| 2 | Some updates in the last 90 days, but sporadic and unstructured. |
| 3 | Evidence of updates in the last 30 days. Some error→rule conversions visible in git history. |
| 4 | Regular updates (multiple harness commits per month). Clear pattern of errors becoming checks. |
| 5 | Active flywheel: harness updated weekly, documented error→rule conversions, artifact freshness checks, stale content actively pruned. |

### Detection signals
- Harness-related commits in last 30 days (and as % of total commits)
- Last modified date of instruction file
- Evidence of new check rules added recently
- Evidence of documentation pruning/cleanup

---

## Overall Score Interpretation

| Range | Level | What it means |
|-------|-------|---------------|
| 0-5 | **L0 Vibe** | Agent is flying blind. Most self-deceptions present. |
| 6-10 | **L1 Prompted** | Setup exists but is largely decorative. Focus on The Stale Goal first. |
| 11-15 | **L2 Structured** | Framework taking shape. Convert paper rules to automated checks. |
| 16-20 | **L3 Constrained** | Solid. Focus on review systematization and flywheel. |
| 21-25 | **L4 Self-improving** | Mature. Focus on cross-project reuse and domain adaptation. |

### Priority Rule

Always fix in order: **Self-Deception 1 → 2 → 3 → 4 → 5.**

A stale goal makes everything downstream pointless. Fix the goal before touching anything else.
