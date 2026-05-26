# `@kedge-agentic/agent-runtime` 包参考

> 框架无关的 ccaas agentic runtime 包。当前版本 v0.3（Phase 1）。
> **2026-05 改名提示**：本包此前叫 `@kedge-agentic/agentfs-runtime`（v0.1），当时只有 workspace 一层。改名后承载 workspace + project + artifact + schema + sync 五个子模块。

## 当前阶段状态

| 阶段 | 子模块 | 状态 |
|---|---|---|
| A | `workspace/` — BaseMaterializer + ContentSource + Logger | ✅ shipped |
| 0 | `artifact/` — types + `JsonEditProvider` | ✅ shipped |
| 0 | `project/` `schema/` `sync/` — 接口骨架 | ✅ shipped |
| **1** | **`artifact/ProjectArtifactSource` + `sync/SyncEngine` + `sync/InMemoryChangeStream` + `sync/SnapshotStore`** | **✅ shipped（本版本）** |
| **1 (backend)** | **`SessionAssetSyncer` + `RestWorkspaceArtifactSource` + `/workspaces/:id/{changes,invalidate}` REST + `attachWorkspaceSource` 钩子** | **✅ shipped（packages/backend）** |
| 2 | Redis-backed ChangeStream（跨进程 fan-out）；BinaryArtifactSource；MarkdownArtifactEditor | ⏳ 之后 |
| 3 | live-lesson 完全迁移到新抽象上 | ⏳ 最后 |

设计推导完整版：`docs/AGENT_RUNTIME_DESIGN.md`。

## 导入路径

根路径 re-export 整包：

```ts
import {
  // workspace
  BaseMaterializer, ContentSource, Logger, noopLogger,
  // artifact
  JsonEditProvider, Artifact, ArtifactEditor, EditOperation, EditResult,
  // project
  Project, ProjectStore,
  // schema
  SchemaValidator, SchemaRegistry,
  // sync
  ChangeStream, ChangeEvent,
} from '@kedge-agentic/agent-runtime';
```

子路径导入（需要 tsconfig 里 `moduleResolution: node16 | nodenext | bundler`）：

```ts
import { BaseMaterializer } from '@kedge-agentic/agent-runtime/workspace';
import { JsonEditProvider } from '@kedge-agentic/agent-runtime/artifact';
import type { Project } from '@kedge-agentic/agent-runtime/project';
```

`testing/` 子路径单独暴露 `InMemoryContentSource` 给测试用。

## `workspace/`

```ts
interface ContentSource {
  listActiveSkills(): Promise<ReadonlyArray<SkillContent>>;
  listActiveMcpServers(): Promise<ReadonlyArray<McpServerContent>>;
}

class BaseMaterializer {
  constructor(source: ContentSource, baseDir: string, logger?: Logger);
  getBaseDir(): string;
  materialize(): Promise<MaterializeResult>;
}
```

把 skills + MCP servers 从一个 `ContentSource`（你实现的存储适配器）投影到磁盘目录，给 agentfs 的 `--base` overlay 用。详见 [Runtime 架构](../platform/runtime-architecture.md) § 4.1。

ccaas backend 的 TypeORM 适配器：`packages/backend/src/sessions/workspace/typeorm-skill-content-source.ts`。

## `artifact/`

**Phase 0 已交付：`JsonEditProvider`** —— 编辑 JSON artifact 的具体实现。

```ts
interface Artifact<TContent = unknown> {
  id: string;
  projectId: string;
  path: string;                      // 项目内的相对路径
  type: 'markdown' | 'json' | 'binary' | string;
  content: TContent;
  attributes: Readonly<Record<string, unknown>>;
  schemaId?: string;                  // 触发 SchemaRegistry 校验
  updatedAt: string;
}

type EditOperation =
  | { op: 'field_set'; path: string; value: unknown }            // JSON Pointer
  | { op: 'json_patch'; ops: ReadonlyArray<unknown> }             // RFC 6902
  | { op: 'str_replace'; old_string: string; new_string: string } // for markdown editor
  | { op: 'replace'; content: unknown };

interface ArtifactEditor<TContent = unknown> {
  serialize(artifact: Artifact<TContent>): string;
  edit(artifact: Artifact<TContent>, ops: ReadonlyArray<EditOperation>): Promise<EditResult<TContent>>;
}
```

