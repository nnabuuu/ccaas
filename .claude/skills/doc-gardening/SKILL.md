# Doc Gardening

Scan and fix documentation health across the repository.

## Checks to Run

1. **Broken file references**: Verify all file paths referenced in CLAUDE.md and docs/ actually exist
2. **Swagger coverage**: Check all backend controllers have `@ApiTags` decorator
3. **Gitbook sync**: Verify gitbook API docs cover all endpoints listed in controllers
4. **MEMORY.md size**: Check auto-memory MEMORY.md stays under 100 lines (truncated at 200)
5. **QUALITY_SCORE.md freshness**: Review if module grades still reflect reality
6. **Stale ADRs**: Flag ADRs referencing deleted code or outdated decisions

## How to Run Each Check

### 1. Broken File References
```bash
# Extract all markdown links from CLAUDE.md and docs/
grep -rohP '\[.*?\]\((\.\/[^)]+)\)' CLAUDE.md docs/*.md | grep -oP '\(([^)]+)\)' | tr -d '()' | while read path; do
  [ ! -e "$path" ] && echo "BROKEN: $path"
done
```

### 2. Swagger Coverage
```bash
bash scripts/harness-checks.sh
```

### 3. MEMORY.md Size
```bash
wc -l ~/.claude/projects/*/memory/MEMORY.md
# Should be < 100 lines
```

### 4. Quality Score Review
- Open `docs/QUALITY_SCORE.md`
- For each D-grade module, check if tests/docs have been added since last update
- Update grades as needed

## Output

Report findings in a summary table and fix what can be auto-fixed:
- Broken links → suggest corrections
- Missing @ApiTags → list affected controllers
- MEMORY.md over limit → suggest content to move to topic files
- Stale quality scores → propose updated grades
