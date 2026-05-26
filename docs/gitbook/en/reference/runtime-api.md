# Runtime REST API (fs + metadata)

> Once an agent session is spawned in the ccaas backend, **8 endpoints** let operators and solutions observe / modify what the agent did in the sandbox: 4 fs ops (diff/timeline/snapshot/rollback), 4 metadata KV ops. This page is spec + curl + 4xx semantics.

## Auth + path prefix

All endpoints live under `/api/v1/sessions/:id/`, gated by `Auth('admin')` + `SolutionAuthGuard` (stage-1 simplification):

- header: `x-api-key: <admin-key>`
- header: `x-solution-id: <slug-or-uuid>` (admin keys can cross-solution; mismatch → 403)

Stage-2 will introduce finer `sessions:fs` / `sessions:meta` scopes; today's admin scope is cross-solution by design.

## Session must be active

All endpoints look up the in-memory `SessionService.getSession(sessionId)`. Once a session closes, it's removed from the map → 404. Querying **closed sessions** forensically is on the backlog (requires re-mounting the agentfs delta).

---

## FS endpoints — agentfs only

Under local provider, all return 400 with the message: `fs.<op> requires WORKSPACE_PROVIDER=agentfs (current provider does not expose '<op>' on its workspace handle)`.

### `GET /api/v1/sessions/:id/fs/diff`

List the files the agent changed in the sandbox relative to the base.

**Response**:
```json
[
  { "op": "added",    "type": "file",      "path": "/_scratch/notes.md" },
  { "op": "modified", "type": "file",      "path": "/entities/customers/initech.md" },
  { "op": "removed",  "type": "directory", "path": "/old/" }
]
```

**Implementation**: cp the agentfs SQLite delta + WAL files to a tmpdir → `agentfs diff <copy>` → parse output → cleanup. **Eventually consistent** (no daemon lock). Worst case: `agentfs diff` errors or returns empty; retry. A fully-consistent backup-API variant is on the backlog.

**Curl**:
```bash
curl -s "http://localhost:3001/api/v1/sessions/demo-1/fs/diff" \
  -H 'x-api-key: sk-...' -H 'x-solution-id: demo-sandbox' \
  | python3 -m json.tool
```

### `GET /api/v1/sessions/:id/fs/timeline?limit=&filter=&status=`

Time-ordered list of tool-call events the agent emitted in the sandbox (agentfs's built-in audit log).

**Query params**:
- `limit` 1–1000 (silently clamped to 1000 if higher)
- `filter` tool name (charset `^[\w./*-]{1,256}$`)
- `status` `pending` | `success` | `error`

**Response** (array, each a `ToolCall`):
```json
[
  {
    "id": 12,
    "name": "writefile",
    "parameters": { "path": "/entities/...", "size": 234 },
    "status": "success",
    "started_at": 1779712345000,
    "completed_at": 1779712345004,
    "duration_ms": 4
  }
]
```

### `POST /api/v1/sessions/:id/fs/snapshot`

Checkpoint the current delta state under a given label.

**Body**: `{ "label": "before-risky-step" }` (charset `^[\w.-]{1,64}$`)
**Response**: `{ "label": "before-risky-step", "takenAt": "2026-05-25T11:23:45.678Z" }`
**Implementation**: stop daemon → cp WAL set → restart daemon. **~300ms blocking**; agent file handles will EIO during the cycle.

**409 ConflictException** when `session.status === 'processing'` (mid-turn): cycling the mount mid-turn yanks file handles. Cancel the current turn first or wait for `status=idle`.

### `POST /api/v1/sessions/:id/fs/rollback`

Revert to a previously-taken snapshot.

**Body**: `{ "label": "before-risky-step" }`
**Response**: 204 No Content
**Also 409 mid-turn**. Unknown label → 400.

---

## Metadata KV endpoints — provider-agnostic

Backed by the backend's own SQLite table `session_metadata` (**not** agentfs's KvStore — see [[sandbox-mount-vs-sdk]] for why). Provider-agnostic; storage is independent of session workspace lifecycle.

