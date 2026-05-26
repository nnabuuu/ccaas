# Case: demo-sandbox solution

> A **runnable** B2B SaaS demo that exercises every stage-1 sandbox capability at once: progressive-disclosure skill, auto-seeded entities, DocumentEditProvider two-way edit, hot reload, single-page UI + FS diff inspector. Read this page + ~5 minutes of setup and you'll have a complete working experience.

## What this demo shows

| Capability | Where you see it |
|---|---|
| Workspace sandbox (agentfs) | startup log `[AgentfsWorkspaceProvider] agentfs binary OK: agentfs <sha>` |
| Bash sandbox (just-bash MCP) | `_sandbox_logs/bash-mcp.log` — every bash call the agent made |
| Per-session entities seed | after session create: `ls sessions/<id>/entities/customers/` |
| **Progressive-disclosure skill** | `skills/sandbox-explorer/{SKILL.md, tools/, examples/}` — main SKILL.md is only 60 lines; sub-files cat'd on demand |
| DocumentEditProvider | `PUT /api/demo-sandbox/entities/:id` with str_replace ops → mutates disk |
| Hot reload | edit `skills/sandbox-explorer/tools/ls-cheatsheet.md` → 500ms later ccaas DB has the new skill content |
| Diff inspector frontend | "FS changes" panel in the right column — auto-populates after the agent runs |

## Theme

**B2B SaaS operations**. Mock dataset:
- `entities/customers/{acme,globex,initech}.md` — three customer accounts (healthy / expansion / at-risk)
- `entities/revenue/{q1-summary.md, mrr-by-segment.json}` — quarterly revenue
- `entities/plans/{q2-roadmap.md, infra-budget.json}` — strategic plan + budget
- `resources/{glossary.md, data-dictionary.json, playbooks/}` — reference material

The agent uses sandboxed `ls`/`grep`/`cat` to browse these and answer business questions ("which customer is at risk of churning?", "what's the Q2 infra budget?"), then can edit customer status through the entity API.

## Start (4 commands)

```bash
# 1. Prereqs: agentfs binary + claude OAuth — see getting-started/local-self-host.md

# 2. ccaas backend: sandbox mode + register demo-sandbox via SOLUTION_DIRS
WORKSPACE_PROVIDER=agentfs \
  WORKSPACE_AGENTFS_BIN=$HOME/.cargo/bin/agentfs \
  WORKSPACE_DIR=/tmp/demo-sandbox \
  DATABASE_PATH=/tmp/demo-sandbox/data.db \
  SOLUTION_DIRS=demo-sandbox:$PWD/solutions/business/demo-sandbox \
  INITIAL_ADMIN_KEY=sk-demo-1234567890abcdef \
  PORT=3009 \
  npm run start:prod -w @kedge-agentic/backend

# 3. demo-sandbox solution backend: registers + hot-reloads + entity API + serves frontend
cd solutions/business/demo-sandbox/backend
CCAAS_URL=http://localhost:3009 \
  CCAAS_API_KEY=sk-demo-1234567890abcdef \
  PORT=3010 \
  npm start

# 4. Browser
open http://localhost:3010/
```

On backend startup you should see:
```
[SandboxService]            Bash sandbox mode: just-bash (server: ...)
[BaseMaterializer]          materialized 1 skills (6 files) + 0 mcp servers → /tmp/.../base
[SessionAssetMaterializer]  Session asset materializer active for 1 tenant(s): demo-sandbox
[Bootstrap]                 Application is running on: http://localhost:3009
```

On solution backend startup you should see:
```
[DemoEntityProvider]        Loaded 3 entities from .../entities (editable fields: ...)
[SolutionRegisterService]   Solution registered: solutionId=...
[SolutionRegisterService]   Created skill sandbox-explorer (id=...)
[SolutionRegisterService]   Upserted 6 file(s) for sandbox-explorer
[SolutionRegisterService]   Hot-reload watcher active on .../skills
[DemoSandbox]               Backend running on http://localhost:3010
```

## Recommended first prompt

In the browser left column, click `initech` first (establishes the before-baseline). Then in the prompt box:

```
Read entities/customers/initech.md, identify why it's at-risk in one
short paragraph, then PUT status=renewal_at_risk via the entity API at
http://localhost:3010/api/demo-sandbox/entities/initech.
```

Click Run. The event log streams in real-time:

