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
│   ├── entity-document/  # @kedge-agentic/entity-document - Block ↔ Markdown transforms
│   ├── context-layer/    # @kedge-agentic/context-layer - Entity context & editing
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
| `@kedge-agentic/entity-document` | TypeScript, Vitest | Block ↔ Markdown bidirectional transform, pluggable TransformRegistry |
| `@kedge-agentic/context-layer` | TypeScript, NestJS (optional) | Entity context routing, DocumentEditProvider base class |
| `@kedge-agentic/agent-runtime` | TypeScript (framework-free) | Phase 1.6: workspace (`BaseMaterializer`) + artifact (`JsonEditProvider` + `ProjectArtifactSource`) + sync (`SyncEngine` + `InMemoryChangeStream` + `SnapshotStore`). Bidirectional agent ↔ solution-DB sync via `solution.config.artifactUrl` (ccaas-core's Solution entity was formerly `Tenant`; agent-runtime npm port still uses legacy `tenantId` field name). Renamed from `agentfs-runtime` in May 2026. |
| `@kedge-agentic/common` | TypeScript, Zod | Shared types and protocols |

## Build

```bash
npm install              # Install all dependencies
npm run build            # Build all packages
npm run dev:backend      # Start backend on :3001
npm run dev:admin        # Start admin on :5175
```

**Build order:** common + agent-runtime → vue-sdk/react-sdk → admin-next/backend
(orchestrated by root `build:libs` → `build`)

## Package-Specific Guides

- **@kedge-agentic/backend**: See [`packages/backend/CLAUDE.md`](./packages/backend/CLAUDE.md)
- **@kedge-agentic/admin-next**: See [`packages/admin-next/CLAUDE.md`](./packages/admin-next/CLAUDE.md)
- **@kedge-agentic/vue-sdk**: See [`packages/vue-sdk/docs/ARCHITECTURE.md`](./packages/vue-sdk/docs/ARCHITECTURE.md)
- **@kedge-agentic/react-sdk**: See [`packages/react-sdk/README.md`](./packages/react-sdk/README.md)
- **@kedge-agentic/chat-interface**: See [`packages/chat-interface/ARCHITECTURE.md`](./packages/chat-interface/ARCHITECTURE.md)
- **@kedge-agentic/entity-document**: See [`packages/entity-document/README.md`](./packages/entity-document/README.md)
- **@kedge-agentic/context-layer**: See [`packages/context-layer/src/core/document-edit-provider.ts`](./packages/context-layer/src/core/document-edit-provider.ts)
- **@kedge-agentic/agent-runtime**: See [`packages/agent-runtime/README.md`](./packages/agent-runtime/README.md) + [`docs/AGENT_RUNTIME_DESIGN.md`](./docs/AGENT_RUNTIME_DESIGN.md) (full vision) + gitbook reference page
- **@kedge-agentic/common**: See [`packages/common/README.md`](./packages/common/README.md)

## Runtime layer (post-stage-1 sandbox)

ccaas backend gained a sandboxed-FS + sandboxed-bash runtime layer in
May 2026. **If you're a new engineer landing here, read this first** so
log lines and code paths make sense:

- 📘 **[gitbook → 平台介绍 → Runtime 架构](./docs/gitbook/zh/platform/runtime-architecture.md)** — single canonical 10-min walkthrough of WorkspaceProvider, BaseMaterializer, SessionAssetMaterializer, SandboxService, just-bash MCP. Start here.
- 🚀 **[gitbook → 快速开始 → 本地自托管](./docs/gitbook/zh/getting-started/local-self-host.md)** — boot ccaas with `WORKSPACE_PROVIDER=agentfs` + `WORKSPACE_BASH_SANDBOX=just-bash`
- 📡 **[gitbook → 参考 → Runtime REST API](./docs/gitbook/zh/reference/runtime-api.md)** — 8 new endpoints under `/api/v1/sessions/:id/` (fs/diff, fs/timeline, snapshot, rollback, meta KV)
- 🛠️ **[gitbook → 开发指南 → Solution 扩展点](./docs/gitbook/zh/guide/extending-runtime.md)** — for solution authors using the new runtime
- 🎯 **[gitbook → 案例 → demo-sandbox](./docs/gitbook/zh/examples/demo-sandbox.md)** — complete e2e demo (B2B SaaS theme), source at [`solutions/business/demo-sandbox/`](./solutions/business/demo-sandbox/)

Catching up on the last few weeks of churn? See [`docs/CHANGES_2026-05.md`](./docs/CHANGES_2026-05.md).

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
