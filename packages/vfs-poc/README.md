# @kedge-agentic/vfs-poc — design + validation archive

> **Status: archive.** All POC source has been ported into the
> production ccaas backend (`packages/backend/src/sessions/`) and the
> `@kedge-agentic/agentfs-runtime` package. This directory preserves
> the design documents and validation results that backed those
> decisions, plus the build-agentfs-fix script still needed for
> first-time setup.
>
> **Looking for current runtime architecture?** Read the gitbook page
> **[平台介绍 → Runtime 架构](../../docs/gitbook/zh/platform/runtime-architecture.md)**
> first — that's the canonical engineer-facing narrative. The deep-dive
> `docs/WORKSPACE_PROVIDER.md` here is the *design rationale* behind
> what's in that gitbook page; useful when you need to know *why* a
> decision was made (risk register, sanity checks, alternatives
> considered), not what the code currently does.

## What's here

```
packages/vfs-poc/
├── docs/                  # ← authoritative design narrative; KEEP using this
│   ├── ARCHITECTURE.md            — overall agentfs + just-bash layer model
│   ├── WORKSPACE_PROVIDER.md      — runtime FS/meta API design + risk register
│   ├── VALIDATION_REPORT.md       — v1–v4 validation rounds with raw results
│   └── STAGE1_LOCAL_SELFHOST.md   — operator quickstart
├── validation/results/    # ← v1/v2 validation outputs (immutable history)
└── scripts/
    └── build-agentfs-fix.sh       — builds our fork (rail44 NFS fix + AppleDouble drop)
                                    — referenced by STAGE1 quickstart
```

## Where the code went

| POC file (removed) | Production location |
|---|---|
| `src/just-bash-mcp/server.ts` | `packages/backend/src/sessions/sandbox/just-bash-mcp/server.mjs` |
| `src/base-materializer.ts` | `packages/backend/src/sessions/workspace/base-materializer.ts` (TypeORM-backed) |
| `src/session-fs-manager.ts` + `src/platform/mount.ts` | `packages/backend/src/sessions/workspace/agentfs-provider.ts` |
| `src/claude-runner.ts` | `packages/backend/src/sessions/services/cli-process.service.ts` |
| `src/files-mcp/server.ts` | (not productionized — was a parallel POC; superseded by the just-bash route) |
| validation runners (git/sandbox/) | removed; results in `validation/results/` are the historical record |
| `scripts/run-*.ts` + `run-linux-v1.sh` | removed; ran against the POC src/ which is gone |

For the design rationale of *why* each component looks like it does in
production, read `docs/ARCHITECTURE.md` (the layered model) and
`docs/WORKSPACE_PROVIDER.md` (the abstraction + risk register).

## Why we kept the archive

- **`docs/` is still the authoritative narrative** — backend code
  comments still link back to specific sections (e.g. AgentfsProvider
  cites WORKSPACE_PROVIDER.md sanity check B).
- **`validation/results/*.json`** are immutable evidence of v1/v2
  validation passes; useful when someone asks "did you verify FUSE on
  Linux?"
- **`scripts/build-agentfs-fix.sh`** still needed for first-time
  setup of the rail44-fix fork; referenced from
  `docs/STAGE1_LOCAL_SELFHOST.md`.

## If you're looking for…

- **Hands-on demo**: `solutions/business/demo-sandbox/` ships a working
  B2B SaaS demo on top of all this. `npm run dev` in there + visit
  `http://localhost:3010/`.
- **REST API surface** for the runtime: see
  `docs/STAGE1_LOCAL_SELFHOST.md` "Inspect what the agent did" section
  for curl examples.
- **Stage-2 plans** (per-tenant isolation, encryption, etc.): see the
  "Out of scope" sections in `docs/WORKSPACE_PROVIDER.md`.
