# Stage-1 Local Self-Host — quickstart

> Audience: you want to run ccaas on your own laptop / VM, spawn the
> local `claude` CLI, but keep claude **completely sandboxed** —
> neither host filesystem nor host bash is reachable.

> 🚀 **Want a hands-on demo?** Jump to
> [`solutions/business/demo-sandbox/README.md`](../../../solutions/business/demo-sandbox/README.md)
> — a B2B SaaS dataset (customers / revenue / plans) + progressive-disclosure
> skill + DocumentEditProvider, all wired to showcase the sandbox.

## What this setup gives you

| Layer | Sandbox | How |
|---|---|---|
| Filesystem | ✅ agentfs FUSE (Linux) / NFS (macOS) overlay per session | `WORKSPACE_PROVIDER=agentfs` |
| Bash | ✅ just-bash in-process interpreter via MCP | `WORKSPACE_BASH_SANDBOX=just-bash` (default-on when provider=agentfs) |
| Read/Write/Edit/Grep/Glob | ✅ native tools land in the agentfs mount = sandboxed | (no extra config) |
| Network | ❌ claude itself can still hit any URL | (out of stage-1 scope) |

## Prerequisites

- **Node 20+** on PATH
- **`claude` CLI** on PATH and OAuth'd (anthropic login)
- **`agentfs` binary** — build our fork or install upstream:
  ```bash
  # fork (recommended on macOS — has rail44 NFS fix + AppleDouble drop)
  bash packages/vfs-poc/scripts/build-agentfs-fix.sh
  # or upstream (good enough on Linux FUSE)
  curl -fsSL https://github.com/tursodatabase/agentfs/releases/latest/download/agentfs-installer.sh | sh
  ```
- **macOS**: native NFS — nothing extra
- **Linux**:
  - `apt install fuse3` (or distro equivalent)
  - either run backend as root, OR add yourself to the `fuse` group AND uncomment `user_allow_other` in `/etc/fuse.conf`

## Start

```bash
WORKSPACE_PROVIDER=agentfs \
  WORKSPACE_AGENTFS_BIN=$HOME/.cargo/bin/agentfs \
  npm run start:prod -w @kedge-agentic/backend
```

That's the whole knob. `WORKSPACE_BASH_SANDBOX` is not set explicitly —
it defaults to `'just-bash'` automatically when `WORKSPACE_PROVIDER=agentfs`.
The frontend connects to `http://localhost:3001` as usual.

## Verify sandbox is active

Look for these lines in backend startup logs:

```
[SandboxService] Bash sandbox mode: just-bash (server: .../just-bash-mcp/server.mjs)
[AgentfsWorkspaceProvider] agentfs binary OK: agentfs <commit-sha>
```

After creating a session, the spawn command log should include:

```
--mcp-config {"mcpServers":{"__ccaas_bash":{...}}}
--disallowed-tools Bash
--append-system-prompt For ANY shell command in this session, you MUST call the MCP tool ...
```

When claude runs its first shell command, the sandbox log appears:

```
$ tail $WORKSPACE_DIR/_sandbox_logs/bash-mcp.log
2026-XX-XX [<sessionId>] server connected
2026-XX-XX [<sessionId>] exec cwd=/ cmd=ls
2026-XX-XX [<sessionId>] exec done exit=0
```

## Override knobs

| Env var | Default | Effect |
|---|---|---|
| `WORKSPACE_PROVIDER=local` | (default if unset) | Old-style local fs sessions; sandbox auto-disables |
| `WORKSPACE_BASH_SANDBOX=none` | (auto on iff provider=agentfs) | Keep agentfs FS sandbox but allow native Bash (debug escape hatch) |
| `WORKSPACE_AGENTFS_BIN=/custom/path` | `agentfs` | Use a specific agentfs binary |
| `WORKSPACE_AGENTFS_BASE_DIR=/var/...` | `${WORKSPACE_DIR}/_agentfs_base` | Where the materialized read-only base lives |
| `WORKSPACE_AGENTFS_DELTA_STORE=/var/...` | `${WORKSPACE_DIR}/_agentfs_deltas` | Where per-session delta dbs live |

## Reserved MCP server names

`__ccaas_*` is reserved for ccaas-internal MCP servers (currently just
`__ccaas_bash`). Solution backends must **not** register MCP servers
with these names — collisions log a warning and the ccaas entry wins.

## Troubleshoot