- `SESSION demo-xxxxxxxx`
- `STATUS running`
- `TOOL mcp____ccaas_bash__bash start · ls entities/customers/` ✨ **proof the sandbox is working**
- `TOOL mcp____ccaas_bash__bash start · grep -l "churn\|at-risk" ...`
- `TOOL mcp____ccaas_bash__bash start · cat entities/customers/initech.md`
- `TOOL mcp____ccaas_bash__bash start · curl -X PUT http://localhost:3010/api/demo-sandbox/entities/initech -d '...'`
- `MSG Initech's risk stems from ...`
- `STATUS complete`

After the session ends:
- middle column "After" automatically diff-highlights initech.md's changes
- right column "FS changes" lists every file the agent touched (not just the entity being tracked)

## Verify hot reload

```bash
echo "<!-- hot reload test $(date +%s) -->" \
  >> solutions/business/demo-sandbox/skills/sandbox-explorer/tools/ls-cheatsheet.md
```

Solution backend log immediately shows:

```
[SolutionRegisterService] Detected change on skills/sandbox-explorer/tools/ls-cheatsheet.md — scheduling re-register
[SolutionRegisterService] Upserted 6 file(s) for sandbox-explorer
```

Next session create (re-copies base) picks up the new content.

## Code map

```
solutions/business/demo-sandbox/
├── solution.json                  # tenant + sessionTemplates config
├── README.md
├── skills/sandbox-explorer/        # progressive-disclosure skill exemplar
│   ├── SKILL.md                   # main 60 lines; tells agent "cat sub-files when needed"
│   ├── tools/                     # ls/grep/workflow cheatsheets
│   └── examples/                  # task patterns (find-customer / search-plan / edit-entity)
├── entities/                      # SessionAssetMaterializer seeds these per session
│   ├── customers/{acme,globex,initech}.md
│   ├── revenue/{q1-summary.md, mrr-by-segment.json}
│   └── plans/{q2-roadmap.md, infra-budget.json}
├── resources/                     # also seeded; reference material
│   ├── glossary.md
│   ├── data-dictionary.json
│   └── playbooks/{churn-response.md, expansion-qualification.md}
└── backend/                       # standalone NestJS process :3010
    └── src/
        ├── main.ts
        ├── solution-register.service.ts  # bootstrap registration + chokidar hot reload
        ├── demo/
        │   └── demo.controller.ts        # GET / serves index.html + POST /demo/run SSE proxy + GET /demo/fs-diff/<sid> proxy
        ├── entities/
        │   ├── demo-entity.provider.ts    # extends DocumentEditProvider
        │   └── entities.controller.ts     # GET/PUT /api/demo-sandbox/entities/:id
        └── (frontend's index.html lives at ../../frontend/)
```

## How this demo wires all the concepts together

| Concept | How the demo exercises it |
|---|---|
| `WorkspaceProvider` (agentfs) | agent does ls/cat on the mount; writes land in the SQLite delta, base stays unchanged |
| `SandboxService` + just-bash MCP | every bash call goes through `mcp____ccaas_bash__bash` |
| `BaseMaterializer` | projects sandbox-explorer's SKILL.md + 6 sub-files to the agentfs base; every session sees them via overlay |
| `SessionAssetMaterializer` | copies entities/ + resources/ into each demo-sandbox session's workspace root |
| Solution backend pattern | standalone process bootstraps registration via POST to ccaas + exposes domain REST API |
| Hot reload | chokidar watches skills/, debounced 500ms, re-POSTs the skill registration |
| `DocumentEditProvider` (context-layer) | DemoEntityProvider implements the 5 abstract methods; uses str_replace ops to mutate markdown + writes back to disk |
| Runtime fs/diff REST | the "FS changes" panel uses this to show what the agent changed |
| Runtime fs/snapshot+rollback | (optional curl) checkpoint state before a prompt, rollback if it goes wrong |

## Teardown

```bash
# kill the processes
kill $(lsof -ti :3009 -i :3010 -sTCP:LISTEN)
# clear sandbox data
rm -rf /tmp/demo-sandbox
# revert any files the demo's edits touched
git checkout solutions/business/demo-sandbox/
```

## See also

- Source: `solutions/business/demo-sandbox/`
- Skill source: `solutions/business/demo-sandbox/skills/sandbox-explorer/`
- README: `solutions/business/demo-sandbox/README.md`
- Build your own with the same pattern: `guide/extending-runtime.md`
- The layered architecture this demo exercises: `platform/runtime-architecture.md`
