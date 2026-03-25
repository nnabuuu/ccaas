# Harness Audit

Assess and improve the harness maturity of any AI Coding project.

Analyzes 5 dimensions of how well a project supports AI coding agents, scores each 0–5, and produces actionable recommendations sorted by ROI.

## When to Use

- User invokes `/harness-audit`
- User mentions "审计", "harness", "优化项目环境", "agent keeps making mistakes"
- Starting work on an unfamiliar project

## Audit Procedure

### Step 1: Gather Data

Read these files (skip if they don't exist):

```
# Project instructions
CLAUDE.md
.cursorrules
.github/copilot-instructions.md

# Sub-package / module instruction files (monorepos)
**/CLAUDE.md
**/CURSOR.md

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

# Monorepo: count ALL instruction file lines
find . -name "CLAUDE.md" -o -name ".cursorrules" 2>/dev/null \
  | grep -v node_modules | grep -v .agent-workspace \
  | xargs wc -l 2>/dev/null | sort -rn

# Flag instruction files over 100 lines
find . -name "CLAUDE.md" -not -path "*/node_modules/*" -not -path "*/.agent-workspace/*" \
  -exec sh -c 'lines=$(wc -l < "$1"); [ "$lines" -gt 100 ] && echo "OVER_100: $1 ($lines lines)"' _ {} \;

# Check if bloated files have supporting docs nearby
for dir in $(find . -name "CLAUDE.md" -not -path "*/node_modules/*" -not -path "*/.agent-workspace/*" -exec dirname {} \;); do
  ls "$dir"/README.md "$dir"/docs/ 2>/dev/null && echo "  ^ supporting docs found in $dir"
done

# Count memory lines
wc -l ~/.claude/projects/*/memory/MEMORY.md 2>/dev/null

# Check for architecture tests
find . -name "*.arch.*" -o -name "*architecture*test*" 2>/dev/null | head -5

# Check controller swagger coverage (if NestJS)
for f in $(find . -name "*.controller.ts" -not -path "*/node_modules/*" 2>/dev/null); do
  grep -L "@ApiTags" "$f" 2>/dev/null
done
```

### Step 2: Score Each Dimension

Use the scoring rubric in `docs/scoring-rubric.md` to assign 0–5 for each dimension:

1. **Context Budget** — Project instructions quality
2. **Memory Architecture** — Lesson storage and retrieval
3. **Executable Constraints** — CI/CD harness enforcement
4. **Quality Visibility** — Module-level risk signals
5. **Maintenance Mechanism** — Documentation health processes

### Step 3: Generate Recommendations

For each dimension scoring below 4:
1. Identify the specific gap
2. Estimate effort (minutes/hours)
3. Assign priority: P0 (止血/stop-bleeding), P1 (建机制/build-mechanism), P2 (长期维护/long-term)
4. Sort by ROI (impact / effort)

#### Context Budget Optimization Methodology

When Context Budget scores below 4, recommend this workflow:

1. **Scan**: flag all instruction files >100 lines
2. **Triage**: check if supporting docs exist nearby (README.md, docs/) — existing docs = lower effort
3. **Categorize content** in each bloated file:
   - **Delete**: rules inherited from root instruction file, generic boilerplate (deployment, response language), future-looking placeholders ("TBD", "TODO")
   - **Link out**: content that duplicates nearby docs (architecture, API specs, DB schemas, setup guides)
   - **Keep & condense**: unique constraints, project-specific rules, developer checklists, critical lessons learned
4. **Rewrite**: apply canonical template (Overview → Quick Links → Critical Rules → Common Tasks → Key Notes), target 80-100 lines
5. **Cross-doc dedup**: when two docs share >50% similar content, one should reference the other
6. **Verify**: line count under target, all links resolve, grep confirms critical rules preserved

See `docs/best-practices.md` for detailed patterns.

### Step 4: Output Report

```markdown
# Harness Audit Report

**Project**: {name}
**Date**: {date}
**Overall Score**: {X}/25

## Summary

| Dimension | Score | Key Finding |
|-----------|-------|-------------|
| Context Budget | {0-5}/5 | {one-line finding} |
| Memory Architecture | {0-5}/5 | {one-line finding} |
| Executable Constraints | {0-5}/5 | {one-line finding} |
| Quality Visibility | {0-5}/5 | {one-line finding} |
| Maintenance Mechanism | {0-5}/5 | {one-line finding} |

## Top Recommendations (by ROI)

1. [{priority}] {action} — {effort estimate}, {expected impact}
2. [{priority}] {action} — {effort estimate}, {expected impact}
3. [{priority}] {action} — {effort estimate}, {expected impact}

## Detailed Findings

### Context Budget ({score}/5)

{Analysis of instruction file size, structure, progressive disclosure usage.
Specific line counts and structural observations.
Comparison to best practices.}

### Memory Architecture ({score}/5)

{Analysis of memory file size, topic splitting, semantic organization.
Whether lessons are retrievable vs just recorded.
Truncation risk assessment.}

### Executable Constraints ({score}/5)

{Analysis of CI/CD pipeline, custom checks, pre-commit hooks.
Gap between documented lessons and automated enforcement.
List of known recurring issues that lack automated checks.}

### Quality Visibility ({score}/5)

{Analysis of quality scoring, test coverage visibility, documentation coverage.
Whether agents can assess module risk before making changes.}

### Maintenance Mechanism ({score}/5)

{Analysis of doc maintenance processes, link validity, freshness checks.
Whether documentation rot is actively managed.}
```

## Response Language

Match the user's language. If Chinese, output the report in Chinese. If English, output in English.
