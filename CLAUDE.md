# CLAUDE.md - KedgeAgentic (即见Agentic) Monorepo

This file provides guidance to Claude Code when working with this monorepo.

## Project Overview

This is the **KedgeAgentic (即见Agentic)** monorepo containing all packages for running and interacting with a relay service for AgentEngine instances (supports Claude Code, OpenCode, and custom engines).

**Platform Context**: KedgeAgentic is a **hosted platform** where users interact via the platform interface. Users do NOT install AgentEngine themselves - the platform manages all AgentEngine infrastructure. Always frame documentation and code from the platform user perspective, not from a self-hosted installation perspective.

## Directory Structure

```
ccaas/
├── package.json                 # Workspace root (npm workspaces)
├── packages/
│   ├── backend/                 # @ccaas/backend - NestJS server
│   ├── admin-next/              # @ccaas/admin-next - React admin UI (Refine + shadcn/ui)
│   ├── vue-sdk/                 # @ccaas/vue-sdk - Vue composables
│   ├── react-sdk/               # @ccaas/react-sdk - React hooks
│   └── shared/                  # @ccaas/common - Shared types
└── docs/                        # Consolidated documentation
```

## Package Overview

| Package | Tech Stack | Purpose |
|---------|------------|---------|
| `@ccaas/backend` | NestJS, TypeORM, Socket.io | API server, AgentEngine lifecycle management, session management, scheduled tasks |
| `@ccaas/admin-next` | React, Refine, shadcn/ui, Tailwind | Admin dashboard |
| `@ccaas/vue-sdk` | Vue 3 Composition API | Vue client integration |
| `@ccaas/react-sdk` | React hooks, Socket.io | React client integration |
| `@ccaas/common` | TypeScript, Zod | Types and protocols |

## Build Commands

```bash
# Install all dependencies
npm install

# Build all packages
npm run build

# Build specific package
npm run build:shared    # Build shared first (required)
npm run build:backend
npm run build:admin
npm run build:vue-sdk
npm run build:react-sdk

# Development
npm run dev:backend     # Start backend on :3001
npm run dev:admin       # Start admin on :5175
```

## Package Dependencies

```
@ccaas/common           <- No internal deps
    ↑
@ccaas/vue-sdk         <- Depends on shared
@ccaas/react-sdk       <- Depends on shared
    ↑
@ccaas/admin-next      <- Can use react-sdk (optional)

@ccaas/backend         <- Can use shared types (optional)
```

**Build order:** shared → vue-sdk/react-sdk → admin-next/backend

## Key Conventions

### Imports

```typescript
// Import from workspace packages
import { Session, Skill, TokenUsage } from '@ccaas/common'
import { useAgentState, useFormBridge } from '@ccaas/vue-sdk'
```

### Adding New Types

1. Add interface to `packages/common/src/types/index.ts`
2. Re-export from `packages/common/src/index.ts`
3. Run `npm run build:shared`
4. Import from `@ccaas/common` in consumer packages

### Adding New Protocols

1. Add to `packages/common/src/protocols/`
2. Export from `packages/common/src/protocols/index.ts`
3. Run `npm run build:shared`

### Adding New Composables (vue-sdk)

1. Create file in `packages/vue-sdk/src/composables/`
2. Export from `packages/vue-sdk/src/composables/index.ts`
3. Document usage in file JSDoc

## Testing

```bash
# Run all tests
npm run test

# Run specific package tests
npm run test -w @ccaas/backend
npm run test -w @ccaas/vue-sdk
npm run test -w @ccaas/common
```

## Individual Package Details

Each package has its own documentation:

- **@ccaas/backend**: See `packages/backend/CLAUDE.md`
- **@ccaas/admin-next**: See `packages/admin-next/README.md`
- **@ccaas/vue-sdk**: See `packages/vue-sdk/docs/ARCHITECTURE.md`
- **@ccaas/react-sdk**: See `packages/react-sdk/README.md`
- **@ccaas/common**: See `packages/common/README.md`

For package-specific conventions and guidelines, refer to the documentation within each package directory.

## Development Principles

**Core Principles**:

1. **Tests are contracts** - Trust tests over plans. Run tests before and after changes.
2. **Architecture separation** - Core = infrastructure, Solutions = domain logic
3. **Simplicity first** - Don't over-engineer. Implement exactly what's requested.

**Detailed guidelines**: See [docs/DEVELOPMENT_PRINCIPLES.md](./docs/DEVELOPMENT_PRINCIPLES.md)

