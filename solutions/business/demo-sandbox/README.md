# demo-sandbox solution

A showcase solution for ccaas stage-1 sandboxed FS + bash. The agent
operates over a B2B SaaS dataset — customers, revenue, quarterly plans
— using `ls` / `grep` / `cat` routed through the just-bash MCP server.

## What it demonstrates

1. **Progressive-disclosure skill** — `skills/sandbox-explorer/` is a
   multi-file skill: a short `SKILL.md` plus `tools/` and `examples/`
   subdirectories. The agent reads the entry point eagerly, then
   `cat`s sub-files only as needed.
2. **Sandboxed bash** — every shell command routes through
   `mcp____ccaas_bash__bash`; the agent's native `Bash` tool is denied.
3. **Sandboxed FS** — agentfs gives each session an isolated view; the
   agent cannot see the host filesystem.
4. **Seeded entities** — `entities/{customers,revenue,plans}/` are
   materialized into every session's sandbox at startup, so the agent
   has real data to reason over from turn 1.
5. **Static resources** — `resources/{glossary,data-dictionary,
   playbooks}/` are reference material the skill can `cat`.
6. **DocumentEditProvider** (optional, requires solution backend running)
   — the agent can mutate entities via `PUT /api/demo-sandbox/entities/:id`,
   exercised through `curl` from inside the sandbox.

## Quick start (5 commands)

```bash
# 1. Prereqs: agentfs binary + claude CLI OAuth'd
#    (see packages/vfs-poc/docs/STAGE1_LOCAL_SELFHOST.md)

# 2. ccaas backend with sandbox + this solution registered
WORKSPACE_PROVIDER=agentfs \
  WORKSPACE_AGENTFS_BIN=$HOME/.cargo/bin/agentfs \
  SOLUTION_DIRS=demo-sandbox:$PWD/solutions/business/demo-sandbox \
  npm run start:dev -w @kedge-agentic/backend

# 3. Solution backend (optional, only needed for DocumentEditProvider demo)
cd solutions/business/demo-sandbox/backend
CCAAS_URL=http://localhost:3001 CCAAS_API_KEY=dev npm run start

# 4. Trigger a session
curl -X POST http://localhost:3001/api/v1/sessions/demo-1/messages \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: dev' \
  -d '{
    "tenantId": "demo-sandbox",
    "templateName": "explore",
    "message": "Which of our customers is at risk of churning? Use the data, not your assumptions."
  }'
```

The agent should `ls entities/customers/`, then `grep` for churn-related
terms, `cat` the matching file, optionally `cat
resources/playbooks/churn-response.md`, and produce a summary citing
specific file paths.

## Directory tour

```
demo-sandbox/
├── solution.json                     # tenant config (v3 schema)
├── skills/sandbox-explorer/
│   ├── SKILL.md                      # entry point — short
│   ├── tools/                        # bash cheatsheets
│   └── examples/                     # task patterns
├── entities/                         # ← seeded into agent's sandbox
│   ├── customers/                    # 3 demo accounts (healthy, expansion, at-risk)
│   ├── revenue/                      # quarter summary + segment data
│   └── plans/                        # roadmap + budget
├── resources/                        # ← also seeded; reference material
│   ├── glossary.md
│   ├── data-dictionary.json
│   └── playbooks/
└── backend/                          # tiny NestJS — only for DocumentEditProvider
    └── src/
        ├── main.ts
        └── entities/
            ├── demo-entity.provider.ts
            └── entities.controller.ts
```

## Hot reload (dev)

Set `SKILL_WATCH=1` on the ccaas backend startup command. Now editing
any file under `skills/`, `entities/`, or `resources/` triggers a
500-ms-debounced reimport — next session sees the change without a
backend restart.

## Architecture notes

- Solution backend is **independent** from ccaas backend (separate
  process, separate port). It auto-registers via
  `POST /api/v1/admin/solutions/import` on bootstrap, same pattern as
  other solutions (`article-analyzer`, `recipe-book`, etc.).
- `entities/` and `resources/` are seeded into the per-session sandbox
  by `BaseMaterializer` — they appear at the **root of the agent's CWD**
  (i.e. `entities/customers/acme.md`, not `/tenants/.../entities/...`).
- The MCP just-bash sandbox is shared infrastructure
  (`packages/backend/src/sessions/sandbox/`), not a solution-specific
  feature.

## Limitations

- The `DemoEntityProvider` uses an in-memory Map. Edits don't persist
  across solution-backend restarts. (Acceptable for a demo; real
  solutions would back this with TypeORM.)
- No frontend ships with this solution — drive it via curl or the
  admin-next dashboard.
