# `@kedge-agentic/agent-runtime` 包参考

> 框架无关的 ccaas agentic runtime 包。当前版本 v0.2（Phase 0）。
> **2026-05 改名提示**：本包此前叫 `@kedge-agentic/agentfs-runtime`（v0.1），当时只有 workspace 一层。改名后承载 workspace + project + artifact + schema + sync 五个子模块。

## 当前阶段状态

| 阶段 | 子模块 | 状态 |
|---|---|---|
| A | `workspace/` — BaseMaterializer + ContentSource + Logger | ✅ shipped（即 v0.1 的全部） |
| 0 | `artifact/` — types + `JsonEditProvider` | ✅ shipped（本版本） |
| 0 | `project/` `schema/` `sync/` — 接口骨架 | ✅ shipped（只有 interface，没有实现） |
| 1 | TypeORM `ProjectStore` + `ArtifactStore`；Zod schema adapter；`MarkdownArtifactEditor` | ⏳ 下一步 |
| 2 | ChangeStream impl（in-memory → Redis） | ⏳ 之后 |
| 3 | live-lesson 迁移到新抽象上 | ⏳ 最后 |

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

## `sync/`（Phase 0 接口骨架）

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

agent ↔ GUI 双向更新流。Phase 2 会先出 in-memory pub/sub，再出 Redis 版。冲突解决策略当前**未定**（设计文档里列了几个候选）。

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