**Critical checklists**:
- Before code changes: Run `npm test`, check API contracts
- After code changes: Run tests immediately, fix failures before continuing
- Adding entities: Infrastructure → core, Domain → solution backend

## Development Workflow

**Core workflow**:
```
Linear Issue → Branch → TDD → PR → Code Review → CI → Merge → Done
                                    ↓
                            code-reviewer + code-simplifier
```

**Quick commands**:
```bash
# Create branch
git checkout -b feature/nie-123-description

# TDD development
npm test  # Ensure tests pass first

# Commit (auto-validated)
git commit -m "feat(scope): description"

# Create PR
gh pr create --fill

# Code review (use BOTH agents)
"请用 code-reviewer 和 code-simplifier 两个 agent review 这个 PR"
```

**Code Review Process**:
1. **code-reviewer**: Checks quality, security, performance, test coverage
2. **code-simplifier**: Identifies over-engineering and suggests simplifications
3. Both reviews must pass before merge

**Detailed workflow**: See [docs/WORKFLOW.md](./docs/WORKFLOW.md) and [CONTRIBUTING.md](./CONTRIBUTING.md)

### Task Tracking with Linear

All tasks are automatically tracked in Linear using the `linear-task-workflow` skill:

- **New tasks**: Linear issue auto-created when you describe a task
- **Progress updates**: Milestones recorded in Linear comments
- **Final summary**: Complete deliverables summary in Linear
- **No `*_COMPLETE.md` files**: All tracking in Linear, not code repo

For details, see: [`.claude/skills/linear-task-workflow/SKILL.md`](.claude/skills/linear-task-workflow/SKILL.md)

### Documentation Rules

**Don't create**:
- ❌ `PHASE_*_COMPLETE.md` - Use Linear comments
- ❌ `*_IMPLEMENTATION.md` - Use Linear summary
- ❌ `*_PROGRESS.md` - Use Linear status

**Do create** (only when necessary):
- ✅ ADR (`docs/adr/`) - For architectural decisions
- ✅ Implementation guides (`docs/implementation/`) - For complex mechanisms
- ✅ API docs - For new endpoints

**Decision tree**: See [docs/PROJECT_MANAGEMENT_GUIDE.md](./docs/PROJECT_MANAGEMENT_GUIDE.md)

### Commit Message Convention

Format: `<type>(<scope>): <subject>`

**Types**: feat, fix, refactor, docs, test, chore, perf
**Scopes**: backend, frontend, react-sdk, vue-sdk, admin, docs, common, ci, deps

**Examples**:
```
feat(backend): add JWT authentication
fix(react-sdk): fix API response parsing
docs(readme): update installation guide
```

**Reference Linear**: Include `Related: NIE-XX` in commit body.

Git hooks automatically validate format.

### Architecture Testing

```bash
npm run test:architecture

# Checks:
# ✅ Core backend has no domain entities
# ✅ No imports from solutions/
# ✅ Entities in correct locations
```

## Refactoring Guidelines

### Terminology and Field Name Changes

When refactoring terminology or field names across the codebase:

1. **Search First**: Use `Grep` to find ALL usages before making changes
2. **Document Scope**: List all affected files and usage contexts
3. **Verify Coverage**: After changes, grep again to ensure no instances were missed
4. **Update Tests**: Check that tests reflect the new terminology
5. **Update Documentation**: Ensure all docs use consistent terminology

**Example**:
```bash
# 1. Find all usages
grep -r "old_term" --include="*.ts" --include="*.tsx" --include="*.md"

# 2. Make changes across all files
# ... edit files ...

# 3. Verify no old usages remain
grep -r "old_term" --include="*.ts" --include="*.tsx" --include="*.md"
```

This ensures complete coverage and prevents partial refactoring.

## Key Documentation

- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contribution guidelines
- **[docs/WORKFLOW.md](./docs/WORKFLOW.md)** - Detailed workflow
- **[docs/DEVELOPMENT_PRINCIPLES.md](./docs/DEVELOPMENT_PRINCIPLES.md)** - TDD, architecture, best practices
- **[docs/PROJECT_MANAGEMENT_GUIDE.md](./docs/PROJECT_MANAGEMENT_GUIDE.md)** - Documentation standards
- **[docs/designs/](./docs/designs/)** - Design documents
- **[docs/adr/](./docs/adr/)** - Architecture decision records

## Response Language

Respond in the same language as the user's message (Chinese or English).
