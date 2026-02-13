# Tools Directory

Development tools and utilities for debugging, testing, and one-time verification.

## Purpose

This directory contains **temporary, experimental, or one-time** development scripts.

These scripts are:
- Used during active development
- For debugging and troubleshooting
- One-time verification after implementation
- May become obsolete after the feature stabilizes

## Directory Structure

- **verify/** - One-time verification scripts for completed implementations
- **debug/** - Diagnostic scripts for troubleshooting issues
- **testing/** - Manual testing scripts for API endpoints and features
- **solution-lib.sh** - Shared library functions for solution management
- **benchmark-solutions.sh** - Performance benchmarking tool

## Usage

All scripts are executable. Run from project root:

```bash
# Verification scripts (one-time checks)
./tools/verify/api.sh
./tools/verify/skills.sh

# Debug scripts (troubleshooting)
./tools/debug/file-hook.sh

# Testing scripts (manual API testing)
./tools/testing/file-registration.sh
```

---

## Directory Conventions

### tools/ (This Directory)
**Criteria for scripts here**:
- ✅ Temporary or experimental
- ✅ One-time verification after implementation
- ✅ Debugging and troubleshooting
- ✅ May become obsolete

**When to use**:
- Verifying a newly implemented feature
- Debugging a specific issue
- Manual testing of API endpoints
- Temporary utility scripts

### scripts/ (Project-Level Standard Scripts)
**Criteria for ../scripts/**:
- ✅ Frequently used by developers
- ✅ Part of standard workflow
- ✅ Stable and well-maintained
- ✅ Cross-package/project-level scope

**Examples**:
- `scripts/verify-context-mechanism.sh` - Multi-phase comprehensive verification

### packages/*/scripts/ (Package-Specific)
**Criteria**:
- Only used within that specific package
- Package-specific tooling

**Examples**:
- `packages/backend/scripts/create-dev-api-key.ts`

---

## Script Lifecycle

1. **Initial Creation** → `tools/verify/` or `tools/debug/`
2. **Becomes Frequently Used** → Consider moving to `scripts/`
3. **No Longer Needed** → Move to `docs/internal/deprecated/`

---

## See Also

- `scripts/README.md` - Project-level standard scripts
- `docs/internal/deprecated/` - Archived deprecated scripts
- Individual README files in each subdirectory for detailed documentation
