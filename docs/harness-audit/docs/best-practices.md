# Harness Engineering Best Practices

Extracted from the KedgeAgentic project harness improvement. Use as reference when making audit recommendations.

## Goal Alignment

### Pattern: Explicit Goal Documents

The agent should never have to guess what the project is trying to achieve.

**Minimum viable setup:**
```
docs/
├── PRD.md or requirements.md    # What the product does and why
├── features.md                  # Structured feature list with status
└── decisions/                   # Architecture Decision Records
    ├── 001-auth-strategy.md
    └── 002-api-versioning.md
```

**Key rule**: The instruction file (CLAUDE.md) must reference these documents. If goals exist but aren't linked from the instruction file, they're invisible to the agent.

### Pattern: Structured Feature List

Prefer machine-readable formats (JSON, YAML, or structured Markdown with consistent status markers) over free-form prose:

```markdown
| Feature | Status | Acceptance Criteria | Priority |
|---------|--------|-------------------|----------|
| User auth | ✅ Done | OAuth2 + JWT, session expiry < 24h | P0 |
| File upload | 🔄 In progress | Max 10MB, S3 backend, progress bar | P1 |
| Export CSV | ❌ Not started | All list views, UTF-8, <5s for 10k rows | P2 |
```

This lets the agent verify: "Is my current task traceable to a stated feature?"

### Anti-pattern: Goals in People's Heads

If the product direction lives in Slack threads, meeting notes, or the founder's head, the agent will fill the gap with its own interpretation. This leads to goal drift — the agent builds something plausible but wrong.

**Fix**: After any significant decision, write it into `docs/decisions/` and link it from the instruction file. The cost is 5 minutes; the alternative is hours of misdirected agent work.

## Context Budget

### Pattern: TOC + Quick Reference

The instruction file should be a table of contents, not an encyclopedia.

**Structure that works:**
```markdown
# Project Name

## Directory Structure (tree, ~10 lines)
## Package Overview (table, ~8 lines)
## Build Commands (code block, ~5 lines)
## Package-Specific Guides (links to per-package docs)
## Conventions → See docs/CONVENTIONS.md
## Workflow → See docs/WORKFLOW.md
## Quick Reference (bullet list of top 5-7 rules)
```

**Key metric**: Under 100 lines total. If you're over 150, start extracting.

### Pattern: Per-Package Docs

Each package should have its own instruction file covering:
- Package-specific conventions
- Test patterns and mocking strategies
- Common pitfalls specific to that package
- Architectural constraints

Agent loads these only when working on that package = no context waste.

## Memory Architecture

### Pattern: Index + Topic Files

```
memory/
├── MEMORY.md              # Index (< 50 lines) + Quick Rules
├── serverurl-pattern.md   # Detailed: root cause, broken patterns, correct pattern
├── architecture-boundaries.md
├── socket-events.md
├── frontend-patterns.md
└── commit-push.md
```

**MEMORY.md structure:**
```markdown
# Project Memory Index

## Critical Patterns (read topic files for details)
- [Topic Name](./topic-file.md) - One-line description

## Quick Rules
- Rule 1: concise, actionable
- Rule 2: concise, actionable

## User Preferences
- Preference 1
- Preference 2
```

### Anti-pattern: Chronological Append

```markdown
# Memory
## 2024-01-15: Found that serverUrl can't be empty
## 2024-01-16: Learned about architecture boundaries
## 2024-01-17: Updated serverUrl again, same issue
## 2024-01-20: ...
(500 more lines)
```

Problems: not searchable by topic, grows without bound, truncated from the top (losing oldest/most important lessons).

## Executable Constraints

### Pattern: Harness Checks Script

```bash
#!/bin/bash
set -e

ERRORS=0

# Check 1: [Description of what recurring error this prevents]
echo "  [1/N] Checking [pattern name]..."
if grep -rn "[bad pattern]" --include="*.ts" src/ | grep -v "test"; then
  echo "  ERROR: [What's wrong and how to fix it]"
  ERRORS=$((ERRORS + 1))
else
  echo "  OK"
fi

# Check 2: [Next check]
# ...

if [ $ERRORS -gt 0 ]; then
  echo "FAILED: $ERRORS harness check(s) failed."
  exit 1
fi
echo "All harness checks passed."
```

**Key properties:**
- Each check maps to a specific recurring error
- Error messages explain both the problem and the fix
- Easy to add new checks (one grep block)
- Non-blocking warnings for lower-severity issues
- Runs in CI as a dedicated job

### Pattern: CI Integration

```yaml
harness-checks:
  name: Harness Checks
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Run harness checks
      run: bash scripts/harness-checks.sh
```

Runs in parallel with lint, test, build — doesn't slow the pipeline.

### Anti-pattern: Relying on Documentation Alone

"We documented that you shouldn't use empty serverUrl" → Agent ignores it → Same bug → More documentation → Ignored again.

**Fix**: One line of grep in CI > 100 lines of documentation.

## Quality Visibility

### Pattern: Module Scorecard

```markdown
| Module | Tests | Docs | API | Types | Grade |
|--------|-------|------|-----|-------|-------|
| auth   | ✅    | ✅   | ✅  | ✅    | A     |
| jobs   | ❌    | ❌   | ✅  | ⚠️    | D     |
```

**Grade definitions** (must be explicit):
- **A**: Safe to modify. Well tested, documented, typed.
- **B**: Mostly covered. Minor gaps. Normal caution.
- **C**: Gaps exist. Read existing code carefully before changes.
- **D**: Significant gaps. Extra caution. Consider adding tests before modifying.

**Update triggers** (document when to update):
- Adding/improving tests for a module
- Completing documentation
- Adding API annotations
- Improving type coverage

## Maintenance Mechanism

### Pattern: Doc Gardening Skill

A repeatable audit that checks:

1. **Broken file references**: All links in instruction files resolve to existing files
2. **Size limits**: Memory files under threshold (usually 100 lines for index)
3. **Quality score freshness**: Grades still match reality
4. **Stale content**: Architecture decisions referencing deleted code

### Pattern: Error → Lesson → Constraint Pipeline

When an error occurs:

1. **Immediate**: Fix the bug
2. **Same session**: Write lesson to memory topic file
3. **Same PR**: Add grep check to harness-checks.sh if pattern is greppable
4. **Next review**: Update Quality Score if module grade changed

This pipeline should be documented so any team member (human or AI) follows it.

### Pattern: Harness Vitality Check

Run this monthly to verify the flywheel is turning:

```bash
echo "Harness commits (30d):"
git log --since="30 days ago" --oneline -- \
  CLAUDE.md .cursorrules docs/ scripts/harness-checks.sh \
  .eslintrc* commitlint.config.* | wc -l
echo "Total commits (30d):"
git log --since="30 days ago" --oneline | wc -l
```

A healthy project should show harness artifacts being touched regularly. Zero harness commits in 30 days means either the harness is perfect (unlikely) or the flywheel has stopped.

## The Flywheel

```
Error occurs
    ↓
Fix the bug (immediate)
    ↓
Record the lesson (memory topic file)
    ↓
Automate the check (harness-checks.sh)
    ↓
Error can never recur
    ↓
Trust the agent more
    ↓
Grant more autonomy
    ↓
Agent is more productive
    ↓
(repeat — each cycle cheaper than the last)
```

The key insight: **the cost of adding a new constraint decreases over time** (infrastructure is already in place), while **the value of each constraint is permanent** (prevents the error forever). This creates compounding returns.