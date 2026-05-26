# Runtime REST API（fs + metadata）

> 在 ccaas backend 上 spawn agent 后，**8 个 endpoint** 让运营和 solution 看见 / 修改 agent 在 sandbox 里的状态：4 个 fs（diff/timeline/snapshot/rollback），4 个 metadata KV。本页是 spec + curl + 4xx 语义。

## 鉴权 + 路径前缀

所有 endpoint 都在 `/api/v1/sessions/:id/` 下，都用 `Auth('admin')` + `SolutionAuthGuard`（stage-1 简化）：

- header: `x-api-key: <admin-key>`
- header: `x-solution-id: <slug-or-uuid>`（admin key 可以跨租户；tenant 不匹配 session 时返回 403）

后续 stage-2 会引入更细的 `sessions:fs` / `sessions:meta` scope；当前 admin scope 是 cross-solution by design。

## Session 必须 active

所有 endpoint 都查内存中的 `SessionService.getSession(sessionId)`。session 关掉之后从内存 Map 移除 → 返回 404。如果你想看**已关 session** 的 forensic 数据，那是 backlog 项目（要重新 mount agentfs delta）。

---

## FS endpoints — agentfs 才有

local provider 时全部返回 400，message: `fs.<op> requires WORKSPACE_PROVIDER=agentfs (current provider does not expose '<op>' on its workspace handle)`。

### `GET /api/v1/sessions/:id/fs/diff`

列出 agent 在 sandbox 里相对 base 改了哪些文件。

**响应**：
```json
[
  { "op": "added",    "type": "file",      "path": "/_scratch/notes.md" },
  { "op": "modified", "type": "file",      "path": "/entities/customers/initech.md" },
  { "op": "removed",  "type": "directory", "path": "/old/" }
]
```

**实现**：cp agentfs SQLite delta + WAL 到 tmpdir → `agentfs diff <copy>` → 解析输出 → cleanup。一致性是**最终一致**（不锁 daemon）；最坏情况是 `agentfs diff` 报错或返回空，重试即可。完整一致性的 backup-API 方案在 backlog。

**Curl**：
```bash
curl -s "http://localhost:3001/api/v1/sessions/demo-1/fs/diff" \
  -H 'x-api-key: sk-...' -H 'x-solution-id: demo-sandbox' \
  | python3 -m json.tool
```

### `GET /api/v1/sessions/:id/fs/timeline?limit=&filter=&status=`

agent 在 sandbox 里做的所有 tool-call 的时序记录（agentfs 内置 audit log）。

**Query params**：
- `limit` 1–1000（超过 silently clamp 到 1000）
- `filter` 工具名（charset `^[\w./*-]{1,256}$`）
- `status` `pending` | `success` | `error`

**响应**（数组，每条是 `ToolCall`）：
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

Checkpoint 当前 delta 状态，给定 label。

**Body**：`{ "label": "before-risky-step" }`（charset `^[\w.-]{1,64}$`）
**响应**：`{ "label": "before-risky-step", "takenAt": "2026-05-25T11:23:45.678Z" }`
**实现**：停 daemon → cp WAL set → 启 daemon。**~300ms 阻塞**，期间 agent 文件句柄会 EIO。

**409 ConflictException** 如果 `session.status === 'processing'`（mid-turn）：cycling the mount mid-turn yanks file handles。先取消当前 turn 或等到 `status=idle`。

### `POST /api/v1/sessions/:id/fs/rollback`

回滚到先前 snapshot。

**Body**：`{ "label": "before-risky-step" }`
**响应**：204 No Content
**同样 409 on mid-turn**。Snapshot 不存在 → 400。

---

## Metadata KV endpoints — 任何 provider 都有

后端自己的 SQLite 表 `session_metadata`（**不**用 agentfs KvStore — 见 [[sandbox-mount-vs-sdk]] 解释 why）。Provider-agnostic，存储独立于 session workspace 生命周期。

### Caps

- key `^[A-Za-z0-9_.-]{1,200}$`
- 64 KB per value（JSON.stringify 后）
- 256 KB total per session（across all keys）

