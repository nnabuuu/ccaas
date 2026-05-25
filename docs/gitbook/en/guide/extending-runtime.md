# Solution extension points — using the new runtime features

> You already know the existing solution template (Skills + MCP + sessionTemplates). This page teaches the 4 new stage-1 extension points: (1) seed your own data into every session, (2) write a custom `ContentSource` to replace TypeORM, (3) wrap high-risk agent prompts in snapshot/rollback, (4) use metadata KV to store your solution's own session state. Each comes with a minimal copy-pasteable example.

## TL;DR — 4 extension points cheat sheet

| I want | Reach for |
|---|---|
| Agent should see my data via `ls` from turn 1 | `entities/` + `resources/` directories + `SOLUTION_DIRS` env var |
| Replace TypeORM as the skill source (load from JSON / API / different DB) | Implement the `ContentSource` interface |
| Give the agent a "try, can rollback" workflow | `POST /sessions/:id/fs/snapshot` + `/fs/rollback` |
| Store solution's own session state (step count, variant, flag) | `GET/PUT /sessions/:id/meta/:key` |

Details below.

---

## 1. Seed your data into the session

**Problem**: solution wants the agent to see a set of business data / reference material from the start, without making the agent fetch it.

**How**: create two special subdirectories in your solution dir:

```
solutions/business/<your-slug>/
├── entities/      ← business data
│   ├── customers/...md
│   └── plans/...json
└── resources/     ← reference material (glossary, playbooks, etc.)
    ├── glossary.md
    └── data-dictionary.json
```

When booting the ccaas backend, register your dir via `SOLUTION_DIRS`:

```bash
SOLUTION_DIRS=<your-slug>:$PWD/solutions/business/<your-slug> \
  WORKSPACE_PROVIDER=agentfs \
  ... \
  npm run start:prod -w @kedge-agentic/backend
```

After startup you should see:
```
[SessionAssetMaterializer] Session asset materializer active for 1 tenant(s): <your-slug>
```

Every new session under this tenant: `SessionAssetMaterializer` copies these directories into the workspace root. The agent can `ls entities/` right away.

**Safety guards** (built-in): 500 files cap, 1MB per file, 10MB total, symbolic-link rejection. See `packages/backend/src/sessions/services/session-asset-materializer.service.ts`.

**How does the skill tell the agent about these?**: in your SKILL.md, document what's under `entities/` and `resources/`. Look at the [demo-sandbox SKILL.md](../examples/demo-sandbox.md) for a worked example.

---

## 2. Write a custom `ContentSource` (replace TypeORM as skill source)

**Problem**: by default the ccaas backend stores skills in its own TypeORM SQLite. You may want to load from plain JSON / an external API / your own DB.

**How**: implement `@kedge-agentic/agentfs-runtime`'s `ContentSource` interface (**only 2 methods**):

```ts
// my-content-source.ts
import { readFileSync } from 'node:fs';
import type {
  ContentSource, SkillContent, McpServerContent,
} from '@kedge-agentic/agentfs-runtime';

export class JsonFileContentSource implements ContentSource {
  constructor(private jsonPath: string) {}

  async listActiveSkills(): Promise<ReadonlyArray<SkillContent>> {
    const data = JSON.parse(readFileSync(this.jsonPath, 'utf8'));
    return data.skills ?? [];
  }

  async listActiveMcpServers(): Promise<ReadonlyArray<McpServerContent>> {
    const data = JSON.parse(readFileSync(this.jsonPath, 'utf8'));
    return data.mcpServers ?? [];
  }
}
```

