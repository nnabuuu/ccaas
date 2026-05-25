# Architecture — agentfs virtual-FS layer for ccaas

> Last updated: 2026-05-25 (post v4 Linux Docker validation)

## 30-second pitch

ccaas needs to give every Agent session an **isolated workspace** that
looks like a normal Unix directory to `claude` (the spawned CLI subprocess)
but is actually a virtual, SQLite-backed filesystem we can snapshot,
audit, and tear down per session.

[agentfs](https://github.com/tursodatabase/agentfs) (by Turso) provides
exactly this — a libsql/SQLite-backed FS that exposes via FUSE (Linux)
or NFS (macOS). It supports overlay semantics, so we materialize a
shared "base" of skills / tenant data once and let each session ride
on top with its own private delta.

The validation POC (in `packages/vfs-poc/`) proves end-to-end this works
on both platforms, with `git` operations (including `worktree add/commit/
merge`) running cleanly inside the mount.

## Layered model

```
┌─────────────────────────────────────────────────────────────────┐
│ ccaas POC                                                       │
│   packages/vfs-poc/{src, validation, scripts, docker}           │
│   — BaseMaterializer, SessionFsManager, just-bash MCP, V1 suite │
└───────────────────────────┬─────────────────────────────────────┘
                            │ depends on
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ agentfs binary                                                  │
│                                                                 │
│  macOS dev:                       Linux production:             │
│  ┌──────────────────────────┐    ┌──────────────────────────┐  │
│  │ nnabuuu/agentfs          │    │ tursodatabase/agentfs    │  │
│  │ feat/nfs-drop-appledouble│    │ v0.6.4 upstream release  │  │
│  │ ↑ adds AppleDouble drop  │    │ — no patches needed —    │  │
│  │ fix/nfs-write-owner-...  │    │                          │  │
│  │ ↑ adds rail44 NFS fix    │    │                          │  │
│  │ main (= upstream)        │    │                          │  │
│  └──────────────────────────┘    └──────────────────────────┘  │
│      NFS server path                  FUSE server path           │
│      (only path our patches touch)    (untouched, works as-is)   │
└─────────────────────────────────────────────────────────────────┘
```

## Why two builds (fork vs upstream)

agentfs has **two completely separate code paths**:

- `cli/src/nfsserve/` — NFSv3 server, used on macOS (Linux NFS clients also work but in practice macOS is the user)
- `cli/src/fuser/` — FUSE server, used on Linux

Both of our patches are in `nfsserve/`. They have **zero effect** on the
FUSE path. The Linux Docker V1 validation (round v4) ran three configs
including raw upstream — all pass identically.

**Implication for production**: deploy the upstream agentfs binary
straight from `curl ... agentfs-installer.sh | sh`. No build dependency
on our fork. Fork is purely a dev-environment aid for macOS contributors.

## Patches we carry (NFS-only, macOS-only)

### 1. rail44 NFS owner-bypass-mode-check (`fix/nfs-write-owner-bypass-mode-check`)

git writes loose objects via `open(O_RDWR|O_CREAT|O_EXCL, 0444) → write → close`.
NFSv3 is stateless: server rechecks mode bits on every `WRITE` RPC, sees 0444,
rejects with `NFS3ERR_ACCES`. close() flushes deferred writes → reports
EACCES upstream.

Fix: `nfsproc3_write` lets file owner + root bypass the mode-bit check.
Owner can chmod anyway so the restriction is unenforceable against them.
Same fix shape as nfs-ganesha, mergerfs, Red Hat patched theirs.

Origin: contributor [`@rail44`](https://github.com/rail44) on
[tursodatabase/agentfs#333](https://github.com/tursodatabase/agentfs/issues/333).
Still open upstream as of writing; we carry it on our fork.

### 2. nfs-drop-appledouble (`feat/nfs-drop-appledouble`)

macOS NFS clients fall back to writing `._foo` AppleDouble sidecar files
to persist extended attributes (because NFSv3 has no xattr ops). Since
macOS 13 the kernel auto-tags every new file with `com.apple.provenance`,
so sidecars appear for ALL files. Sidecars then break:
- `git fsck` walks `.git/objects/` and tries to parse `._tmp_obj_*` as sha1
- `git merge` tries to materialize `._foo` from commit trees
- general directory pollution

Fix: server-side "silent drop" — LOOKUP returns NOENT, CREATE returns
a synthetic 16-byte fh (fileid=u64::MAX), GETATTR/READ on synthetic fh
returns empty 0-byte file, WRITE silently discards, REMOVE no-op,
RENAME guards against data destroy, READDIR/READDIRPLUS filter
`._*` and `.DS_Store`. ~250 LOC + 6 unit tests + extensive docs.

Gated by `AGENTFS_DROP_APPLEDOUBLE` env var, default on.

## Workspace layout per session (target — see WORKSPACE_PROVIDER.md)

```
${WORKSPACE_DIR}/                       # configurable (default .agent-workspace)
├── sessions/{sessionId}/               # the mount point claude sees as cwd
│   ├── .claude/
│   │   ├── settings.local.json         # pre-approved Bash/Read/Write
│   │   └── mcp-servers/{server}/       # symlinks → host fs tenant MCP
│   ├── .git/                           # if using git worktree (spec D2)
│   └── <agent-managed content>
├── _agentfs_deltas/{sessionId}.db      # per-session SQLite delta (agentfs)
├── _agentfs_base/                      # shared materialized base (overlay lower)
│   └── tenants/{tenantId}/skills/...   # global, immutable
├── scheduled/{taskId}/                 # HeadlessExecutionService (unchanged)
└── data.db                             # ccaas main db (unchanged)
```

For `WORKSPACE_PROVIDER=local` (default): `sessions/{id}/` is a plain dir,
nothing else exists. For `WORKSPACE_PROVIDER=agentfs`: `sessions/{id}/`
is the mount point; `_agentfs_deltas/` and `_agentfs_base/` exist.

The path layout is **deliberately identical** between providers — DB
column `Session.workspaceDir`, fallback paths in `workspace.service`,
and `files.controller` all continue to work unchanged. Only the
"what's behind the mount point" differs.

## What's outside this stack

- **just-bash** lives in the POC (`src/just-bash-mcp/server.ts`) and is
  exposed to claude as an MCP-backed Bash tool. Validated to weak-replace
  the built-in Bash. Strong replacement (also covering Read/Write/Edit/
  Grep/Glob) is achievable but requires 1:1 mirroring native tool
  schemas — see V2 in the validation report.
- **Claude Agent SDK / claude CLI** itself is unchanged. We only configure
  it via `--disallowed-tools` + `--mcp-config` + `--append-system-prompt`.
- **The ccaas `WorkspaceProvider` integration** is the next milestone —
  swaps `SessionService`'s direct mkdir for a provider interface, with
  Local + Agentfs implementations behind a feature flag. See
  WORKSPACE_PROVIDER.md.

## Cross-platform verdict (V1 matrix)

| Platform | agentfs | bare? | Result | Source |
|---|---|---|---|---|
| macOS NFS | upstream v0.6.4 | yes | ❌ 0/10 | VALIDATION_REPORT v1 |
| macOS NFS | fork 9180ed4 | no (workaround) | ✅ 10/10 | v2 |
| **macOS NFS** | **fork 9180ed4** | **yes** | ✅ **10/10** | **v3 canonical** |
| Linux FUSE | fork 9180ed4 | yes | ✅ 9/10 + 1 skip | v4 |
| **Linux FUSE** | **upstream v0.6.4** | **yes** | ✅ **9/10 + 1 skip** | **v4 production candidate** |
| Linux FUSE | upstream v0.6.4 | no | ✅ 9/10 + 1 skip | v4 |

(+1 skip = T1.7 macOS-only case-collision test, intentionally not run on Linux.)
