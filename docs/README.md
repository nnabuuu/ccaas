# KedgeAgentic Documentation

Welcome to the KedgeAgentic (即见Agentic) docs. This README lists every file and directory that actually exists; the GitBook under [`gitbook/`](gitbook/) is the canonical end-user surface.

> **Catching up after a break?** Read [`CHANGES_2026-05.md`](./CHANGES_2026-05.md) — it covers the runtime + sandbox + agent-runtime sprint chronologically with commit refs.

## 📚 Layout

```
docs/
├── README.md                        # this file
│
├── adr/                             # architecture decision records (numbered, immutable)
├── articles/                        # long-form essays + reusable prose
├── design/                          # design specs (API design, JTBD analysis, picker patterns)
├── examples/                        # small reference snippets (e.g. SKILL.md with frontmatter)
├── gitbook/                         # canonical platform docs (en + zh)
├── guides/                          # focused tutorial-style docs
├── harness-audit/                   # harness reviewer skill + audit history
├── media/                           # binary assets (images, slides)
├── reference/                       # external references + UI mockups (html)
│
├── AGENT_RUNTIME_DESIGN.md          # the agent-runtime package roadmap (Phase A/0/1/1.6/2b shipped)
├── BUILDER_TUTORIAL.md              # builder flow tutorial
├── CHANGES_2026-05.md               # chronological changelog for the runtime+sandbox+2b sprint
├── CONVENTIONS.md                   # project conventions (naming, commits, scopes)
├── DEPLOYMENT.md                    # deployment notes
├── DEVELOPMENT_PRINCIPLES.md        # core engineering principles
├── PROJECT_MANAGEMENT_GUIDE.md      # when & how to create docs / use Linear
├── PROJECT_PATTERN_CATALOG.md       # patterns observed in live-lesson (drives agent-runtime design)
├── QUALITY_SCORE.md                 # quality-score rubric for solutions
├── SOLUTION_BEST_PRACTICES.md       # solution-level best practices
├── SOLUTION_TEMPLATE.md             # solution scaffolding template
├── WORKFLOW.md                      # day-to-day development workflow
├── agent-session-runtime-spec.md    # agent session runtime spec
└── resume-technical-narrative.md    # technical narrative for resumes (Kedge team)
```

## 🚀 Starting points by role

### New to the project

1. Read [`gitbook/zh/README.md`](gitbook/zh/README.md) or [`gitbook/en/README.md`](gitbook/en/README.md) for the platform intro.
2. Skim [`gitbook/zh/platform/runtime-architecture.md`](gitbook/zh/platform/runtime-architecture.md) for the sandbox + workspace + agent-runtime mental model.
3. Boot locally via [`gitbook/zh/getting-started/local-self-host.md`](gitbook/zh/getting-started/local-self-host.md).

### Solution developer

1. [`gitbook/zh/tutorial/01-architecture.md`](gitbook/zh/tutorial/01-architecture.md) → 02 → ... — full tutorial
2. [`SOLUTION_BEST_PRACTICES.md`](./SOLUTION_BEST_PRACTICES.md)
3. [`SOLUTION_TEMPLATE.md`](./SOLUTION_TEMPLATE.md)
4. [`guides/solution-troubleshooting.md`](guides/solution-troubleshooting.md)
5. [`gitbook/zh/reference/solution-json.md`](gitbook/zh/reference/solution-json.md) — `solution.json` v3 schema

### Frontend / SDK integrator

1. [`gitbook/zh/guide/frontend.md`](gitbook/zh/guide/frontend.md) — integration overview
2. [`gitbook/zh/guide/chat-integration.md`](gitbook/zh/guide/chat-integration.md) — React SDK chat
3. [`../packages/react-sdk/README.md`](../packages/react-sdk/README.md) and [`../packages/vue-sdk/docs/`](../packages/vue-sdk/docs/) — package-local SDK docs (bilingual for Vue)

### Backend engineer

1. [`AGENT_RUNTIME_DESIGN.md`](./AGENT_RUNTIME_DESIGN.md) — the agent-runtime package roadmap and rationale
2. [`gitbook/zh/reference/runtime-api.md`](gitbook/zh/reference/runtime-api.md) — runtime REST API (fs + metadata endpoints)
3. [`gitbook/zh/reference/agent-runtime.md`](gitbook/zh/reference/agent-runtime.md) — agent-runtime package reference (Phase 2b-2 auth + 2b-4 binary artifacts shipped)
4. [`adr/`](adr/) — architectural decisions
5. [`design/session-workspace-file-api.md`](design/session-workspace-file-api.md) — session workspace FS spec

### Skill writer

1. [`gitbook/zh/guide/skill-writing.md`](gitbook/zh/guide/skill-writing.md)
2. [`examples/SKILL-with-frontmatter.md`](examples/SKILL-with-frontmatter.md) — frontmatter example
3. [`gitbook/zh/guide/write-output.md`](gitbook/zh/guide/write-output.md) — `write_output` best practices

## 🗂 What lives where

| Topic | Where |
|---|---|
| Architecture decisions (immutable) | [`adr/`](adr/) (numbered, see [`adr/README.md`](adr/README.md)) |
| Cross-cutting design specs | [`design/`](design/) (3 specs: session-workspace-file-api, AtPicker, JTBD analysis) |
| Phase roadmap for `@kedge-agentic/agent-runtime` | [`AGENT_RUNTIME_DESIGN.md`](./AGENT_RUNTIME_DESIGN.md) |
| Recent changes (2026-05 sprint catch-up) | [`CHANGES_2026-05.md`](./CHANGES_2026-05.md) |
| Long-form prose / articles | [`articles/`](articles/) |
| Process — commits, conventions, workflow | [`CONVENTIONS.md`](./CONVENTIONS.md), [`WORKFLOW.md`](./WORKFLOW.md), [`DEVELOPMENT_PRINCIPLES.md`](./DEVELOPMENT_PRINCIPLES.md) |
| Process — docs hygiene | [`PROJECT_MANAGEMENT_GUIDE.md`](./PROJECT_MANAGEMENT_GUIDE.md) |
| UI mockups | [`reference/*.html`](reference/) |
| Deployment notes | [`DEPLOYMENT.md`](./DEPLOYMENT.md) |
| Harness reviewer skill + history | [`harness-audit/`](harness-audit/) |

## 🌐 Language

- **中文** (canonical): [`gitbook/zh/`](gitbook/zh/) — the team writes here first
- **English**: [`gitbook/en/`](gitbook/en/) — mirror of zh; some pages may lag (notably the reference subdirectory; see `CHANGES_2026-05.md` for known drift)

## 🔗 External

- Claude API — [docs.anthropic.com](https://docs.anthropic.com)
- MCP Protocol — [modelcontextprotocol.io](https://modelcontextprotocol.io)
