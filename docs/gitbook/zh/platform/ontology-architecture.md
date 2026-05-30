# Ontology 架构 / Ontology Architecture

> 平台层 Phase 3 — `@kedge-agentic/ontology` 接入 NestJS backend。
> Status: 🔵 first surface live; see `docs/ontology/PROGRESS.md` for phase status.

本文回答三个问题：

1. Phase 3 给平台加了哪些东西？(What landed)
2. 一个 Solution 如何把自己的 Action 接入新的桥？(How to register)
3. 我作为前端 / 运维如何消费 schema endpoint？(How to consume)

## 1. 接入了什么

```
┌─────────────────────────────────────────────────────────────┐
│ @kedge-agentic/ontology  (framework-free, v0.1)             │
│  ObjectTypeDef / ActionDef / ManifestDef / OntologyRegistry │
│  checkBoundary (pure)  /  serializeRegistry  /  digest      │
└────────────────────────┬────────────────────────────────────┘
                         │ Phase 3 bridges
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ packages/backend/src/ontology/                              │
│                                                              │
│  OntologyModule                                              │
│  ├─ OntologyController          GET /api/v1/ontology/schema │
│  ├─ ontology-registry.provider  singleton OntologyRegistry  │
│  ├─ action-to-tool-definition   ActionDef → ToolDefinition  │
│  ├─ manifest-accessor.service   NestJS-bound ManifestAccessor│
│  └─ live-lesson/                first consumer (4 types +   │
│                                  manifest + emit_todo_card) │
└─────────────────────────────────────────────────────────────┘
```

新东西，按职责拆：

| 模块 | 文件 | 作用 |
|---|---|---|
| Registry singleton | `ontology-registry.provider.ts` | DI token `ONTOLOGY_REGISTRY`。`OnModuleInit` 钩子里调 `registerObjectType` / `registerManifest`，最后 `seal()`，封死后续意外写入。 |
| Schema endpoint | `ontology.controller.ts` | `GET /api/v1/ontology/schema`：返回 `serializeRegistry(context())`，`ETag: sha256:...`。客户端发 `If-None-Match` 命中时返回 `304` 空体。Order-independent 摘要（Phase 1 已落地）。 |
| Bridge | `action-to-tool-definition.ts` | 纯函数 `compileActionToToolDefinition(action, handler, manifest)`。包装出的 handler 在 ToolCallerProxy 第 3 步插入 `checkBoundary({kind:'action',...})` — `decision.allowed === false` 时返回 `{ok:false, code:'permission_denied', reason, unmetPreconditions}`。Audit（第 6 步）仍由 proxy 自动落 `tool_events`。 |
| Accessor | `manifest-accessor.service.ts` | `getAccessorFor({sessionId, solutionId, manifestName, role, slotBindings?})` 返回一个实现 `ManifestAccessor` 七方法的对象。state 通过 SessionMetadata KV 持久化（key 模板：`manifest.<name>.<field>`）；slot 从调用方提供的快照读取；stream 通过 in-process pub/sub fan-out（`publish(sessionId, streamApiName, event)` 是 phase 3B 的入口）。 |

## 2. Solution 如何把自己的 Action 接入

参考 `packages/backend/src/ontology/live-lesson/`：

```ts
// 1. 声明 ObjectType（一次）
import { defineObjectType } from '@kedge-agentic/ontology';

export const LessonType = defineObjectType({
  apiName: 'Lesson',
  displayName: '课程 / Lesson',
  semantic: '一个完整的课时计划',
  schema: z.object({ id: z.string(), title: z.string() }),
  links: [],
  actions: [],
});
```

```ts
// 2. 声明 Manifest（运行时上下文）
import { defineManifest, defineStateField } from '@kedge-agentic/ontology';

export const LessonSessionManifest = defineManifest({
  name: 'LessonSession',
  displayName: '课时运行 / Lesson Session',
  schemaVersion: '0.1.0',
  semantic: '一次具体课堂运行的运行时上下文',
  slots: [/* plan / class / students / resources */],
  streams: [/* events stream with payload schema */],
  state: [
    defineStateField({ apiName: 'phase', schema: z.enum([...]), initial: 'waiting', ... }),
  ],
  boundaries: [
    { role: 'agent', readable: [...], writable: [...], actions: [...], subscribes: [...] },
    { role: 'picker', readable: [...], writable: [], actions: [] },
    { role: 'admin', readable: ['*'], writable: ['*'], actions: ['*'], subscribes: ['*'] },
  ],
});
```

