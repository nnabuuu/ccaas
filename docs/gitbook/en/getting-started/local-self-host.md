# Local Self-Host (stage-1 sandbox)

> You want to run ccaas on your own mac/linux, let claude use your local OAuth, but **don't** want claude to touch your host fs or bash. This page covers prereqs → one-line startup → how to verify the sandbox is actually active.

## What you end up with

| Layer | Status | Configuration |
|---|---|---|
| Filesystem isolation | ✅ agentfs FUSE (Linux) / NFS (macOS) | `WORKSPACE_PROVIDER=agentfs` |
| Bash isolation | ✅ just-bash in-process interpreter (via MCP) | `WORKSPACE_BASH_SANDBOX=just-bash` (auto-on under agentfs) |
| Native Read/Write/Edit/Grep/Glob | ✅ land in the agentfs mount = sandboxed | no extra config |
| Network | ❌ claude itself can still hit any URL | out of stage-1 scope |

## Prerequisites

| Item | How |
|---|---|
| Node 20+ | `nvm install 20` |
| `claude` CLI (OAuth'd) | [install](https://docs.anthropic.com/claude/docs/install) + `claude login` |
| `agentfs` binary | macOS — our fork (rail44 NFS fix + AppleDouble drop): `bash packages/vfs-poc/scripts/build-agentfs-fix.sh`. Linux — upstream: `curl -fsSL https://github.com/tursodatabase/agentfs/releases/latest/download/agentfs-installer.sh \| sh` |
| **macOS** | system NFS is built in, no extra setup |
| **Linux** | `apt install fuse3`; run backend as root OR add yourself to the `fuse` group AND uncomment `user_allow_other` in `/etc/fuse.conf` |

## Start

```bash
WORKSPACE_PROVIDER=agentfs \
  WORKSPACE_AGENTFS_BIN=$HOME/.cargo/bin/agentfs \
  npm run start:prod -w @kedge-agentic/backend
```

`WORKSPACE_PROVIDER=agentfs` is enough; `WORKSPACE_BASH_SANDBOX` auto-defaults to `'just-bash'` when not set explicitly under agentfs.

If you want a solution's data seeded into each session's workspace:

```bash
SOLUTION_DIRS=demo-sandbox:$PWD/solutions/business/demo-sandbox \
  WORKSPACE_PROVIDER=agentfs \
  ...other env... \
  npm run start:prod -w @kedge-agentic/backend
```

(This lets `SessionAssetMaterializer` copy `entities/` + `resources/` into the workspace whenever a demo-sandbox-tenant session is created. See `platform/runtime-architecture.md` § 4.2.)

## How to verify the sandbox is really active

Startup logs should include:

```
[BaseMaterializer]        materialized N skills (X files) + Y mcp servers → ...
[SandboxService]          Bash sandbox mode: just-bash (server: .../just-bash-mcp/server.mjs)
[AgentfsWorkspaceProvider] agentfs binary OK: agentfs <sha>
```

Once a session is created, the CliProcessService spawn-command log should contain:

```
--mcp-config {"mcpServers":{"__ccaas_bash":{...}}}
--disallowed-tools Bash
--append-system-prompt For ANY shell command in this session, you MUST call the MCP tool ...
```

When the agent runs its first shell command, the sandbox log starts showing entries:

```
$ tail $WORKSPACE_DIR/_sandbox_logs/bash-mcp.log
2026-XX-XX [<sessionId>] server connected
2026-XX-XX [<sessionId>] exec cwd=/ cmd=ls entities/customers/
2026-XX-XX [<sessionId>] exec done exit=0
```

## Key environment variables

| Variable | Default | Effect |
|---|---|---|
| `WORKSPACE_PROVIDER=local` | default | old mkdir + symlink path; sandbox automatically off |
| `WORKSPACE_PROVIDER=agentfs` | — | enables agentfs virtual FS + auto-enables just-bash sandbox |
| `WORKSPACE_BASH_SANDBOX=none` | auto `just-bash` under agentfs | debug escape hatch: keep agentfs FS sandbox, allow native Bash |
| `WORKSPACE_AGENTFS_BIN=/abs/path` | `agentfs` (on PATH) | path to the agentfs binary |
| `WORKSPACE_AGENTFS_BASE_DIR=/var/...` | `${WORKSPACE_DIR}/_agentfs_base` | where the materialized base overlay lives |
| `WORKSPACE_AGENTFS_DELTA_STORE=/var/...` | `${WORKSPACE_DIR}/_agentfs_deltas` | where per-session delta DBs live |
| `SOLUTION_DIRS=slug:abspath,slug2:abspath2` | empty | tells SessionAssetMaterializer which solutions' entities+resources to seed per session |

## Reserved naming conventions

`__ccaas_*` is the reserved prefix for ccaas-internal MCP servers (currently only `__ccaas_bash`). Don't use this prefix for your own MCP server names — collisions log a warning and the ccaas-internal one wins.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `WORKSPACE_PROVIDER=agentfs but binary 'agentfs' is not invokable` | binary not on PATH | set absolute path via `WORKSPACE_AGENTFS_BIN` |
| `mount` shows nothing after session create | FUSE/NFS not mounted | Linux: `modprobe fuse`, check `/dev/fuse` perms; macOS: usually nothing to fix |
| Sandbox active but claude still uses native Bash | claude CLI too old | upgrade to ≥ 2.1.x |
| `SandboxService cannot find just-bash MCP server at .../server.mjs` | nest-cli `assets` config missing | confirm `packages/backend/nest-cli.json` has the `assets` block; rebuild |
| MCP server spawned but every command returns `exit=2` | claude sent an absolute host path (`/etc/...`), which doesn't exist inside the sandbox | **correct sandbox behavior** — claude should learn to use relative paths (system prompt steers this) |
| Linux: `fuse: device not found` | kernel module not loaded | `sudo modprobe fuse` |
| Linux: non-root access to mount → permission denied | `/etc/fuse.conf` missing `user_allow_other` | uncomment that line + restart backend |

## Runtime REST API available immediately

Once the backend is up, these are usable while an agent session is in memory:

```bash
KEY=sk-your-admin-key
TENANT=demo-sandbox
SID=demo-xxxxxxxx

# What did the agent change in the sandbox?
curl -s "http://localhost:3001/api/v1/sessions/$SID/fs/diff" \
  -H "x-api-key: $KEY" -H "x-tenant-id: $TENANT" | python3 -m json.tool

# Checkpoint + rollback
curl -X POST "http://localhost:3001/api/v1/sessions/$SID/fs/snapshot" \
  -H "x-api-key: $KEY" -H "x-tenant-id: $TENANT" \
  -H 'Content-Type: application/json' -d '{"label":"before-risky"}'
```

Full spec: `reference/runtime-api.md`.

## What stage-1 does NOT give you

These are **not** in scope for this iteration; they're tracked in backlog:

- Scheduled tasks (HeadlessExecutionService) still use local fs, not WorkspaceProvider
- Network isolation for claude itself
- Multi-tenant agentfs encryption (`--key/--cipher`)
- Forensic file browsing UI for closed sessions
- Containerized deploy (stage-1 is bare-metal Node)

## See also

- `platform/runtime-architecture.md` — how all layers fit together
- `reference/runtime-api.md` — 8 runtime endpoints' detailed spec
- `examples/demo-sandbox.md` — a complete copy-pasteable demo
- For deep design rationale: `packages/vfs-poc/docs/WORKSPACE_PROVIDER.md`
