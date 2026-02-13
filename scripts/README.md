# Scripts Directory

Project-level standard scripts for CCAAS monorepo.

## Purpose

This directory contains **stable, important, and frequently-used** project-level scripts.

These scripts are:
- Part of the standard development workflow
- Maintained and documented
- Expected to be stable and reliable
- Used across multiple packages/solutions

## Scripts

### verify-context-mechanism.sh
**Purpose**: Comprehensive multi-phase verification of the context mechanism implementation.

**What it verifies**:
- Phase 1: Backend context storage (ChatMessageDto, Session entity)
- Phase 2: Shared MCP server build and functionality
- Phase 3: Frontend SDK hooks (usePageContext)
- Phase 4: Solution configuration (lesson-plan-designer)
- Phase 5: End-to-end integration tests

**Usage**:
```bash
./scripts/verify-context-mechanism.sh
```

**When to run**:
- After making changes to context mechanism
- Before deploying to production
- As part of CI/CD pipeline
- When debugging context-related issues

**Exit codes**:
- `0` - All phases passed
- `1` - One or more phases failed

---

## Directory Conventions

### scripts/ (This Directory)
**Criteria for scripts here**:
- ✅ Used frequently by developers
- ✅ Part of standard workflow
- ✅ Stable and well-maintained
- ✅ Cross-package/project-level scope
- ✅ Documented with clear usage instructions

**Examples**:
- Multi-phase verification scripts
- Database migration runners
- Release preparation scripts
- Environment setup scripts

### tools/ (Development Tools)
**Criteria for tools/**:
- One-time verification scripts (tools/verify/)
- Debug/diagnostic scripts (tools/debug/)
- Temporary test scripts (tools/testing/)
- May become obsolete after implementation

### packages/*/scripts/ (Package-Specific)
**Criteria for package scripts**:
- Only used within that specific package
- Package-specific tooling (e.g., create-dev-api-key.ts for backend)

---

## Adding New Scripts

Before adding a script here, ask:

1. **Is it stable?** - If it's experimental or temporary → use `tools/`
2. **Is it frequently used?** - If it's one-time verification → use `tools/verify/`
3. **Is it project-level?** - If it's package-specific → use `packages/*/scripts/`
4. **Is it documented?** - Add usage instructions to this README

---

## See Also

- `tools/README.md` - Development tools and utilities
- `packages/backend/scripts/` - Backend-specific scripts
- `CONTRIBUTING.md` - Development workflow
