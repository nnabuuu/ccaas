# Verification Scripts

One-time verification scripts for completed implementations.

## Scripts

### api.sh
Verify REST API endpoints after simplification (ChatController removal).

**Purpose**: Ensures REST API simplification is complete and endpoints are working correctly.

**Created**: 2026-02-13

**Referenced in**: `docs/internal/implementation-summaries/API_SIMPLIFICATION_COMPLETE.md`

**Usage**:
```bash
./tools/verify/api.sh
```

### skills.sh
Verify Phase 1 & 2 auto-load tenant skills mechanism.

**Purpose**: Validates that skills are automatically loaded from tenant directories and properly registered.

**Created**: 2026-02-11

**Referenced in**: `docs/internal/implementation-summaries/AUTO_LOAD_SKILLS_IMPLEMENTATION_SUMMARY.md`

**Usage**:
```bash
./tools/verify/skills.sh
```

## When to Use

These scripts are typically run once after implementation to verify functionality. They may also be useful for:
- Regression testing after major refactoring
- Verifying behavior in different environments
- Documenting expected behavior for new team members