### JsonEditProvider 用法

```ts
import { JsonEditProvider } from '@kedge-agentic/agent-runtime';
import { z } from 'zod';

const ManifestSchema = z.object({ /* ... */ });
const validator = {
  validate: (v: unknown) => {
    const r = ManifestSchema.safeParse(v);
    return r.success ? { ok: true, value: r.data } : { ok: false, error: r.error.message };
  },
};

const editor = new JsonEditProvider({ validator });

const result = await editor.edit(artifact, [
  { op: 'field_set', path: '/lessons/0/title', value: '改后标题' },
  { op: 'json_patch', ops: [{ op: 'remove', path: '/draft' }] },
]);

if (result.success) {
  await artifactStore.save(result.artifact!);
} else {
  console.error('edit failed:', result.error);
  // input 不会被改 —— 原子性保证
}
```

**支持的 op**：
- `field_set` — RFC 6901 JSON Pointer，缺中间节点会自动创建为对象
- `json_patch` — RFC 6902 add / remove / replace 子集
- `replace` — 整个 content 替换

**不支持**：`str_replace`（那是 markdown editor 的事）；`copy` / `move` / `test`（未来需要再加）

**Schema 校验**：可选 `validator` 参数。校验在所有 op 应用完之后做，失败时返回 `success:false`，**input 不被改动**（原子性）。

### 未来 editor（Phase 1）

- `MarkdownArtifactEditor` —— 包装 `@kedge-agentic/context-layer` 的 `DocumentEditProvider`，让 markdown artifact 也走统一接口
- `BinaryEditor` —— 二进制 blob 整体替换，对接对象存储 adapter

## `project/`（Phase 0 接口骨架）

```ts
interface Project {
  id: string;
  solutionId: string;
  title: string;
  description?: string;
  status: 'draft' | 'active' | 'archived';
  attributes: Readonly<Record<string, unknown>>;  // 业务自由扩展
  createdAt: string;
  updatedAt: string;
}

interface ProjectStore {
  load(projectId: string): Promise<Project | null>;
  list(solutionId: string, opts?: ProjectListOptions): Promise<ReadonlyArray<Project>>;
  save(project: Project): Promise<void>;
  delete(projectId: string): Promise<void>;
}
```

**Phase 0 只有接口，没有实现**。Phase 1 会给 ccaas backend 写一个 TypeORM 实现；solution 也可以写自己的。

主要驱动用例：live-lesson 的 `CourseProject` 当前是 bespoke 实现，参见 [项目模式目录](../../../docs/PROJECT_PATTERN_CATALOG.md)。

## `schema/`（Phase 0 接口骨架）

```ts
interface SchemaValidator<T = unknown> {
  validate(value: unknown): { ok: true; value: T } | { ok: false; error: string };
}

interface SchemaRegistry {
  register(schemaId: string, validator: SchemaValidator): void;
  get(schemaId: string): SchemaValidator | undefined;
  validate(schemaId: string, value: unknown): ValidationResult;
}
```

Schema 库无关 —— Zod、JSON Schema、TypeBox 任意一种都能写成 `SchemaValidator` 适配器。

Phase 1 会附带一个 Zod adapter。

## Phase 1 —— 双向同步（pull-based）

**核心交付**：solution backend 照常用 REST 写自己的 DB（任何方式都行：TypeORM、原始 SQL、批处理），runtime 在 agent **每轮结束的空闲窗口** 自动把变化拉到 agent 工作区的 `artifacts/` 目录；agent 修改的文件在下一轮空闲时反向写回 DB。**Solution 代码完全不变**——只需要实现一个 ~30 行的接口或暴露 3 个 REST endpoint。

