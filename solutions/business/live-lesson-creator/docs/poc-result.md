# Phase A — PoC result

**Date**: 2026-05-26
**Goal**: prove agent-runtime → REST artifact source → live-lesson backend can deliver end-to-end agent-edits-manifest in `/task-demo`-style workflow, with three SSE streams (session events / project changes / live-lesson DB writes) green.

## TL;DR

| | Status |
|---|---|
| Both backends boot from clean checkout | OK (after fixing one circular DI bug — see drive-by below) |
| `solution.json` auto-import (tenant + session templates) | OK |
| **`solution.json` auto-import (skills from `skills/*` glob)** | **OK — added in follow-up** |
| live-lesson `GET /api/projects/:id/artifacts` | OK |
| live-lesson `PUT /api/projects/:id/artifacts` | OK — content round-trips through `project_files.content` |
| ccaas `GET /projects/:id/changes` SSE subscriber stream | OK — sends `subscribed` event on open |
| ccaas `POST /projects/:id/invalidate` (trigger early sync) | OK — returns `{accepted: N}` (`N=0` when no session bound) |
| **ccaas `POST /sessions/:id/bind-project` endpoint** | **OK — added in follow-up** |
| **Bootstrap sync delivers SSE `updated` events on bind** | **OK — verified end-to-end in `scripts/poc-smoke.sh`** |
| Agent session reads + edits manifest via Claude CLI | Not yet — needs an actual Claude CLI subscription / API key (real LLM call) |