### Caps

- key `^[A-Za-z0-9_.-]{1,200}$`
- 64 KB per value (after JSON.stringify)
- 256 KB total per session (across all keys)

Exceeding either cap returns 413 PayloadTooLargeException.

### `GET /api/v1/sessions/:id/meta`

List all KV rows for the session.
**Response**: `[{ "key", "value", "updatedAt" }, ...]`

### `GET /api/v1/sessions/:id/meta/:key`

Single-key read.
**Response**: `{ "key", "value", "updatedAt" }`; key missing → 404.
`value` is JSON-parsed (any JSON value: object, array, primitive).

### `PUT /api/v1/sessions/:id/meta/:key`

Upsert.
**Body**: `{ "value": <any JSON value> }`
**Response**: same shape as GET.

`value` is JSON.stringify'd before storage; size cap is on the stringified byte length. **Shrinking** an existing key (writing a smaller value) is not falsely rejected by the total cap — the service computes "other keys' bytes + new value", excluding the key being upserted.

### `DELETE /api/v1/sessions/:id/meta/:key`

**Response**: 204 No Content; key missing → 404.

---

## Unified error response shape

All 4xx/5xx responses use this shape (NestJS global exception filter):

```json
{
  "code": "VALIDATION_ERROR" | "NOT_FOUND" | "FORBIDDEN" | ...,
  "message": "<human-readable>",
  "statusCode": 400,
  "recoverable": false,
  "retryable": false,
  "timestamp": "2026-05-25T...",
  "path": "/api/v1/sessions/.../fs/diff",
  "requestId": "req_..."
}
```

---

## A full snapshot + rollback round-trip

```bash
KEY=sk-...
TENANT=demo-sandbox
SID=demo-1
HDR=(-H "x-api-key: $KEY" -H "x-solution-id: $TENANT" -H 'Content-Type: application/json')

# 1. Session hasn't changed anything in base yet
curl -s "http://localhost:3001/api/v1/sessions/$SID/fs/diff" "${HDR[@]}"
# → [...some .claude/ + entities/ seed files]

# 2. checkpoint before
curl -X POST "http://localhost:3001/api/v1/sessions/$SID/fs/snapshot" "${HDR[@]}" \
  -d '{"label":"before-risky"}'
# → { "label": "before-risky", "takenAt": "..." }

# 3. ...let the agent run some file-modifying prompt...

# 4. See what changed
curl -s "http://localhost:3001/api/v1/sessions/$SID/fs/diff" "${HDR[@]}"
# → new entries appear

# 5. rollback
curl -X POST "http://localhost:3001/api/v1/sessions/$SID/fs/rollback" "${HDR[@]}" \
  -d '{"label":"before-risky"}'
# → 204

# 6. diff should be back to step 1's state
```

## A metadata workflow example (solution-side state machine)

```bash
SID=demo-1
KEY=sk-...

# initial: step 1
curl -X PUT "http://localhost:3001/api/v1/sessions/$SID/meta/workflow.step" \
  "${HDR[@]}" -d '{"value":{"current":1,"total":7}}'

# after the agent finishes a step
curl -X PUT "http://localhost:3001/api/v1/sessions/$SID/meta/workflow.step" \
  "${HDR[@]}" -d '{"value":{"current":2,"total":7}}'

# solution frontend polls periodically
curl -s "http://localhost:3001/api/v1/sessions/$SID/meta/workflow.step" "${HDR[@]}"
# → { "key": "workflow.step", "value": { "current": 2, "total": 7 }, "updatedAt": "..." }
```

## See also

- `platform/runtime-architecture.md` § 5 — where these endpoints sit in the overall runtime
- `guide/extending-runtime.md` — how solutions wire these up (snapshot around risky prompts, KV for workflow state)
- Source: `packages/backend/src/sessions/{session-fs.controller.ts, session-metadata.controller.ts}`
