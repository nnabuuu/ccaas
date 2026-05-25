# Chapter 8: Add Sandbox Capabilities to Your Solution (Advanced)

In the first 7 chapters you designed, implemented, and deployed the Lesson Plan Designer. It runs and is usable. But it's a **bare-host** solution — the AI Agent runs the host's bash and can read arbitrary files on the host (even with NestJS's RBAC standing in the way).

This chapter upgrades the solution to the **stage-1 sandbox** shape:

- AI Agent's file view is isolated in a per-session agentfs mount
- AI Agent's bash goes through the just-bash MCP interpreter, can't escape to the host
- The teacher-curated "reference textbook library" auto-seeds into every session for the agent to browse via `ls / grep / cat`
- Snapshot / rollback lets a teacher safely switch between "try 3 different lesson plan drafts"
- Metadata KV tracks per-session workflow state

You should already be comfortable with **production deployment** (Chapter 7). This chapter is optional and advanced — it doesn't affect the basic functionality of your solution. But if your use case involves any of "let AI manipulate multiple files / safely try alternatives / isolate different teachers' data", adding the sandbox dramatically lowers operational complexity.

## Prerequisites

- Completed Chapters 1-7
- Read [Runtime Architecture](../platform/runtime-architecture.md) (10 minutes)
- Plan to use [Solution Runtime Extension Points](../guide/extending-runtime.md) as a "recipe book" alongside this chapter

{% hint style="info" %}
**How this chapter and `guide/extending-runtime.md` divide responsibility**: that guide is a **standalone reference** of the 4 extension points; this chapter is an **end-to-end workflow** — starting from the concrete Lesson Plan Designer, step by step adding sandbox to it. They are deliberately non-overlapping: this teaches "how to change your solution," that teaches "how each API works."
{% endhint %}

## 8.1 Deciding Whether to Add the Sandbox

Adding the sandbox is **not free**:

| What adding sandbox costs you | What adding sandbox solves |
|---|---|
| Need to install `agentfs` binary at deploy | AI file operations no longer leak to the host filesystem |
| Platform code for macOS NFS / Linux FUSE | AI bash commands can't `rm -rf` the wrong directory |
| ~50-300ms extra session mount startup | Multi-teacher scenarios get natural isolation per session |
| Snapshot calls block ~300ms | Enables "let AI try 3 drafts, pick 1, discard others" |

**Triggers** (if any one applies, lean toward adding):

1. **Multi-tenant**: multiple teachers share one solution backend; you don't want teacher A's session to see teacher B's resources
2. **Sensitive data seeding**: you want the AI to see reference textbooks you've curated, not whatever the AI fetches from the host
3. **Reversible multi-draft workflow**: teacher asks the AI to generate 5 drafts, picks 1, the rest are discarded
4. **Audit requirement**: you need to answer "which files did the AI change in that session?"

If your solution is single-tenant, has the AI read only fixed templates, and has no "try-and-discard" workflow, **you can skip this chapter**.

## 8.2 Enable agentfs (deploy side)

This step is "don't touch your solution code, just change deploy config".

**Install agentfs** (macOS dev machine):

```bash
# Our fork (with NFS fix), from monorepo root
bash packages/vfs-poc/scripts/build-agentfs-fix.sh
```

Linux: see prerequisites table in [Local Self-Host](../getting-started/local-self-host.md).

**Restart ccaas backend with 4 added env vars**:

```bash
WORKSPACE_PROVIDER=agentfs \
  WORKSPACE_AGENTFS_BIN=$HOME/.cargo/bin/agentfs \
  WORKSPACE_BASH_SANDBOX=just-bash \
  SOLUTION_DIRS=lesson-plan-designer:$PWD/solutions/lesson-plan-designer \
  npm run start:prod -w @kedge-agentic/backend
```

Verify 4 startup log lines:

```
[BaseMaterializer]            materialized N skills (X files) + Y mcp servers → ...
[SandboxService]              Bash sandbox mode: just-bash (server: ...)
[AgentfsWorkspaceProvider]    agentfs binary OK: agentfs <sha>
[SessionAssetMaterializer]    Session asset materializer active for 1 tenant(s): lesson-plan-designer
```

Your solution is now running in the sandbox. The agent still does everything Chapters 1-7 taught — **just in an isolated environment now**.

## 8.3 Seed the Textbook Library into the Session

In Chapter 6.3 you wrote a few tools in the MCP server, but "reference textbook" type **read-only + large** content is awkward via MCP. A more natural way is to put it under `entities/` so the agent reads it directly via sandboxed `ls / grep / cat`.

**Add these two subdirs in your solution directory**:

```
solutions/lesson-plan-designer/
├── solution.json
├── frontend/
├── backend/
├── mcp-server/
├── skills/
├── entities/                       ← new
│   ├── textbooks/
│   │   ├── grade-5-math.md
│   │   ├── grade-5-chinese.md
│   │   └── ...
│   └── lesson-templates/
│       ├── inquiry-based.md
│       └── direct-instruction.md
└── resources/                      ← new
    ├── curriculum-standards/
    │   ├── grade-5-math-standards.md
    │   └── ...
    └── pedagogy-glossary.md
```

The `SOLUTION_DIRS` env var was already set in 8.2, so the ccaas backend picks up these directories on startup.

**Verify**: create a new session, look inside its workspace:

```bash
ls /tmp/<workspace-dir>/sessions/<session-id>/
# entities/  resources/  .claude/

ls /tmp/<workspace-dir>/sessions/<session-id>/entities/textbooks/
# grade-5-math.md  grade-5-chinese.md  ...
```

Backend log:
```
[SessionAssetMaterializer] Materialized session assets for lesson-plan-designer → ... (copied=12, ...)
```

**Capacity guardrails** (no config needed): 500 files / 1 MB per file / 10 MB total / symbolic-link rejection.

If your textbook library exceeds 10 MB, either split into multiple session templates (per-subject tenants), or move to a different storage (e.g. object storage) + MCP tool.

## 8.4 Make Your SKILL Sandbox-Aware

In Chapter 6.4 you wrote `lesson-plan-designer.md`. Now add a few paragraphs to tell the agent it's in a sandbox and where to read textbooks from:

```markdown
# Lesson Plan Designer Agent

You are a lesson-planning assistant. The teacher provides via form a
"<grade>-<subject>" topic they want to prepare. Your job is to generate
teaching objectives, activities, and assessments — written back to the
form via the write_output protocol.

## Sandbox Conventions

You are running in a **sandbox**:
- Your `Bash` tool is disabled. To run shell commands you MUST use
  `mcp____ccaas_bash__bash`.
- Your file view is per-session isolated. The `entities/` and
  `resources/` you see are pre-seeded by the solution.

## Available Materials

- `entities/textbooks/<grade>-<subject>.md` — textbook body (cat the
  one corresponding to the lesson)
- `entities/lesson-templates/*.md` — pedagogy templates (inquiry /
  direct-instruction / etc.)
- `resources/curriculum-standards/<grade>-<subject>-standards.md` —
  curriculum standards
- `resources/pedagogy-glossary.md` — pedagogy terminology

## Workflow

1. Use `mcp____ccaas_bash__bash` to run `ls entities/textbooks/` to
   confirm the textbook exists.
2. `cat` the chapter the teacher specified.
3. Reference the standards: `cat resources/curriculum-standards/...`,
   ensure objectives align.
4. Pick a pedagogy template (ask the teacher if they didn't specify).
5. Use `write_output` MCP tool to write the lesson plan back to the
   form.

## Output Rules

- Teaching objectives must be **observable and measurable**.
- Each activity must include estimated duration and pedagogy tag.
- Don't copy textbook content into the plan verbatim — cite instead.
```

**Progressive disclosure** (if your skill is long): split templates / examples into `skills/lesson-plan-designer/{tools,examples}/`. Keep the main SKILL.md to ~60 lines of entry + "when you need X, cat tools/X.md" directives. See the [demo-sandbox case](../examples/demo-sandbox.md)'s SKILL.md for how this works.

## 8.5 (Optional) DocumentEditProvider — Let the Agent Edit Lesson Plans

By 8.4, the agent uses the `write_output` MCP tool to write data back to the frontend form. That's enough for most cases.

But if you have a "teacher asks AI to modify a specific paragraph of an **already-saved** lesson plan" use case, a more natural pattern is to add a controller that extends `DocumentEditProvider` to your solution backend:

```ts
// solutions/lesson-plan-designer/backend/src/lesson-plans/lesson-plan.provider.ts
import { Injectable } from '@nestjs/common';
import { DocumentEditProvider } from '@kedge-agentic/context-layer/core';
import type { EntityDocument, ContentToAttrConfig } from '@kedge-agentic/entity-document';

@Injectable()
export class LessonPlanProvider extends DocumentEditProvider {
  async loadEntity(id: string) {
    // load from your DB / file
  }
  async saveEntity(id: string, updates: any) {
    // write back to DB
  }
  toEntityDocument(entity: any): EntityDocument {
    // convert lesson plan to entity-document block model
  }
  getEditableFields(): Set<string> {
    return new Set(['title', 'objectives', 'activities']);
  }
  getContentToAttrConfig(): ContentToAttrConfig {
    return {};
  }
}
```

Then expose a controller:

```ts
@Controller('api/lesson-plans/:id')
export class LessonPlanController {
  constructor(private provider: LessonPlanProvider) {}

  @Get()  serialize(@Param('id') id: string) {
    return this.provider.serialize(id, 'system');
  }
  @Put()  async edit(@Param('id') id: string, @Body() body: { ops: EditOperation[] }) {
    return this.provider.edit(id, body.ops, 'system');
  }
}
```

And tell the agent in SKILL.md: "to edit a lesson plan, use `curl -X PUT http://host.docker.internal:<your-port>/api/lesson-plans/<id> -d '<ops>'`".

Complete demo: [demo-sandbox case study](../examples/demo-sandbox.md) (different domain but the DocumentEditProvider usage is fully applicable).

## 8.6 (Optional) Snapshot/rollback — Multi-Draft Try-and-Discard Workflow

Teacher asks the AI to generate 5 lesson plan drafts, picks 1. How do you keep the 5 drafts from polluting each other?

```ts
// solutions/lesson-plan-designer/backend/src/draft-orchestrator.service.ts
async function generateAndSelectDraft(sessionId: string, prompt: string) {
  const CCAAS = process.env.CCAAS_URL!;
  const KEY = process.env.CCAAS_API_KEY!;
  const HDR = {
    'Content-Type': 'application/json',
    'x-api-key': KEY,
    'x-tenant-id': 'lesson-plan-designer',
  };
  const drafts: Array<{ label: string; content: string }> = [];

  for (let i = 1; i <= 5; i++) {
    // 1. checkpoint before each draft
    const label = `draft-${i}-pre`;
    await fetch(`${CCAAS}/api/v1/sessions/${sessionId}/fs/snapshot`, {
      method: 'POST', headers: HDR, body: JSON.stringify({ label }),
    });

    // 2. let the agent generate a draft
    await runAgentTurn(sessionId, `${prompt} (variant ${i})`);

    // 3. pull out the agent-written draft
    drafts.push({ label, content: await fetchGeneratedDraft(sessionId) });

    // 4. roll back to the checkpoint, ready for the next round
    await fetch(`${CCAAS}/api/v1/sessions/${sessionId}/fs/rollback`, {
      method: 'POST', headers: HDR, body: JSON.stringify({ label }),
    });
  }

  return drafts;  // teacher picks one, the rest are discarded
}
```

**Constraints**:
- Session must be `status === 'idle'` for snapshot/rollback — **wrap turn boundaries, not mid-stream**
- snapshot blocks ~300ms (stop daemon → cp → restart daemon)
- label must match `^[\w.-]{1,64}$`, no spaces, no `/`

Full endpoint spec: [Runtime REST API](../reference/runtime-api.md) § FS endpoints.

## 8.7 (Optional) Metadata KV — Track Your Solution's Own State

"Which pedagogy method did the teacher pick for this session?" / "Which draft did they select?" / "Which wizard step are we on?" — these are **not files**, they're the solution's session-level state.

Don't write them to `entities/` (that's for the agent). Use metadata KV:

```bash
# Solution backend records user choice
curl -X PUT "http://localhost:3001/api/v1/sessions/$SID/meta/wizard.step" \
  -H "x-api-key: $KEY" -H "x-tenant-id: lesson-plan-designer" \
  -H 'Content-Type: application/json' \
  -d '{"value":{"current":3,"total":7,"selectedTemplate":"inquiry-based"}}'

# Frontend polls periodically to update the progress bar
curl -s "http://localhost:3001/api/v1/sessions/$SID/meta/wizard.step" ...
# → { "key": "wizard.step", "value": {"current":3,...}, "updatedAt": "..." }
```

**Caps**: 64 KB / value, 256 KB / session. **Don't stuff large blobs** — large data goes through `entities/`.

agentfs not required: **this API works under any provider**.

## 8.8 Test Your Sandbox Setup

Four verification points, in order:

### 8.8.1 Startup verification

```bash
# Restart ccaas backend (with 8.2 env vars)
WORKSPACE_PROVIDER=agentfs ... npm run start:prod -w @kedge-agentic/backend

# Check 4 log lines (listed in 8.2)
```

### 8.8.2 Session creation verification

```bash
# Create a session
curl -X POST http://localhost:3001/api/v1/sessions/test-1/messages \
  -H 'x-api-key: ...' -H 'x-tenant-id: lesson-plan-designer' \
  -H 'Content-Type: application/json' \
  -d '{"templateName":"lesson-design","message":"first run ls entities/"}'

# Check the workspace dir
ls /tmp/<WORKSPACE_DIR>/sessions/test-1/
# Should see entities/  resources/  .claude/
```

### 8.8.3 Agent runs through sandbox bash

```bash
# Watch the sandbox bash log
tail -f /tmp/<WORKSPACE_DIR>/_sandbox_logs/bash-mcp.log
# When the agent runs ls / cat, each appears here:
# 2026-XX-XX [test-1] exec cwd=/ cmd=ls entities/textbooks/
# 2026-XX-XX [test-1] exec done exit=0
```

### 8.8.4 Snapshot/rollback verification

```bash
# When the session is in idle status
curl -X POST http://localhost:3001/api/v1/sessions/test-1/fs/snapshot \
  -H 'x-api-key: ...' -H 'x-tenant-id: lesson-plan-designer' \
  -H 'Content-Type: application/json' -d '{"label":"checkpoint-1"}'
# → 200 { "label": "checkpoint-1", "takenAt": "..." }

curl -X POST http://localhost:3001/api/v1/sessions/test-1/fs/rollback \
  ... -d '{"label":"checkpoint-1"}'
# → 204
```

## 8.9 Common Pitfalls

1. **fs/diff doesn't work after session closes** — sessions are removed from the in-memory Map after close, so the endpoint returns 404. Query while the session is alive.
2. **Snapshot mid-turn returns 409** — **by design**. Wrap turn boundaries, not mid-stream. Cycling the mount yanks the agent's file handles → EIO.
3. **`agentfs` binary not on PATH** — set `WORKSPACE_AGENTFS_BIN` to absolute path.
4. **SOLUTION_DIRS uses wrong slug** — use `tenant.slug` (the one in your solution.json), not the tenantId UUID.
5. **`entities/` exceeds 10MB cap** — see log `Skipping ... cap reached`. Slim down, or move to object storage + MCP tool.
6. **Agent uses native `Bash` instead of the MCP bash** — claude CLI too old (need ≥ 2.1.x) or the `--disallowed-tools` flag wasn't injected. Check the spawn command log.
7. **`.claude/` system files appear in fs/diff output** — expected (skill-sync wrote those during session startup). Not a bug.
8. **Multiple solutions register the same slug** — the later registration overrides. Slugs must be unique.

## 8.10 Recap: What You Have Now

After completing this chapter, your Lesson Plan Designer:

✅ AI agent runs in a per-session isolated agentfs mount — arbitrary host fs operations are isolated
✅ AI agent's bash goes through just-bash MCP — can't escape to host shell
✅ Teacher-uploaded textbooks / standards / pedagogy templates auto-seed into every session
✅ Your SKILL.md is aware of sandbox conventions and steers the agent correctly
✅ (optional) Structured REST API for editing lesson plans
✅ (optional) Let the agent try multiple drafts, pick one, roll back the rest
✅ (optional) Track wizard progress / user choices / solution state

Deployment-wise, this is **fully compatible** with Chapter 7's deploy checklist — you only added a few env vars to the ccaas backend; the frontend / backend / mcp-server / skills code structure is unchanged.

## Next Steps

- **Master the extension points**: [Solution Runtime Extension Points](../guide/extending-runtime.md) — standalone recipes for each of the 4 extension points
- **See a complete case**: [demo-sandbox case study](../examples/demo-sandbox.md) — an end-to-end example using all of 8.5-8.7
- **Full REST API spec**: [Runtime REST API](../reference/runtime-api.md)
- **Drop down a layer**: [Runtime Architecture](../platform/runtime-architecture.md) — how all of this works

## Exercise

Retrofit the Lesson Plan Designer you built in Chapter 6:

1. Add `entities/textbooks/` + `resources/curriculum-standards/` with at least 3 textbooks + 1 standards set
2. Update SKILL.md so the agent uses sandboxed bash to browse these materials
3. Implement the "multi-draft → pick one" workflow from 8.6, add it to your frontend wizard
4. Use metadata KV to record the user's currently-selected pedagogy

When done, compare your structure against the [demo-sandbox source](https://github.com/nnabuuu/ccaas/tree/master/solutions/business/demo-sandbox).
