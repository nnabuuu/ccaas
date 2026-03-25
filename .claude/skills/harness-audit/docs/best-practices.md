# Harness Engineering Best Practices

Patterns and anti-patterns for harness engineering. Use as reference when making audit recommendations.

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

### Pattern: Instruction File Optimization Methodology

When instruction files grow beyond their budget, follow this 6-step workflow:

1. **Scan**: flag all instruction files over 100 lines (`find . -name "CLAUDE.md" -exec wc -l`)
2. **Triage**: check if supporting docs exist nearby (README.md, docs/) — existing docs = lower effort to link out
3. **Categorize**: classify each section as Delete, Link Out, or Keep (see Content Categorization below)
4. **Rewrite**: apply the Sub-Module Template, target 80–100 lines
5. **Dedup**: when two docs share >50% similar content, one should reference the other
6. **Verify**: run the Post-Optimization Verification checklist

### Pattern: Content Categorization

When triaging bloated instruction files, classify each block of content:

- **Delete**: rules already inherited from root instruction file, generic boilerplate (deployment steps, response language), future-looking placeholders ("TBD", "TODO"), commented-out sections
- **Link out**: content that duplicates nearby docs (architecture overviews, API specs, DB schemas, setup guides). Replace with a one-line link: `## Architecture → See docs/ARCHITECTURE.md`
- **Keep & condense**: unique constraints, project-specific rules, developer checklists, critical lessons learned, build/test commands

Rule of thumb: if content exists in a nearby doc, replace it with a one-line link.

### Pattern: Sub-Module Template

Standard structure for sub-package or solution-level instruction files:

```markdown
## Overview (2-3 lines — what this package does)
## Quick Links (links to supporting docs: README, design docs, API specs)
## Critical Rules (unique constraints only — NOT rules from root)
## Common Tasks (developer checklist: build, test, debug commands)
## Key Notes (condensed implementation details, gotchas)
```

Target: 80–100 lines. Differs from root template by being domain-focused, including package-specific commands, and omitting rules already present in the root instruction file.

### Pattern: Cross-Doc Dedup

When two documentation files share >50% similar content, one should reference the other instead of repeating. Choose the most canonical location to keep the full content (usually the more specific or authoritative doc), and replace the duplicate with a link.

Dedup applies across instruction files, READMEs, and docs/ files — not just within instruction files.

### Pattern: Post-Optimization Verification

After optimizing instruction files, verify with this checklist:

- [ ] `wc -l` confirms each file is under its target (root <100, sub-modules <100)
- [ ] All markdown links point to files that exist (`grep -oP '\[.*?\]\(.*?\)' | ...`)
- [ ] `grep` confirms critical rules are still present (not accidentally deleted)
- [ ] No content duplicated between sub-files and root instruction file
- [ ] Quick Links section covers all supporting docs in the directory

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