### 设计中心：`ProjectArtifactSource`

```ts
import type { ProjectArtifactSource, ArtifactSnapshot } from '@kedge-agentic/agent-runtime';

export interface ArtifactSnapshot {
  readonly path: string;       // workspace 相对路径，如 'lesson-plan.md'
  readonly content: string;
  readonly type: string;       // 'md' | 'json' | solution 自定义
  readonly attributes?: Readonly<Record<string, unknown>>;
}

export interface ProjectArtifactSource {
  loadArtifacts(projectId: string): Promise<ReadonlyArray<ArtifactSnapshot>>;
  saveArtifact(projectId: string, artifact: ArtifactSnapshot): Promise<void>;
  deleteArtifact?(projectId: string, path: string): Promise<void>;
}
```

Solution 实现这一个接口，runtime 负责其余的全部：snapshot diff、conflict 解决、agent 工作区写盘、change event 广播。

### 冲突解决（已锁定）

按路径 P 的 4 格真值表：

| dbChanged | fsChanged | 处理 |
|---|---|---|
| no | no | no-op |
| yes | no | DB 内容 → 写到 fs（gui 编辑） |
| no | yes | 从 fs 读 → saveArtifact 写 DB（agent 编辑） |
| yes | yes | **agent 赢**：保存 agent 版本到 DB；发 `conflict_agent_wins` ChangeEvent，附带被丢弃的 DB 版本给 GUI 提示 |

无时间戳、无时钟比较——正确性来自 turn-bounded snapshot diff 的不变量。

### `SyncEngine.plan()` — 纯逻辑

```ts
import { SyncEngine, type SyncPlan, type FsDelta } from '@kedge-agentic/agent-runtime';

const plan: SyncPlan = new SyncEngine().plan({
  sessionId, dbNow, fsDelta, previousSnapshot, now: new Date().toISOString(),
  hasher: (s) => createHash('sha256').update(s).digest('hex'),
});
// plan.actions: SyncAction[] — write_fs / delete_fs / save_db / delete_db / conflict_agent_wins
// plan.nextSnapshot: SnapshotEntry[] — 写完之后该把 SnapshotStore 切到这个状态
```

纯函数、无 I/O —— 适合在自动化测试里穷举 4 格 conflict matrix。

### `InMemoryChangeStream`

`ChangeStream` 接口的单进程默认实现。Per-projectId fan-out + microtask scheduling（一个 listener 抛错不会影响兄弟 listener，unsubscribe-during-dispatch 也安全）。Phase 2 会出 Redis 版做跨进程。

### `SnapshotStore`

```ts
interface SnapshotStore {
  list(sessionId: string): Promise<ReadonlyArray<SnapshotEntry>>;
  put(entry: SnapshotEntry): Promise<void>;
  remove(sessionId: string, path: string): Promise<void>;
  clear(sessionId: string): Promise<void>;
}
```

Runtime 自带 `InMemorySnapshotStore` 给测试用；backend 提供 TypeORM-backed 实现（`SessionArtifactSnapshot` entity），存的是 `(sessionId, path) → sha256(content)`，~64 字节/行。重启后 syncer 能恢复 diff 的不变量。

## backend wiring（packages/backend 私有但解释下流程）

### `SessionAssetSyncer`（orchestrator）

`@OnEvent('session.turn.complete')` —— 在 `CliProcessService` 的 cli 退出钩子上挂着。每个 turn 边界：

1. 从 `session_metadata['projectId']` 拿到绑定的 projectId（无绑定 → no-op）
2. 并行拉 `(source.loadArtifacts, /fs/diff, snapshotStore.list)`
3. `SyncEngine.plan()` 生成动作列表
4. 应用动作：写文件到 mount（Spike 0 已验证 idle 窗口下 host fs.writeFile 通过 FUSE 是安全的）、调 source.saveArtifact、删两边
5. 替换 snapshot
6. 发 ChangeEvent

