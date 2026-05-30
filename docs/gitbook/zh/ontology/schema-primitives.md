# Schema 原语

> `@kedge-agentic/ontology` 包对外的 5 块描述原语 + 辅助 helper。所有 Solution 用这些原语描述业务。

## ObjectTypeDef — 你的领域实体

`ObjectType` 是 Ontology 里最基础的类型：lesson、student、resource、submission。每个 ObjectType 有 schema、显示元信息、可选的 `implements`（Phase 4+）。

```typescript
import { defineObjectType } from '@kedge-agentic/ontology';
import { z } from 'zod';

export const LessonObjectType = defineObjectType({
  apiName: 'Lesson',
  displayName: '课程 / Lesson',
  semantic: '一堂课的元数据：标题、教学目标、分步任务列表。',
  schema: z.object({
    id: z.string(),
    title: z.string(),
    subject: z.string(),
    gradeLevel: z.string(),
  }),
});
```

参考：[`packages/backend/src/ontology/live-lesson/object-types.ts`](../../../../packages/backend/src/ontology/live-lesson/object-types.ts) 是 live-lesson 的 4 个 ObjectType 完整例子。

## ActionDef — Agent / Workflow 可以调用的动作

`ActionDef` 是 Agent 通过 ToolCaller 调用、Workflow Trigger 触发的统一动作单元。每个 Action 声明 params schema、`allowedRoles`、`sideEffects`、可选的 `preconditions`。

```typescript
import { defineAction } from '@kedge-agentic/ontology';
import { z } from 'zod';

export const EmitTodoCardAction = defineAction({
  apiName: 'emit_todo_card',
  displayName: '生成待办卡片 / Emit TODO Card',
  semantic: 'creator agent 发起 TODO 卡片 渲染到 chat 流。',
  params: z.object({
    threadId: z.string(),
    items: z.array(z.object({ id: z.string(), text: z.string() })),
  }),
  allowedRoles: ['agent'],          // agent 可调；admin / picker 不可
  sideEffects: ['emits:todo_card'], // 文档化的副作用清单
  auditLevel: 'log',
});
```

**Phase 3 桥：** Platform 通过 `compileActionToToolDefinition(action, handler, manifest)` 把 ActionDef 编译为 `ToolDefinition`，挂进 `ToolCallerProxy`，让 Agent 和 Workflow Engine 走完全一样的 audit + boundary check 流水线。

## ManifestDef — 一个 Session 内的 ObjectType + 状态 + 流

`Manifest` 把若干 ObjectType 绑定到 session 范围，定义：哪些 ObjectType 在这个 session 内出现、有什么 state field（K/V 内存 + DB 持久化）、有什么 event stream、什么 boundary（哪些 role 可以读写哪些 state path）。

```typescript
import { defineManifest } from '@kedge-agentic/ontology';

export const LessonSessionManifest = defineManifest({
  name: 'LessonSession',
  semantic: '一堂课的运行时上下文：lesson + classroom session + 学生 + 资源。',
  slots: [
    { apiName: 'lesson', target: { kind: 'objectType', apiName: 'Lesson' } },
    { apiName: 'session', target: { kind: 'objectType', apiName: 'ClassroomSession' } },
    { apiName: 'students', target: { kind: 'objectType', apiName: 'Student' }, collection: true },
  ],
  state: [
    { apiName: 'currentStep', initial: 0 /* number */ },
    { apiName: 'indicators', initial: [] /* IndicatorDef[] */ },
  ],
  streams: [
    { apiName: 'events', payloadSchema: EventPayloadSchema },
    { apiName: 'student_alerts', payloadSchema: AlertPayloadSchema },
  ],
  boundaries: {
    agent: {
      readable: ['currentStep'],
      writable: [],
      subscribable: ['events'],
    },
    admin: { readable: ['*'], writable: ['*'], subscribable: ['*'] },
  },
});
```

完整例子：[`packages/backend/src/ontology/live-lesson/lesson-session.manifest.ts`](../../../../packages/backend/src/ontology/live-lesson/lesson-session.manifest.ts)。

## StreamDef + StateDef — 事件流 + 持久状态

`StreamDef` 是 session 内的事件总线条目（推到 ManifestAccessor.publish + 触发 event-kind Trigger）。`StateDef` 是 session 内的 K/V 状态。Phase 5 M2-M5 一共声明了 6 种事件 type：`student_joined / student_submitted / step_completed / discuss_complete / chat_turn / student_observation_changed`，全部走 LessonSession.events 这一个 stream，用 discriminated union payload schema 区分。

## checkBoundary — 访问控制原语

`checkBoundary({manifest, role, op})` 是纯函数，输入 manifest 描述 + 调用者 role + 操作（read/write/subscribe/invokeAction）+ 可选的 state/slot 快照，返回 `{allowed, reason?}`。Workflow Engine 和 ToolCallerProxy 都用同一份 checkBoundary 实施访问控制。

```typescript
const decision = checkBoundary({
  manifest: LessonSessionManifest,
  role: 'agent',
  op: { kind: 'write', path: 'currentStep' },
  state: { currentStep: 3 /* optional snapshot for state-equals preconditions */ },
});
if (!decision.allowed) throw new Error(decision.reason);
```

## defineXxx 辅助

| Helper | 用途 |
|---|---|
| `defineObjectType(...)` | 类型化 passthrough，确保 schema 字段名拼对 |
| `defineAction(...)` | 同上，加 meta key 校验 |
| `defineManifest(...)` | 同上，加 slot/state/stream/boundary 名字校验 |
| `defineStream(...)` | 同上 |
| `defineState(...)` | 同上 |

这些 helper 在 Tier 2 / Phase 4 字段（`implements`、`derivedFrom` 等）上故意 **不通过编译** ——> Tier 2 不能 silent 漏到 Tier 1 代码里。

## 序列化 + 投影

`serializeRegistry(registry)` 把整个 Registry 序列化为 JSON Schema（Zod → zod-to-json-schema），稳定排序，sha256 摘要，挂在 `GET /api/v1/ontology/schema` endpoint。`projectManifest(manifest, role, format)` 把 manifest 投影为 agent-prompt-friendly 格式：`anthropic-tools` / `mcp-tools` / `system-prompt`，让 Agent prompt 直接知道有哪些 Action 可调、参数是什么、boundary 是什么。

详见：[`packages/ontology/src/distribution/`](../../../../packages/ontology/src/distribution/) + [`packages/ontology/src/semantic/`](../../../../packages/ontology/src/semantic/)。
