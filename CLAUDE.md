# CLAUDE.md - KedgeAgentic (即见Agentic) Monorepo

An Agentic services platform where developers describe business logic in **Skills** and connect tools via **MCP** — the platform manages Agent Engine lifecycle, session persistence, and tool orchestration.

## Directory Structure

```
ccaas/
├── packages/
│   ├── backend/          # @kedge-agentic/backend - NestJS server
│   ├── admin-next/       # @kedge-agentic/admin-next - React admin (Refine + shadcn/ui)
│   ├── vue-sdk/          # @kedge-agentic/vue-sdk - Vue composables
│   ├── react-sdk/        # @kedge-agentic/react-sdk - React hooks
│   ├── chat-interface/   # @kedge-agentic/chat-interface - Extensible chat UI (lib + app)
│   └── shared/           # @kedge-agentic/common - Shared types & protocols
├── solutions/            # Domain-specific solutions (separate backends)
└── docs/                 # Consolidated documentation
```

## Package Overview

| Package | Tech Stack | Purpose |
|---------|------------|---------|
| `@kedge-agentic/backend` | NestJS, TypeORM, SSE | API server, Agent Engine lifecycle, sessions, scheduled tasks |
| `@kedge-agentic/admin-next` | React, Refine, shadcn/ui, Tailwind | Admin dashboard |
| `@kedge-agentic/vue-sdk` | Vue 3 Composition API | Vue client integration |
| `@kedge-agentic/react-sdk` | React hooks, SSE | React client integration |
| `@kedge-agentic/chat-interface` | React, Tailwind, Vite | Extensible chat UI component library |
| `@kedge-agentic/common` | TypeScript, Zod | Shared types and protocols |

## Build

```bash
npm install              # Install all dependencies
npm run build            # Build all packages
npm run dev:backend      # Start backend on :3001
npm run dev:admin        # Start admin on :5175
```

**Build order:** common → vue-sdk/react-sdk → admin-next/backend

## Package-Specific Guides

- **@kedge-agentic/backend**: See [`packages/backend/CLAUDE.md`](./packages/backend/CLAUDE.md)
- **@kedge-agentic/admin-next**: See [`packages/admin-next/CLAUDE.md`](./packages/admin-next/CLAUDE.md)
- **@kedge-agentic/vue-sdk**: See [`packages/vue-sdk/docs/ARCHITECTURE.md`](./packages/vue-sdk/docs/ARCHITECTURE.md)
- **@kedge-agentic/react-sdk**: See [`packages/react-sdk/README.md`](./packages/react-sdk/README.md)
- **@kedge-agentic/chat-interface**: See [`packages/chat-interface/ARCHITECTURE.md`](./packages/chat-interface/ARCHITECTURE.md)
- **@kedge-agentic/common**: See [`packages/common/README.md`](./packages/common/README.md)

## Conventions → See [docs/CONVENTIONS.md](./docs/CONVENTIONS.md)

## Workflow → See [docs/WORKFLOW.md](./docs/WORKFLOW.md)

## Principles → See [docs/DEVELOPMENT_PRINCIPLES.md](./docs/DEVELOPMENT_PRINCIPLES.md)

## Documentation Standards → See [docs/PROJECT_MANAGEMENT_GUIDE.md](./docs/PROJECT_MANAGEMENT_GUIDE.md)

## Quality Scores → See [docs/QUALITY_SCORE.md](./docs/QUALITY_SCORE.md)

## Key Documentation

- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guidelines
- [docs/designs/](./docs/designs/) - Design documents
- [docs/adr/](./docs/adr/) - Architecture decision records

## Quick Reference

- Build order: common → SDKs → admin/backend
- Commit: `<type>(<scope>): <lowercase subject>`
- Tests: Run before AND after code changes (`npm test`)
- Architecture: Core = infrastructure only, domain entities → solution backend
- Push: `git status` to verify all related files are staged
- New controllers: MUST have `@ApiTags` decorator
- API changes: update gitbook docs in sync

## Post-Implementation Checklist (MANDATORY)

After ANY code changes, you MUST run these steps IN ORDER before considering the task done:

1. **Tests**: `cd packages/backend && npx jest --no-coverage` (or relevant package)
2. **Code Review**: Run `code-reviewer` agent on all changed files
3. **Harness**: `bash scripts/harness-checks.sh`

Skipping any step is a workflow violation. If review finds issues, fix them before proceeding.

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/review`, `/ship`, `/browse`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`

## Response Language

Respond in the same language as the user's message (Chinese or English).
