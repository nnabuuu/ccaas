# vfs-poc docs

Documentation index for the agentfs virtual-FS POC + everything we've
validated about it. The POC itself lives in `packages/vfs-poc/src/`,
`validation/`, `scripts/`, `docker/`. **This `docs/` folder is the
authoritative narrative**; in-tree comments cover only line-level intent.

## Documents

| Doc | What it is |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | The layered model: upstream agentfs → rail44 NFS fix → `feat/nfs-drop-appledouble` → ccaas POC. Why each layer exists, what runs where (macOS dev / Linux production), the fork-vs-upstream decision |
| [VALIDATION_REPORT.md](./VALIDATION_REPORT.md) | The four validation rounds (v1–v4): macOS NFS bring-up, rail44 fix verification, server-side AppleDouble drop, Linux Docker production form. Per-test data, performance comparisons, spec impact |
| [WORKSPACE_PROVIDER.md](./WORKSPACE_PROVIDER.md) | (in progress) Design for the backend `WorkspaceProvider` abstraction that integrates agentfs into ccaas. Captures sanity-check findings, risk register, scope decisions before code |

## External references

- spec being validated: [`docs/agent-session-runtime-spec.md`](../../../docs/agent-session-runtime-spec.md) (repo root)
- agentfs fork: [`nnabuuu/agentfs`](https://github.com/nnabuuu/agentfs) — branches `fix/nfs-write-owner-bypass-mode-check` (rail44 base) and `feat/nfs-drop-appledouble` (active)
- agentfs upstream: [`tursodatabase/agentfs`](https://github.com/tursodatabase/agentfs)
- upstream issue that drove the rail44 fix: [#333](https://github.com/tursodatabase/agentfs/issues/333)

## How to read this folder

- First-time: `ARCHITECTURE.md` (~10 min) — get the mental model
- Picking up implementation: `WORKSPACE_PROVIDER.md` — the live design doc
- Debugging a regression: `VALIDATION_REPORT.md` — every verdict has reproducer commands + raw logs in `../validation/logs/`