`@OnEvent('session.bound')` —— 在 `SessionService.attachWorkspaceSource()` 调用时触发（旧别名 `bindToProject` 也是一样），跑同一个 `sync()` 方法。空 snapshot ⇒ 把整套 artifact 初始化进工作区。

### `RestWorkspaceArtifactSource`（跨进程 adapter）

适用于 solution backend 跟 ccaas 是**独立进程**的场景（如 live-lesson 在 :3007、ccaas 在 :3001）。Solution 暴露 3 个 REST endpoint：

```
GET  {base}/projects/:projectId/artifacts
     → [{ path, content, type, attributes? }]

PUT  {base}/projects/:projectId/artifacts?path=<encoded>
     body { content, type, attributes? }   # upsert
     response (JSON, optional but recommended): { path: <canonical>, ... }
     ↑ 如果 solution 在 server 端 normalize 了 path（posix.normalize / case-fold / 去前导 slash 等），
       MUST 在 response 里返回 canonical path —— 否则 runtime snapshot 记录的是 SENT path，
       下一轮 loadArtifacts 拿到 canonical path，engine 会把两者当成两个文件，
       对老的 sent-path 条目计划一个错误的 delete_fs（Phase 1 review M1）。

DELETE {base}/projects/:projectId/artifacts?path=<encoded>
     # idempotent — 404 视作已删除
```

**Solution 注册（v0.3.2 起）**：baseUrl 不再走 env var，而是存在 `solution.config.artifactUrl` 里 —— 跟 `webhookUrl` / `customSystemPrompt` 一样，是 solution 配置的一个字段。两种填法：

### 方式 A：solution.json + 自动发现（推荐，dev 零密钥）

每个 solution 在源码里放一个 `solution.json`：

```jsonc
{
  "schemaVersion": "3.0",
  "solution": { "name": "Live Lesson", "slug": "live-lesson" },
  "artifactUrl": "http://localhost:3007/api",
  "skills": ["./skills/*"]
}
```

后端 `.env` 设置 `SOLUTIONS_DIR`：

```bash
SOLUTIONS_DIR=./solutions/business
```

启动时 `SolutionLoaderService.onModuleInit` 会自动扫描 `SOLUTIONS_DIR/*/solution.json`，调 `solutions.update()` 把 `artifactUrl` 写到 `solution.config`。零 curl，零 admin key，零 env var for URL。

### 方式 B：REST 注册（prod / 运行时变更）

```bash
# 1. 拿到 admin key（启动时自动打印，或 POST /auth/login）
# 2. 创建/找到 solution
# 3. 把 artifactUrl 写到它的 config
curl -X PUT $CCAAS/api/v1/solutions/$ID \
  -H "x-api-key: $K" \
  -d '{"config":{"artifactUrl":"https://prod.example.com/api"}}'
```

`PUT /solutions/:id` 是 partial-merge —— 其他 config key（`webhookUrl` 等）不受影响。

### 运行时更新

`solutions.update()` 在 `config` 改动时会发 `solution.config.changed` 事件；`ProjectArtifactSourceRegistry` 订阅后清除该 slug 的缓存。下一轮 sync 就会读到新的 `artifactUrl`，**不用重启 backend**。

### REST endpoints（GUI 用的）

```
# canonical（β-3 起，2026-05-26）
GET   /workspaces/:identity/changes     # SSE — 监听 ChangeEvent
POST  /workspaces/:identity/invalidate  # 提前请求一次 sync（可选优化）

# deprecated alias —— 保留一个 release 给 solution 迁移
GET   /projects/:identity/changes
POST  /projects/:identity/invalidate
```

这些 endpoint **挂在 bare namespace**（不在 `/api/v1/` 下面）—— 跟 `sessions` controller 不同。代码见 `packages/backend/src/sessions/agent-runtime/workspace-changes.controller.ts:@Controller()`（用 route array 同时支持两套 URL）。

### 认证（Phase 2b-2）

两个 endpoint（canonical + alias）都需要 `?token=<apiKey>` query param：