The three glue items from the original PoC are now closed (see ["Glue items resolved"](#glue-items-resolved) below). The architecture is operational: a fresh session can bind to a project, the bootstrap sync fires, change events arrive on the SSE stream. Real agent edits require an LLM connection that the PoC env doesn't have configured (out of scope for the wiring proof).

## Glue items resolved

All three blockers from the first PoC pass are now fixed:

1. **Skill auto-import**: `SolutionLoaderService.importFromConfig` now accepts a `solutionDir` argument; when present (the filesystem auto-discovery path), it walks the `config.skills` glob, reads each `skills/<name>/SKILL.md`, parses YAML frontmatter via `validateSkillFrontmatter`, recursively collects sibling files (`tools/`, `examples/`, `scripts/`), and calls `SkillsService.create()`. Idempotent — existing `(tenantId, slug)` is skipped. Body-only `POST /admin/solutions/import` skips skills with a warning (the source tree isn't reachable). Verified: `manifest-editor` skill + 5 sibling files land in `skills` + `skill_files` tables on boot.

2. **`POST /api/v1/sessions/:sessionId/bind-project`**: thin controller wrapping `SessionService.bindToProject`. Body: `{ projectId, tenantId }`. Fires `session.bound` → `SessionAssetSyncer.onSessionBound` → first artifact load. Idempotent. Verified: bind triggers two SSE `updated` events (one per scaffolded file) on `/projects/:pid/changes`.

3. **`SessionMetadata` entity registration**: was missing from `TypeOrmModule.forRoot()` entities list in `app.module.ts` (declared in `SessionsModule` `forFeature` but not at the root) — caused `EntityMetadataNotFoundError` on the first `bindToProject` call. Added to the root entity list.

Plus the operational helper `scripts/poc-smoke.sh` does the full sequence end-to-end + asserts the SSE events arrived. Run it any time to re-verify after a refactor.

## Original glue items (now historical — kept for context)

### 1. Skill files don't auto-import from `solution.json`

`SolutionLoaderService` (`packages/backend/src/solutions/solution-loader.service.ts`) reads `solution.json`, creates the tenant, applies session templates, registers MCP servers, persists `tenant.config.artifactUrl` — but does NOT walk the `skills: ["skills/*"]` glob and persist skill files into the `skills` + `skill_files` tables.

Workarounds:
- **`npm run solution:migrate`** — the documented import script (`src/scripts/migrate-solution.ts`) is currently **disabled** (file renamed `.ts.disabled`) per the v3.0 schema TODO at its header
- **Manual `POST /api/v1/skills`** per file — requires admin-scope auth + handwritten payloads
- **Hot-reload PR in flight** — recent commits mention `demo-sandbox hot-reload entity api` (`cdb7d82f`); may already cover skills in a near-future change

Recommendation: open a follow-up to **re-enable / rewrite `solution:migrate`** for v3.0 schema, OR have `SolutionLoaderService` import skills from `skills/*/SKILL.md` when present. Without one of these, every solution needs manual skill registration before its agent sessions know what skill to use.

### 2. Session-to-project binding has no public HTTP endpoint

`SessionService.bindToProject(sessionId, tenantId, projectId)` exists (`packages/backend/src/sessions/session.service.ts:285`) and fires `session.bound` → `SessionAssetSyncer.onSessionBound` → first artifact load from live-lesson. But the only HTTP route to it is indirect:

- `PUT /api/v1/sessions/:id/meta/projectId` (the SessionMetadata KV API) → does **NOT** emit `session.bound` → bootstrap sync doesn't fire
- No top-level `POST /api/v1/sessions/:id/bind-project` exists

Workarounds:
- Add a thin `POST /api/v1/sessions/:id/bind-project { projectId }` controller wrapping `SessionService.bindToProject` (~15 LOC)
- OR have `SessionMetadataService.put` detect the special `projectId` key and call `bindToProject` so external metadata writes also trigger the bootstrap

Recommendation: add the bind-project controller — explicit is better than special-casing a key name.

### 3. Admin endpoints require auth even with `AUTH_ALLOW_ANONYMOUS=true`

`@Auth('admin')` on `/api/v1/sessions/:id/meta/*` and `/api/v1/skills POST` blocks anonymous requests even when anonymous access is allowed elsewhere. For the PoC we need a dev API key with admin scope (`packages/backend/scripts/create-dev-api-key.ts` exists for exactly this) — but the docs / runbook don't surface this clearly.

Recommendation: write a 3-line `bin/poc-setup.sh` that:
1. Calls `create-dev-api-key.ts` for the live-lesson-creator tenant
2. Prints the key + the curl commands to bind a session

## Drive-by fix landed during PoC

**Circular DI bug in `@kedge-agentic/backend`** — `SessionService` (line 106) and `SessionMetadataService` (line 48) mutually inject each other without `forwardRef`. Backend wouldn't boot from a clean `dist/` build with **any** env config; the error message points at SessionMetadataService's constructor dep at index 0.

Fix: wrap both injections in `forwardRef`. Patches:
- `packages/backend/src/sessions/session.service.ts:106` — `@Inject(forwardRef(() => SessionMetadataService))`
- `packages/backend/src/sessions/services/session-metadata.service.ts:47` — `@Inject(forwardRef(() => SessionService))`

Filed as part of this PoC; staged in working tree pending decision on whether to commit (low-risk 4-line fix, but adjacent to active migration work).

## What we DID verify

```bash
# 1. live-lesson :3007 boots with synchronize=true (TypeORM auto-creates task_demo_attempts etc.)
node solutions/business/live-lesson/backend/dist/main.js

# 2. ccaas :3001 boots, auto-imports 18 solutions from SOLUTIONS_DIR including live-lesson-creator
SOLUTIONS_DIR=$(realpath solutions/business) \
  WORKSPACE_PROVIDER=local AUTH_ALLOW_ANONYMOUS=true \
  node packages/backend/dist/src/main.js
# log shows:
#   "Created tenant Live Lesson Creator (live-lesson-creator)"
#   "auto-imported solution from .../live-lesson-creator/solution.json"

# 3. Create + edit a project's manifest via live-lesson artifact API
PID=$(curl -sX POST :3007/api/projects -d '{"title":"v7-poc"}' | jq -r .id)
curl -sX PUT ":3007/api/projects/$PID/artifacts?path=execution/manifest.json" \
  -d '{"content":"{\"id\":\"'$PID'\",\"title\":\"Edited\",...}","type":"json"}'
curl -s ":3007/api/projects/$PID/artifacts" | jq '.[0].content'
# → "{\"id\":\"...\",\"title\":\"Edited\",...}"  ✅

# 4. Subscribe to ccaas change stream
curl -sN ":3001/projects/$PID/changes"
# → id: 1
#   data: {"projectId":"...","kind":"subscribed","at":"..."}  ✅

# 5. Trigger early sync
curl -sX POST ":3001/projects/$PID/invalidate"
# → {"accepted":0}  — 0 sessions bound; sync no-op (expected)
```

## What we did NOT verify (deferred to next iteration)

- Agent session actually spawning Claude CLI in a workspace mounted with `project/` from the artifact source
- `SyncEngine` running at turn boundary + writing through to `live-lesson` DB
- Change SSE event fires when agent writes (the proof point for the design)
- LLM latency / cost for an "edit manifest title" turn

These all depend on the three glue items in the previous section. Once those are resolved, the existing curl-driven recipe should complete the loop.

## Notes for the design doc (Phase B)

- Architecture is correct; the abstractions cleanly separate concerns (live-lesson doesn't know about agent; agent-runtime doesn't know about manifest)
- The change stream is **agent→backend direction only** — direct human edits to live-lesson via `/creator` UI bypass the SSE entirely (no listener on live-lesson's side). For creator-v7's "live updates" promise, the UI must subscribe to BOTH `/projects/:id/changes` (agent edits) AND poll `/api/projects/:id/files` (human edits) OR add live-lesson-side SSE
- The 3 glue items above are blockers for any product use; should be in the doc's "must finish before promoting to feature" section
- Skill design (`manifest-editor`) is good but the operational lift to get it loaded ≈ developing the skill itself today. Worth investing in the auto-import path.