超 cap 返回 413 PayloadTooLargeException。

### `GET /api/v1/sessions/:id/meta`

列出当前 session 所有 KV row。
**响应**：`[{ "key", "value", "updatedAt" }, ...]`

### `GET /api/v1/sessions/:id/meta/:key`

单 key 读。
**响应**：`{ "key", "value", "updatedAt" }`，没有 → 404。
`value` 是 JSON.parse 过的（任何 JSON 值，包括对象/数组/原语）。

### `PUT /api/v1/sessions/:id/meta/:key`

上插或更新。
**Body**：`{ "value": <任何 JSON 值> }`
**响应**：同 GET 返回的 row。

`value` 被 JSON.stringify 后存。size cap 算的是 stringify 后的 byte 数。**Shrinking** 已有 key（写一个更小的 value）不会被 total cap 误拦截 — service 算的是「其他 keys 总和 + 新值」，excludes 当前 key 自己。

### `DELETE /api/v1/sessions/:id/meta/:key`

**响应**：204 No Content；key 不存在 → 404。

---

## 错误响应统一形状

所有 4xx/5xx 都是这个 shape（NestJS 全局 filter）：

```json
{
  "code": "VALIDATION_ERROR" | "NOT_FOUND" | "FORBIDDEN" | ...,
  "message": "<人话>",
  "statusCode": 400,
  "recoverable": false,
  "retryable": false,
  "timestamp": "2026-05-25T...",
  "path": "/api/v1/sessions/.../fs/diff",
  "requestId": "req_..."
}
```

---

## 一个完整的 snapshot + rollback round-trip

```bash
KEY=sk-...
TENANT=demo-sandbox
SID=demo-1
HDR=(-H "x-api-key: $KEY" -H "x-solution-id: $TENANT" -H 'Content-Type: application/json')

# 1. session 当前还没改任何 base 内容
curl -s "http://localhost:3001/api/v1/sessions/$SID/fs/diff" "${HDR[@]}"
# → [...一些 .claude/ + entities/ 等 seed 文件]

# 2. checkpoint before
curl -X POST "http://localhost:3001/api/v1/sessions/$SID/fs/snapshot" "${HDR[@]}" \
  -d '{"label":"before-risky"}'
# → { "label": "before-risky", "takenAt": "..." }

# 3. 让 agent 跑一些会改文件的 prompt …

# 4. 看改了什么
curl -s "http://localhost:3001/api/v1/sessions/$SID/fs/diff" "${HDR[@]}"
# → 新增了 some entries

# 5. rollback
curl -X POST "http://localhost:3001/api/v1/sessions/$SID/fs/rollback" "${HDR[@]}" \
  -d '{"label":"before-risky"}'
# → 204

# 6. diff 应该回到 step 1 的状态
```

## 一个 metadata workflow example（solution-side 状态机）

```bash
SID=demo-1
KEY=sk-...

# initial: 第 1 步
curl -X PUT "http://localhost:3001/api/v1/sessions/$SID/meta/workflow.step" \
  "${HDR[@]}" -d '{"value":{"current":1,"total":7}}'

# 某次 agent 完成一步后
curl -X PUT "http://localhost:3001/api/v1/sessions/$SID/meta/workflow.step" \
  "${HDR[@]}" -d '{"value":{"current":2,"total":7}}'

# solution 前端定期 poll
curl -s "http://localhost:3001/api/v1/sessions/$SID/meta/workflow.step" "${HDR[@]}"
# → { "key": "workflow.step", "value": { "current": 2, "total": 7 }, "updatedAt": "..." }
```

## See also

- `platform/runtime-architecture.md` § 5 — 这些 endpoint 在整个 runtime 里坐哪儿
- `guide/extending-runtime.md` — solution 端怎么把它们用起来（snapshot 包住「危险」prompt、metadata KV 存 workflow 状态等）
- 源码：`packages/backend/src/sessions/{session-fs.controller.ts, session-metadata.controller.ts}`