```
GET   /workspaces/:identity/changes?token=ccaas_xxxx
POST  /workspaces/:identity/invalidate?token=ccaas_xxxx
```

为什么是 query param 而不是 `Authorization` header？因为浏览器的 `EventSource` 不支持自定义 header —— 这是 W3C 规范限制，不是 ccaas 实现的选择。

校验链：

1. `ApiKeyService.validateKey(token)` 解出 caller 的 solution
2. `ProjectTenantResolver.resolveTenant(projectId)` 查出 project 归属的 solution
3. 两者必须一致，否则 403；resolver 返回 null（project 未知 / 无 resolver 注册）也是 403；token 缺失或无效是 401

**`ProjectTenantResolver` port**：solution 可以注册自己的 resolver（比如查自己的 project 表）。如果不注册，agent-runtime 默认走 `DenyAllProjectTenantResolver` —— 所有请求都 403。

**ccaas 默认 resolver（`SessionMetadataWorkspaceResolver`）**：跟原始 2b-2 设计不同，ccaas 不要求每个 solution 都注册 resolver。它复用 `attach-workspace-source`（以及它的 `bind-project` 别名）流程已经写到 `session_metadata` 表里的 `(solutionId, projectId)` 关系 —— 一次索引化 SQLite 查询就够了，零 solution 改动。`session_metadata` 里的 row name `projectId` 是 β-2 之前数据的 compat 命名；存的是新的 `sourceIdentity` 值。

- ✅ pro：solution 端不需要加 `solutionId` column / 不需要写新 endpoint / 不需要跨进程回调
- ⚠️ trade-off：**从未被 bind-project 过的 project 解析为 null → 403**。caller 必须先 bind 一个 session，才能订阅 SSE。这跟 bind-project 是 SSE 消费的前置步骤这一现实是一致的（poc-smoke.sh 就是这个顺序）。

要换 resolver 的话，在 SessionsModule 里覆盖 `PROJECT_TENANT_RESOLVER` token 即可。

**安全注意**：query-param token **会泄露到 access log / proxy log**。在 single-solution dev / prod-with-trusted-network 是可接受的；真正的 multi-solution 生产环境应该用短期 exchange token（例如 `POST /sessions/exchange` 换一次性 SSE token），这是 Phase 3 hardening，目前不在范围内。

### 二进制 artifact（Phase 2b-4）

文本 artifact 走 `ProjectArtifactSource`（content 是 `string`）；图片 / 音频 / PDF 走单独的 `BinaryArtifactSource`（content 是 `Buffer | Uint8Array`）。**两个 port 是独立的** —— 仅文本的 solution 不需要实现 binary port，反之亦然。

为什么独立？

- content 类型不同（string vs Buffer）—— 混在一个 port 里会让每个 consumer 的类型故事都变复杂
- REST 传输不同 —— 文本是 `application/json`（content inline），binary 是 `application/octet-stream`（streaming via `node:stream/pipeline`，never buffered）
- 文件系统挂载点不同 —— 文本在 `<workspace>/artifacts/`，binary 在 `<workspace>/artifacts-binary/`。**这个分离是关键 security 边界**：agent 的 `Read` / `cat` 工具只能扫文本目录，永远不会把一张 JPEG slurp 进 context

ccaas 端注册：solution 在 `solution.config.binaryArtifactUrl` 设置 binary endpoint URL（独立于 `artifactUrl`）。`ProjectBinaryArtifactSourceRegistry` 同样懒加载 + `solution.config.changed` 失效。可选 `solution.config.binaryMaxBytes` 设置 per-solution 大小上限。

Solution 端实现的 REST endpoints：

