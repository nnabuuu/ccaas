# Harness Audit

Assess and improve the harness maturity of any AI-assisted project.

Analyzes 6 dimensions across 4 layers of how well a project supports AI agents, scores each 0–5 (total 0–30), and produces actionable recommendations sorted by ROI.

## Framework: 4-Layer Harness Model

| Layer | Audit Dimension(s) | Core Question |
|-------|-------------------|---------------|
| L1: Goal Anchoring | **Goal Alignment** | Is the agent solving the right problem? |
| L2: Context Engineering | **Context Budget** + **Memory Architecture** | Does the agent have the right knowledge? |
| L3: Execution Constraints | **Executable Constraints** | Is the agent mechanically prevented from doing wrong things? |
| L4: Evaluation Loop | **Quality Visibility** + **Maintenance Mechanism** | Can we verify output and does the harness improve over time? |

## When to Use

- User invokes `/harness-audit`
- User mentions "审计", "harness", "优化项目环境", "agent keeps making mistakes"
- Starting work on an unfamiliar project
- Periodic health check (recommended: monthly)

## Audit Procedure

### Step 1: Gather Data

Read these files (skip if they don't exist):

```
# Goal documents
README.md
docs/PRD.md
docs/product-spec.md
docs/requirements.md
docs/features.md
docs/decisions/*.md

# Project instructions
CLAUDE.md
.cursorrules
.github/copilot-instructions.md

# Memory
~/.claude/projects/*/memory/MEMORY.md
~/.claude/projects/*/memory/*.md

# CI/CD
.github/workflows/*.yml
.gitlab-ci.yml
scripts/harness-checks.sh
.husky/pre-commit
.commitlintrc*
commitlint.config.*

# Quality signals
docs/QUALITY_SCORE.md
coverage/
jest.config.*
vitest.config.*

# Documentation
docs/
README.md
CONTRIBUTING.md
```

Also run:
```bash
# Count instruction file lines
wc -l CLAUDE.md .cursorrules 2>/dev/null

# Count memory lines
wc -l ~/.claude/projects/*/memory/MEMORY.md 2>/dev/null

# Check for goal/spec documents
find docs/ -maxdepth 2 \( -name "PRD*" -o -name "spec*" -o -name "requirements*" -o -name "features*" \) 2>/dev/null

# Check if instruction file references goal documents
grep -i -E "(goal|objective|spec|prd|requirement|feature)" CLAUDE.md 2>/dev/null

# Check for architecture tests
find . -name "*.arch.*" -o -name "*architecture*test*" 2>/dev/null | head -5

# Check for custom harness scripts
find scripts/ -name "*harness*" -o -name "*check*" -o -name "*lint*" 2>/dev/null

# Harness vitality: modifications to harness artifacts in last 30 days
echo "Harness commits (30d):"
git log --since="30 days ago" --oneline -- \
  CLAUDE.md .cursorrules docs/ scripts/harness-checks.sh \
  .eslintrc* commitlint.config.* 2>/dev/null | wc -l
echo "Total commits (30d):"
git log --since="30 days ago" --oneline 2>/dev/null | wc -l

# Check controller swagger coverage (if NestJS)
for f in $(find . -name "*.controller.ts" -not -path "*/node_modules/*" 2>/dev/null); do
  grep -L "@ApiTags" "$f" 2>/dev/null
done
```

### Step 2: Score Each Dimension

Use the scoring rubric in `docs/scoring-rubric.md` to assign 0–5 for each of the 6 dimensions:

0. **Goal Alignment** (L1) — Is the agent anchored to the right objectives?
1. **Context Budget** (L2) — Project instructions quality and structure
2. **Memory Architecture** (L2) — Lesson storage and cross-session persistence
3. **Executable Constraints** (L3) — CI/CD and automated enforcement
4. **Quality Visibility** (L4) — Module-level risk signals for the agent
5. **Maintenance Mechanism** (L4) — Documentation health and harness evolution

### Step 3: Generate Recommendations

For each dimension scoring below 4:
1. Identify the specific gap
2. Estimate effort (minutes/hours)
3. Assign priority: P0 (止血/stop-bleeding), P1 (建机制/build-mechanism), P2 (长期维护/long-term)
4. Sort by ROI (impact / effort)

### Step 4: Output Report

```markdown
# Harness Audit Report

**Project**: {name}
**Date**: {date}
**Overall Score**: {X}/30
**Harness Vitality**: {N} harness commits in last 30 days ({percentage}% of total commits)

## Summary

| # | Dimension | Layer | Score | Key Finding |
|---|-----------|-------|-------|-------------|
| 0 | Goal Alignment | L1 | {0-5}/5 | {one-line finding} |
| 1 | Context Budget | L2 | {0-5}/5 | {one-line finding} |
| 2 | Memory Architecture | L2 | {0-5}/5 | {one-line finding} |
| 3 | Executable Constraints | L3 | {0-5}/5 | {one-line finding} |
| 4 | Quality Visibility | L4 | {0-5}/5 | {one-line finding} |
| 5 | Maintenance Mechanism | L4 | {0-5}/5 | {one-line finding} |

## Layer Health

| Layer | Dimensions | Avg Score | Status |
|-------|-----------|-----------|--------|
| L1: Goal Anchoring | Goal Alignment | {X}/5 | {🔴🟡🟢} |
| L2: Context Engineering | Context Budget + Memory | {avg}/5 | {🔴🟡🟢} |
| L3: Execution Constraints | Executable Constraints | {X}/5 | {🔴🟡🟢} |
| L4: Evaluation Loop | Quality + Maintenance | {avg}/5 | {🔴🟡🟢} |

## Top Recommendations (by ROI)

1. [{priority}] {action} — {effort estimate}, {expected impact}
2. [{priority}] {action} — {effort estimate}, {expected impact}
3. [{priority}] {action} — {effort estimate}, {expected impact}

## Detailed Findings

### D0: Goal Alignment ({score}/5)

{Does the project have explicit goal documents (PRD, spec, feature list)?
Does the instruction file reference these goals?
Can the agent trace a task back to a stated objective?
Are goals structured enough for mechanical verification?}

### D1: Context Budget ({score}/5)

{Analysis of instruction file size, structure, progressive disclosure usage.
Specific line counts and structural observations.
Comparison to best practices.}

### D2: Memory Architecture ({score}/5)

{Analysis of memory file size, topic splitting, semantic organization.
Whether lessons are retrievable vs just recorded.
Truncation risk assessment.}

### D3: Executable Constraints ({score}/5)

{Analysis of CI/CD pipeline, custom checks, pre-commit hooks.
Gap between documented lessons and automated enforcement.
List of known recurring issues that lack automated checks.}

### D4: Quality Visibility ({score}/5)

{Analysis of quality scoring, test coverage visibility, documentation coverage.
Whether agents can assess module risk before making changes.}

### D5: Maintenance Mechanism ({score}/5)

{Analysis of doc maintenance processes, link validity, freshness checks.
Harness vitality score (git activity on harness artifacts).
Whether the error→lesson→constraint flywheel is turning.}
```

## Response Language

Match the user's language. If Chinese, output the report in Chinese. If English, output in English.