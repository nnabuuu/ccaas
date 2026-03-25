# Quality Score

Last updated: 2026-03-17

Grades help agents understand which modules need extra care when making changes.

| Module | Tests | Docs | Swagger | Types | Grade |
|--------|-------|------|---------|-------|-------|
| backend/auth | ✅ | ✅ | ✅ | ✅ | A |
| backend/sessions | ✅ | ⚠️ | ✅ | ✅ | B |
| backend/skills | ✅ | ✅ | ✅ | ✅ | A |
| backend/mcp | ⚠️ | ✅ | ✅ | ✅ | B |
| backend/scheduler | ❌ | ⚠️ | ✅ | ⚠️ | D |
| backend/jobs | ❌ | ❌ | ✅ | ⚠️ | D |
| backend/builder | ❌ | ✅ | ✅ | ✅ | C |
| admin-next | ❌ | ❌ | N/A | ⚠️ | D |
| vue-sdk | ✅ | ✅ | N/A | ✅ | A |
| react-sdk | ⚠️ | ⚠️ | N/A | ✅ | C |
| common | ✅ | ⚠️ | N/A | ✅ | B |

## Legend

- ✅ Good coverage / up to date
- ⚠️ Partial / needs improvement
- ❌ Missing or very incomplete

## Grades

- **A**: Well tested, documented, typed. Safe to modify.
- **B**: Mostly covered. Minor gaps. Proceed with normal care.
- **C**: Gaps in testing or docs. Read existing code carefully before changes.
- **D**: Significant gaps. Extra caution required. Consider adding tests before modifying.

## When to Update

Update this file when:
- Adding or improving tests for a module
- Completing documentation for a module
- Adding Swagger annotations
- Improving type coverage

Use `/doc-gardening` skill to check if scores need updating.