```
GET    {base}/projects/:projectId/binary-artifacts
     # 200: [{ path, type, sizeBytes, contentHash?, attributes? }]
     # 注意：只返回 metadata，不返回 bytes —— full read 每轮太贵
     # 如果带 contentHash，runtime 用它直接对比 snapshot；否则
     # runtime 会调下面那个 endpoint fetch+hash 一次

GET    {base}/projects/:projectId/binary-artifacts?path=<encoded>
     # 200 application/octet-stream + Content-Length + X-Artifact-Type
     # 流式下载；ccaas 端用 stream.pipeline 消费，超过 maxBytes 会
     # 在 drain 之前 abort

PUT    {base}/projects/:projectId/binary-artifacts?path=<encoded>&type=<encoded>
     # body: application/octet-stream
     # 200（idempotent）；可选返回 JSON {path} 做 path canonicalization
     # 跟文本一样（Phase 2b-1）

DELETE {base}/projects/:projectId/binary-artifacts?path=<encoded>
     # 200（idempotent；404 视作已删除）
```

**Sync 行为**：

- 同样的 conflict matrix：agent 写 → save_db_binary；GUI 写 → write_fs_binary_from_listing（fetch on demand）；双写 → agent 赢 + `conflict_agent_wins_binary` event
- 同一份 `SnapshotStore`，binary 条目带 `artifacts-binary/` 前缀以避免和文本 path collision
- 同一个 `ChangeStream`，binary event 带 `actor: 'binary'`（或 `actor: 'binary-conflict-agent-wins'`），path 是 binary mount-relative（不带前缀），让 GUI 可以路由到 binary fetch endpoint
- 同一个 `projectId` mutex —— text 和 binary half 串行执行，避免 race

**未做（Phase 2c 或更晚）**：

- 任何 in-tree solution 都还没实现 binary REST endpoints。Runtime 这一侧完整且 unit-tested，但 end-to-end 跑通要等真有 binary use case 出现
- Agent 工具的 explicit deny rule（比如显式禁止 `Read` 访问 `artifacts-binary/*`）。今天靠目录分离 + 命名约定就够；显式 deny 是 hardening item
- 流式上传（PUT 现在用 Blob 包 Buffer）—— 真要传 >100MB 的话再换 stream wrapper

### Solution 集成两行

> **β-1 重命名（2026-05-26）**：新规范叫 `attach-workspace-source`，body 用通用字段 `{ sourceUrl, sourceIdentity, solutionId }`（不再有 `projectId` —— ccaas 不再假装知道 "project" 是什么）。旧的 `bind-project` 路由保留为 alias 一个 release，内部走同一份逻辑。新 solution 直接用新路由；旧 solution 在迁移窗口内不用动。

```ts
// solution backend：在创建 workspace-attached agent session 后立刻调
await fetch(`${CCAAS_URL}/api/v1/sessions/${sessionId}/attach-workspace-source`, {
  method: 'POST',
  body: JSON.stringify({
    sourceUrl: 'http://your-solution/api/projects',  // ccaas 回调的 base URL
    sourceIdentity: projectId,                        // 对 ccaas 不透明的 ID
    solutionId,                                         // β 阶段过渡：sessionService 还需要
  }),
});

// 或继续用旧路由（compat 窗口内）：
await fetch(`${CCAAS_URL}/api/v1/sessions/${sessionId}/bind-project`, {
  method: 'POST', body: JSON.stringify({ projectId, solutionId }),
});
```

后端 `SessionService.attachWorkspaceSource(sessionId, solutionId, { sourceIdentity, sourceUrl?, sourceSchemaHash? })` 写 metadata + emit `session.bound` → 触发 bootstrap → 第一轮 agent 看到的就是 DB 当前状态。废弃别名 `bindToProject(sessionId, solutionId, projectId)` 内部 delegate 到这里，传入 `{ sourceIdentity: projectId }`。

### GUI 端：消费 SSE 让用户能看到 agent 改动（Phase 2a）

后端 `/workspaces/:identity/changes` SSE 会把所有 ChangeEvent 发出来（旧别名 `/projects/:identity/changes` 也通）。前端订阅这个流就能在 user 编辑同一个 project 时实时显示「agent 改了 lesson-plan.md」的横幅。

