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
| **1 (backend)** | **`SessionAssetSyncer` + `RestProjectArtifactSource` + `/projects/:id/{changes,invalidate}` REST + `bindToProject` 钩子** | **✅ shipped（packages/backend）** |
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
  tenantId: string;
  title: string;
  description?: string;
  status: 'draft' | 'active' | 'archived';
  attributes: Readonly<Record<string, unknown>>;  // 业务自由扩展
  createdAt: string;
  updatedAt: string;
}

interface ProjectStore {
  load(projectId: string): Promise<Project | null>;
  list(tenantId: string, opts?: ProjectListOptions): Promise<ReadonlyArray<Project>>;
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

`@OnEvent('session.bound')` —— 在 `SessionService.bindToProject()` 调用时触发，跑同一个 `sync()` 方法。空 snapshot ⇒ 把整套 artifact 初始化进工作区。

### `RestProjectArtifactSource`（跨进程 adapter）

适用于 solution backend 跟 ccaas 是**独立进程**的场景（如 live-lesson 在 :3007、ccaas 在 :3001）。Solution 暴露 3 个 REST endpoint：

```
GET  {base}/projects/:projectId/artifacts
     → [{ path, content, type, attributes? }]

PUT  {base}/projects/:projectId/artifacts?path=<encoded>
     body { content, type, attributes? }   # upsert

DELETE {base}/projects/:projectId/artifacts?path=<encoded>
     # idempotent — 404 视作已删除
```

ccaas 通过环境变量配置 baseUrl，`AgentRuntimeModule.forRoot()` 自动启用该 adapter。**两种配置形态**：

```bash
# 单 solution（v0.3 起兼容保留）
SOLUTION_ARTIFACT_URL=http://localhost:3007/api

# 多 solution（v0.3.1 起新增；跟 SOLUTION_DIRS 完全同构）
SOLUTION_ARTIFACT_URLS=live-lesson:http://localhost:3007/api,demo:http://localhost:3010/api
```

**解析优先级**（高 → 低）：

1. `AgentRuntimeModule.forRoot({ artifactSource: ... })` 显式注入（仅测试用）
2. `SOLUTION_ARTIFACT_URLS` 的 per-tenant 条目 —— 按 `session.tenantId → tenant.slug` 路由
3. `SOLUTION_ARTIFACT_URL` 作为 default fallback —— 任何 slug 没在 map 里的 tenant 走这里
4. 都没设 → 该 tenant 的 syncer no-op

两个 env var 可以同时存在：per-tenant map 管命名 tenant，单 URL 兜底其他人。跟 `packages/backend/CLAUDE.md` 里的 `SOLUTION_DIRS=slug:abspath,...` 是同一套 CSV 语法（`:` 之后的内容 —— URL 里的 `://` —— 不会被二次切割）。

### REST endpoints（GUI 用的）

```
GET   /api/v1/projects/:projectId/changes    # SSE — 监听 ChangeEvent
POST  /api/v1/projects/:projectId/invalidate # 提前请求一次 sync（可选优化）
```

### Solution 集成两行

```ts
// solution backend：在创建 project-scoped agent session 后立刻调
await fetch(`${CCAAS_URL}/api/v1/sessions/${sessionId}/bind-project`, {
  method: 'POST', body: JSON.stringify({ projectId }),
});

// 或者通过 SDK 直接：
sessionsClient.bindToProject(sessionId, projectId);
```

后端 `SessionService.bindToProject(sessionId, tenantId, projectId)` 写 metadata + emit `session.bound` → 触发 bootstrap → 第一轮 agent 看到的就是 DB 当前状态。

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
  { id: 's1', tenantId: 't1', slug: 'hello', name: 'Hello', content: '# H', files: [] },
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
