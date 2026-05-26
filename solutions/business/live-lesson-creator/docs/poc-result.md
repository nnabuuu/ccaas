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
| ccaas `GET /projects/:id/changes` SSE subscriber stream | OK — `?token=<apiKey>` required (Phase 2b-2); sends `subscribed` event on open |
| ccaas `POST /projects/:id/invalidate` (trigger early sync) | OK — `?token=<apiKey>` required; returns `{accepted: N}` (`N=0` when no session bound) |
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

## Phase 2b-2 update (2026-05-26): SSE auth + corrected URL

Phase 2b-2 added query-param token auth to the agent-runtime SSE feed. Two concrete changes:

1. **`?token=<apiKey>` is now required** on both `/projects/:id/changes` (SSE) and `/projects/:id/invalidate`. Missing/invalid token → 401; token's tenant must match the project's owning tenant → else 403. `EventSource` can't set HTTP headers, hence the query-param convention.

2. **The SSE/invalidate endpoints live at the bare namespace** (`/projects/:id/changes`), NOT under `/api/v1/` like the sessions controller. The route is `@Controller('projects/:projectId')` at `packages/backend/src/sessions/agent-runtime/project-changes.controller.ts`. Earlier creator code that hit `/api/v1/projects/...` was broken; fixed in `solutions/business/live-lesson/creator/src/api/projects.ts` (`getChangesStreamUrl`).

**How the project → tenant resolution works (deviation from original 2b-2 plan)**: instead of a per-solution `LiveLessonProjectTenantResolver` + `CourseProject.tenantId` migration, ccaas ships `SessionMetadataProjectTenantResolver` that reads the `(tenantId, projectId)` link already persisted by `bind-project` into `session_metadata`. Pros: zero per-solution work, one indexed SQLite lookup. Trade-off: projects with no session ever bound resolve to null → 403 (caller must bind a session before subscribing). Header doc lives in `packages/backend/src/sessions/agent-runtime/session-metadata-project-tenant-resolver.ts`.

**Smoke flow updated** (more than the auth change — required by the timing of SSE auth):

The original smoke opened SSE BEFORE bind-project. That worked because there was no auth. With 2b-2's auth, the SSE handshake requires the `(tenantId, projectId)` row in `session_metadata` to exist already — which only happens after `bind-project`. So the ordering had to flip. The current flow:

1. Create project on live-lesson; mint API key for tenant.
2. POST first message → auto-creates session (~7s, LLM-bound).
3. POST `/sessions/:id/bind-project` → writes metadata row + fires async bootstrap sync (whose events fire before any SSE is connected — these are intentionally "missed").
4. Sleep briefly (metadata-commit + bootstrap settle).
5. Open SSE with `?token=…` → auth passes (metadata row exists) → `subscribed` event.
6. PUT new manifest content to live-lesson (simulating a GUI edit on the project).
7. POST `/projects/:id/invalidate?token=…` → ccaas re-syncs, diff finds the edit, publishes `updated` event.
8. Assert ≥1 `updated` event landed on SSE.

This proves the actual interesting end-to-end path (GUI edit → ccaas re-sync → SSE delivers change to subscriber) rather than the original "bootstrap fires events the subscriber happened to be listening to." Auth-aware and more representative of how a creator UI would consume changes.

The mint path shells out to `packages/backend/scripts/create-dev-api-key.ts <tenant-slug> --raw-only`. The smoke and the running ccaas backend must use the same SQLite file; both default to `packages/backend/.agent-workspace/data.db` (npm-workspace CWD convention). Set `CCAAS_DB_PATH=<absolute-path>` if your backend was started from a different CWD.

**Caveat (Phase 3 hardening)**: query-param tokens leak to access logs. Acceptable in single-tenant dev / prod-with-trusted-network. For true multi-tenant prod, a short-lived exchange token (e.g. `POST /sessions/exchange`) is the right hardening — out of scope here.

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