**关键设计原则**：浏览器**永远不持有 ccaas key**。原因是 ccaas 只认 solution，而每个 solution 后端就是一个 solution —— ccaas key 是 solution 后端的，不是终端用户的。终端用户走 solution 自己的鉴权（cookie / session / JWT / 任何 solution 自己的方案），solution 后端代理所有 ccaas 调用。

具体到 SSE：

```
[browser]
  → GET /api/projects/:id/changes              # 相对路径，走 solution 后端
[solution backend (live-lesson :3007)]
  → 验证终端用户身份（solution 自己的逻辑）
  → 验证该用户能访问这个 project
  → opens upstream EventSource:
      GET ${CCAAS_URL}/workspaces/:id/changes?token=${CCAAS_API_KEY}
[ccaas (:3001)]
  → WorkspaceAccessGuard 验证 token + solution 拥有 workspace
  → SSE stream
```

solution 后端的代理实现见 `solutions/business/live-lesson/backend/src/adapters/http/ccaas-proxy.controller.ts`。env 变量：
- `CCAAS_URL`（默认 `http://localhost:3001`）—— ccaas 的 base URL
- `CCAAS_API_KEY`（必填）—— solution solution 的 ccaas API key

参考浏览器侧实现：`solutions/business/live-lesson/creator/src/hooks/useProjectChanges.ts` —— React hook，内部用 `EventSource` 订阅相对路径，过滤掉 heartbeat / subscribed / 自己的 gui 写入，把剩下的 agent 事件返回给 UI：

```tsx
import { useProjectChanges } from './hooks/useProjectChanges';

function ProjectEditorPage({ projectId }) {
  // 浏览器侧零 ccaas key。hook 内部 fetch 的是 `/api/projects/:id/changes`，
  // 由 solution 后端代理到 ccaas。
  const { events, isConnected, error } = useProjectChanges(projectId);
  // events 里只剩下 source==='agent' 的 changes；包括 actor==='conflict-agent-wins'
  return <ProjectChangeNotice events={events} ... />;
}
```

`ProjectChangeNotice` 组件按 actor / kind 着色（红 = conflict-agent-wins，黄 = updated，橙 = deleted）+ 提供 [Reload]/[Dismiss] 按钮。Reload 不会自动跑 —— user 必须显式点，避免覆盖 user 未保存的改动。

URL 路由：creator app 用相对路径 `/api/projects/...`，Vite proxy 把 `/api/*` 转给 solution backend :3007；solution backend 再代理到 ccaas :3001。生产环境用 nginx / Caddy 等反向代理实现同样的路由。

## 旧的 `sync/`（Phase 0 接口骨架，仍然存在）

```ts
interface ChangeEvent {
  projectId: string;
  path: string;
  source: 'agent' | 'gui' | 'system';
  kind: 'created' | 'updated' | 'deleted';
  at: string;
  actor?: string;
}

interface ChangeStream {
  subscribe(projectId: string, listener: (ev: ChangeEvent) => void): () => void;
  publish(event: ChangeEvent): void;
}
```

Phase 1 的 `InMemoryChangeStream` 实现了上面这个接口。Phase 2 的 Redis 版本会替换实现、不动接口。

## `testing/`

```ts
import { InMemoryContentSource } from '@kedge-agentic/agent-runtime/testing';

const src = new InMemoryContentSource([
  { id: 's1', solutionId: 't1', slug: 'hello', name: 'Hello', content: '# H', files: [] },
]);
const m = new BaseMaterializer(src, '/tmp/test-base');
await m.materialize();
```

供下游 adapter 单测使用。

## 看完后

- 想了解整套设计意图：`docs/AGENT_RUNTIME_DESIGN.md`
- 想看 live-lesson 当前的 bespoke 实现：`docs/PROJECT_PATTERN_CATALOG.md`
- 想用 workspace 抽象写一个自己的 solution：[Solution 用 runtime 新能力](../guide/extending-runtime.md)
- 包源码：`packages/agent-runtime/`