```ts
// 3. 声明 ActionDef（含 Zod 参数 schema）
import { defineAction } from '@kedge-agentic/ontology';

export const EmitTodoCardAction = defineAction({
  apiName: 'emit_todo_card',
  displayName: '弹出待办卡 / Emit Todo Card',
  semantic: '在学生界面弹出 todo card',
  params: z.object({ title: z.string(), items: z.array(z.object({...})) }),
  sideEffects: ['emits:TodoCard'],
  allowedRoles: ['agent'],
  auditLevel: 'log',
});

export const emitTodoCardHandler = async (invocation) => ({
  ok: true,
  content: [{ type: 'text', text: JSON.stringify({...}) }],
});
```

```ts
// 4. 一个 @Injectable() OnModuleInit 把上面三块装上去
@Injectable()
export class MySolutionOntologyService implements OnModuleInit {
  constructor(
    @Inject(ONTOLOGY_REGISTRY) private readonly registry: OntologyRegistry,
    private readonly toolkits: SolutionToolkitRegistry,
  ) {}

  async onModuleInit() {
    this.registry.registerObjectType(LessonType);
    this.registry.registerManifest(LessonSessionManifest);
    this.registry.seal();

    const td = compileActionToToolDefinition(
      EmitTodoCardAction,
      emitTodoCardHandler,
      LessonSessionManifest,
    );

    this.toolkits.registerToolkit({
      solutionId: 'live-lesson',
      namespace: 'creator-actions',
      tools: [td],
    });
  }
}
```

加进 `OntologyModule.providers` 即可。Phase 3 把 `LiveLessonOntologyService` 直接 co-locate 在平台 backend；后续 follow-up 会通过 `solution.json` 的 `ontologyModule` 字段让 SolutionLoaderService 动态导入 — 参见 `docs/ontology/PROGRESS.md` 的 Phase 3 deferrals 表。

## 3. 前端 / 运维如何消费 schema endpoint

```bash
# 第一次拉
curl -i http://localhost:3001/api/v1/ontology/schema
# HTTP/1.1 200 OK
# ETag: sha256:b3a1...c4f0
# Content-Type: application/json
# { "ontologyVersion": "0.1.0", "objectTypes": [...], "manifests": [...] }

# 第二次拉（声明已有这个版本）
curl -i \
  -H 'If-None-Match: sha256:b3a1...c4f0' \
  http://localhost:3001/api/v1/ontology/schema
# HTTP/1.1 304 Not Modified
# ETag: sha256:b3a1...c4f0
```

ETag 是 sha256 of canonical serialization — **order-independent**，所以两个用相同 def 但注册顺序不同的 registry 会给出同一个摘要。

返回体形状：

```ts
interface SerializedOntology {
  ontologyVersion: string;            // '0.1.0' for Phase 1
  objectTypes: SerializedObjectType[]; // by apiName
  manifests:   SerializedManifest[];   // by name
  functions:   SerializedFunction[];   // Phase 1 stub, [] today
  // Phase 4 adds: objectSets
}
```

`schema` 字段是 JSON Schema（zod-to-json-schema 转的）；类型定义参见 `packages/ontology/src/distribution/serialize.ts`。

## 不在 Phase 3 范围内

明确告知，避免误期待：

- **观察 - 行动闭环（observer-engine → events stream → agent.subscribe）** — observer-engine 还在 live-lesson backend (port 3007) 进程里；跨进程把事件 fan-in 平台 backend 的 `ManifestAccessorService.publish()` 需要一个 transport（HTTP push / SSE / 共享 bus）。Phase 3 暴露了 stream surface 和 publish API，传输层未接。
- **`@Referenceable` 自动发现 live-lesson 实体** — `ContextLayerInitService` 跑在平台 backend，扫不到 live-lesson backend 的 controllers。同一个跨进程问题。当下 `getSlot` 通过 `slotBindings` 快照 + 调用方显式注入。
- **`emit_todo_card` 走 ActionDef 的 e2e** — 新工具注册在 namespace `creator-actions`，与 stdio `creator.emit_todo_card` 并存。Agent system prompt 还没有偏好 ActionDef 变体，e2e spec 17 留待 stdio 路径退役时再补。Phase 3 用 integration test (`live-lesson-ontology.integration.spec.ts`) 覆盖 bridge → audit → boundary 链路。

## 相关文档

- 设计原文：`docs/ontology/kedge-ontology-design.md`（§5.1 ManifestAccessor、§5.2 checkBoundary、§9.6 schema digest、§10.2 bridge）
- 实施计划：`docs/ontology/kedge-ontology-implementation-plan.md`
- 进度跟踪：`docs/ontology/PROGRESS.md`
- 包 README：`packages/ontology/README.md`