| Symptom | Cause | Fix |
|---|---|---|
| `WORKSPACE_PROVIDER=agentfs but binary 'agentfs' is not invokable` | binary missing from PATH | Set `WORKSPACE_AGENTFS_BIN` to absolute path |
| `mount` shows nothing after session create | FUSE / NFS not mounted | Linux: `modprobe fuse`, check `/dev/fuse` perms; macOS: nothing to fix usually |
| Sandbox active but claude still uses native Bash | claude version too old to respect `--disallowed-tools` | Update claude CLI to ≥ 2.1.x |
| `SandboxService cannot find just-bash MCP server at .../server.mjs` | nest-cli `assets` config missing | Confirm `packages/backend/nest-cli.json` has the `assets` block; rebuild |
| MCP server spawned but every command returns `exit=2` | claude sent an absolute host path (`/etc/...`) which doesn't exist inside the sandbox FS | This is correct sandbox behavior — claude should learn to use relative paths via the system prompt |
| Linux: `fuse: device not found` | kernel module not loaded | `sudo modprobe fuse` |
| Linux: permission denied accessing mount as non-root | missing `user_allow_other` in `/etc/fuse.conf` | uncomment that line and restart backend |

## Inspect what the agent did — Runtime API

Once a session is running (or recently completed but still in memory),
the ccaas backend exposes the AgentFS observability + control surface:

```bash
KEY=sk-your-admin-key
TENANT=demo-sandbox   # or your tenant slug
SID=demo-1234         # the session id

# 1. List every file the agent changed in its sandbox vs the base
curl -s "http://localhost:3001/api/v1/sessions/$SID/fs/diff" \
  -H "x-api-key: $KEY" -H "x-tenant-id: $TENANT" | python3 -m json.tool
# → [ { op: "added", type: "file", path: "/_scratch/notes.md" }, ... ]

# 2. Chronological tool-call log (mkdir / write / read / ...) recorded
#    by AgentFS's built-in audit
curl -s "http://localhost:3001/api/v1/sessions/$SID/fs/timeline?limit=50" \
  -H "x-api-key: $KEY" -H "x-tenant-id: $TENANT" | python3 -m json.tool

# 3. Checkpoint before a risky agent prompt; rollback if it goes wrong
curl -s -X POST "http://localhost:3001/api/v1/sessions/$SID/fs/snapshot" \
  -H "x-api-key: $KEY" -H "x-tenant-id: $TENANT" \
  -H 'Content-Type: application/json' \
  -d '{"label":"before-risky"}'
# (run another turn that might mess things up)
curl -s -X POST "http://localhost:3001/api/v1/sessions/$SID/fs/rollback" \
  -H "x-api-key: $KEY" -H "x-tenant-id: $TENANT" \
  -H 'Content-Type: application/json' \
  -d '{"label":"before-risky"}'
# → 204; subsequent fs/diff shows the post-rollback state
```

The demo-sandbox frontend at `:3010` ships with a "FS changes" side
panel that auto-fetches this after each session run — easiest way to
see the diff visually before reaching for curl.

### Per-session metadata KV (backend-owned, provider-agnostic)

Stash workflow state without polluting the agent's FS view:

```bash
# Set
curl -s -X PUT "http://localhost:3001/api/v1/sessions/$SID/meta/step" \
  -H "x-api-key: $KEY" -H "x-tenant-id: $TENANT" \
  -H 'Content-Type: application/json' \
  -d '{"value":{"current":3,"total":10}}'
# → { key, value: {current:3,total:10}, updatedAt }

# Read
curl -s "http://localhost:3001/api/v1/sessions/$SID/meta/step" \
  -H "x-api-key: $KEY" -H "x-tenant-id: $TENANT"

# List all keys
curl -s "http://localhost:3001/api/v1/sessions/$SID/meta" \
  -H "x-api-key: $KEY" -H "x-tenant-id: $TENANT"

# Delete
curl -s -X DELETE "http://localhost:3001/api/v1/sessions/$SID/meta/step" \
  -H "x-api-key: $KEY" -H "x-tenant-id: $TENANT"
```

Caps: 64 KB per value, 256 KB total per session. Larger payloads
belong in the session FS, not the KV.

## What stage-1 does NOT give you

These are out of scope for local self-host and remain backlogged:

- Scheduled tasks (`HeadlessExecutionService`) → still local-fs based
- Network isolation for claude itself
- Multi-tenant agentfs encryption (`--key/--cipher`)
- Closed-session forensic file browsing UI
- Containerized deploy (no Dockerfile — local self-host is bare-metal Node)

See [`WORKSPACE_PROVIDER.md`](./WORKSPACE_PROVIDER.md) for the full
re-prioritization rationale.