Swap your adapter in for the default (modify backend's `sessions.module.ts` factory):

```ts
import { JsonFileContentSource } from './my-content-source';

providers: [
  { provide: JsonFileContentSource, useValue: new JsonFileContentSource('/data/skills.json') },
  {
    provide: BaseMaterializer,
    useFactory: (src: JsonFileContentSource, cfg: ConfigService) => {
      const baseDir = cfg.get('workspace.agentfs.baseDir') || ...;
      return new BaseMaterializer(src, baseDir, new NestLoggerAdapter('BaseMaterializer'));
    },
    inject: [JsonFileContentSource, ConfigService],
  },
],
```

Test with `InMemoryContentSource`:

```ts
import { InMemoryContentSource } from '@kedge-agentic/agentfs-runtime/testing';

const src = new InMemoryContentSource([/* fixtures */]);
// + your adapter test uses jest mocks + InMemoryContentSource for compare
```

Full API + adapter-writing notes: `reference/agentfs-runtime.md`.

---

## 3. Snapshot / rollback around "risky" steps

**Problem**: in a multi-turn workflow, the agent could mess up a lot of files in one step. After a failure, you want to return to the state before that step instead of starting over.

**How**: in your solution backend (or frontend) workflow code, wrap critical turns.

```ts
// solution backend controller
async function executeRiskyStep(sessionId: string) {
  const ccaas = process.env.CCAAS_URL;
  const apiKey = process.env.CCAAS_API_KEY;
  const tenant = 'my-solution';
  const HDR = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'x-tenant-id': tenant,
  };

  // 1. checkpoint
  const label = `pre-risk-${Date.now()}`;
  await fetch(`${ccaas}/api/v1/sessions/${sessionId}/fs/snapshot`, {
    method: 'POST', headers: HDR, body: JSON.stringify({ label }),
  });

  try {
    // 2. let the agent run the risky prompt (your helper here)
    await runAgentTurn(sessionId, 'try the experimental refactor');

    // 3. validate the output. Throw if not OK.
    const ok = await validate(sessionId);
    if (!ok) throw new Error('validation failed');

  } catch (err) {
    // 4. rollback
    await fetch(`${ccaas}/api/v1/sessions/${sessionId}/fs/rollback`, {
      method: 'POST', headers: HDR, body: JSON.stringify({ label }),
    });
    throw err;
  }
}
```

**Notes**:
- session must be `status === 'idle'` to snapshot/rollback — otherwise 409. **Wrap turn boundaries, not mid-stream.**
- snapshot goes through a daemon cycle (stop-cp-restart), ~300ms blocking. Light but not free.
- label charset: `^[\w.-]{1,64}$`, no spaces, no `/`.
- requires `WORKSPACE_PROVIDER=agentfs`, otherwise 400.

Full endpoint spec: `reference/runtime-api.md` § FS endpoints.

---

## 4. Session metadata KV — store your solution's own state

**Problem**: your solution wants to track "which step is the user on", "is this session experiment A or B", "what was the last successful checkpoint label"… Should these go in `entities/`? No — that's for the agent.

**How**: use the per-session KV API (**provider-agnostic, works under any provider**):

```bash
# Solution starting a multi-step workflow
curl -X PUT "http://localhost:3001/api/v1/sessions/$SID/meta/workflow.step" \
  -H "x-api-key: $KEY" -H "x-tenant-id: $TENANT" \
  -H 'Content-Type: application/json' \
  -d '{"value":{"current":1,"total":7,"experimentVariant":"B"}}'

# Increment after each step completes
curl -X PUT "http://localhost:3001/api/v1/sessions/$SID/meta/workflow.step" \
  ... -d '{"value":{"current":2,"total":7,"experimentVariant":"B"}}'

# Frontend / other service polls
curl -s "http://localhost:3001/api/v1/sessions/$SID/meta/workflow.step" \
  -H "x-api-key: $KEY" -H "x-tenant-id: $TENANT"
# → { "key": "workflow.step", "value": {...}, "updatedAt": "..." }
```

**Caps**: 64KB / value, 256KB / session. **Caps are hard** — don't stuff blobs into KV. Large data goes through `entities/` + agent reads.

**Why backend SQLite, not agentfs KV**:
- agentfs KV lives in the FUSE-daemon-held SQLite delta; external reads need a cp dance — messy
- backend's SQLite survives session lifecycle (you can query "last variant" even after session closes)
- provider-agnostic: local also works

Details: `reference/runtime-api.md` § Metadata KV endpoints + [[sandbox-mount-vs-sdk]] design record.

---

## Some possible combinations

**A/B experiment + sandbox**:
1. Use KV to record the experiment variant (A/B) the session got
2. At session start, use KV to decide whether to show the agent some entity (in addition to SessionAssetMaterializer, your solution writes extra files into the session dir)
3. At each key decision point: snapshot + log to KV
4. Failed experiment → rollback

**Workflow checkpoint UI**:
1. Solution frontend stores `(step, current snapshot label)` to KV after each agent step
2. UI shows a "step history" letting the user click back to any step
3. Click back = `POST /fs/rollback` + roll the KV step back

**Multi-tenant safe sandbox**:
1. Per-tenant SOLUTION_DIRS entries, entities/ isolated
2. Sessions don't see each other (agentfs delta is per-session)
3. Same tenant's sessions share base overlay (skills), no shared delta

---

## What NOT to do

- ❌ Don't directly read/write `${WORKSPACE_DIR}/sessions/<id>/` from your solution. Session lifecycle should be the backend's concern; use the REST API.
- ❌ Don't bypass `SessionAssetMaterializer` to copy files directly into the session dir — you lose size caps and safety checks.
- ❌ Don't name your MCP server with the `__ccaas_*` prefix. That's reserved; collisions are silently overridden by the ccaas-internal one.
- ❌ Don't snapshot/rollback mid-turn — you'll get 409, and even if you forced it, you'd EIO the agent's file handles.
- ❌ Don't put > 1KB values into KV, and especially don't base64 large files. Large data → `entities/`.

---

## See also

- `platform/runtime-architecture.md` — where these extension points sit in the overall layers
- `reference/runtime-api.md` — full REST endpoint spec
- `reference/agentfs-runtime.md` — ContentSource port details
- `examples/demo-sandbox.md` — a complete case using nearly all of these extension points
