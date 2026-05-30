# 什么是 Ontology

> 在介绍 ObjectTypeDef、ActionDef 这些类型之前，先理解 **Ontology 是什么、解决什么问题、Solution 什么情况下用它**。这一页用最少的代码讲清楚概念。

## 一句话定义

**Ontology = 用一份类型化的描述，统一回答业务中"有什么对象"、"对象之间怎么连"、"能对它们做什么"、"谁能做什么"这四个问题。**

它不是数据库 schema（数据库只回答前两个问题），也不是 API 文档（API 只回答第三个问题）。Ontology 把这四件事拼在一起作为单一事实来源。

## 一图概览

```
                ┌──────────────────────────────┐
                │     Solution 一次声明:        │
                │                              │
                │     ObjectTypeDef            │
                │     ActionDef                │  ◀── 单一事实来源
                │     ManifestDef              │
                │     AccessBoundary           │
                │     StreamDef                │
                │                              │
                └───────────────┬──────────────┘
                                │
                                │  自动派生 / 自动检查
                                │
   ┌──────────┬──────────┬──────┴──────┬─────────────┬──────────┐
   ▼          ▼          ▼             ▼             ▼          ▼

TypeScript  Agent      Schema       Workflow      Boundary    Audit
 类型       tool       endpoint     Trigger        check       log
            catalog
(浏览器 +   (LLM        (HTTP +     (event →      (运行时     (每次
 后端       自描述)      ETag/304)   reaction      强制 +      action
 共享)                              cascade)      role 检查)   自动记录)
```

**核心收益：** 同一份描述，5+ 个下游消费者自动派生。改 ActionDef 时所有派生面同步更新——TypeScript 类型、Agent prompt、schema endpoint、workflow trigger、boundary check、audit log 不会漂移。

## Palantir 风格的设计动机

KedgeAgentic 的 Ontology 设计借鉴了 **Palantir Foundry 的 Ontology Object Model**。Palantir 在企业 BI 场景里观察到的现象是：

- 同一个"客户"概念，业务部门叫 Customer、销售系统里叫 Account、CRM 里叫 Contact，每个系统都有自己的 schema、自己的 API、自己的权限规则。
- 业务流程横跨多个系统时，工程师反复手写 join + 转换 + 权限检查代码。
- AI / Agent 进来之后情况更糟：它需要知道有哪些实体、能做什么动作、什么前置条件 —— 但这些信息散落在 DB schema + REST docs + 服务代码里。

Palantir 的解法：**先描述这个世界（Ontology），然后所有系统在它之上展开。** Object Type 一次定义，Action 一次定义，Boundary 一次定义，BI 报表、数据应用、AI Agent 都直接消费这同一份定义。

KedgeAgentic 继承了同样的"先描述、后执行"哲学，并把它落实到 TypeScript + Zod 类型系统里。

## Ontology 回答的 4 个问题

| 问题 | 回答它的原语 | 例子 |
|---|---|---|
| **有什么对象？** | `ObjectTypeDef` | Lesson、Student、Resource、ClassroomSession |
| **对象怎么连？** | `LinkDef`（Phase 4） + `ManifestDef.slots` | LessonSession 这个 session 内绑定了 1 个 Lesson + 1 个 ClassroomSession + N 个 Student |
| **能对它们做什么？** | `ActionDef` | `emit_todo_card`、`record_lifecycle_observation`、`classify_chat_turn_indicators` |
| **谁能做什么？** | `AccessBoundary` + `checkBoundary` | Agent 只能读 currentStep，admin 能读写全部 |

`ManifestDef` 把这 4 块拼成一个 session 范围的运行时单元（"这个 session 里有哪些对象 + 状态 + 事件流 + 谁能动什么"）；`StreamDef` 描述 session 内的事件总线条目（外部事件 ingest 入这里）。

## 不用 Ontology 的世界 vs. 用 Ontology 的世界

### 不用：传统 NestJS Solution

业务做"学生提交练习后给老师发通知"的逻辑大概长这样：

```typescript
// student.controller.ts
@Post('/students/:id/submit')
async submit(@Param('id') studentId, @Body() data, @Req() req) {
  if (req.user.role !== 'student') throw new ForbiddenException();
  const result = await this.gradingService.grade(data);
  await this.submissionRepo.insert({...});
  await this.notifyService.notifyTeacher({...});   // 通知写死在这
  return { ok: true, score: result.total };
}
```

问题：
- Agent 想知道"有没有这个 action 可调用？参数是什么？谁能调？" —— 它得读 OpenAPI / Swagger，再去翻 service 源码看 role 检查。
- 改通知逻辑要改 controller、service、可能还有 hook。
- 不同 controller 对"谁能干什么"的检查写法不一样，权限规则漂移。
- 没有"声明式的事件 → 反应" —— 想加一条"misconception 累计 3 次就告警"得手写 polling 或自己监听。

### 用：声明式 Ontology

```typescript
// 1. 一次声明 ObjectType
const StudentType = defineObjectType({ apiName: 'Student', schema: ..., displayName: '学生' });

// 2. 一次声明 Action（含 role + params + sideEffects + audit 级别）
const SubmitAction = defineAction({
  apiName: 'submit_exercise',
  params: z.object({ studentId: z.string(), data: z.unknown() }),
  allowedRoles: ['student'],
  sideEffects: ['observation:append', 'emits:student_submitted'],
  auditLevel: 'log',
});

// 3. 一次声明 Trigger（事件 → 反应）
const NOTIFY_TEACHER_ON_SUBMIT: TriggerDef = {
  kind: 'event',
  watch: { stream: 'events' },
  when: (input) => input.event?.payload.type === 'student_submitted',
  then: {
    action: 'notify_teacher',
    args: (input) => ({ studentId: input.event.payload.studentId, ... }),
    as: 'admin',
  },
};
```

收益：
- Agent 通过 `GET /api/v1/ontology/schema` 直接拿到全部 ActionDef + 它的 params + allowedRoles。不用读 OpenAPI、不用翻源码。
- Boundary check 是平台层自动跑的（`checkBoundary`），所有 controller 行为一致。
- 通知逻辑变成独立的 TriggerDef + ActionDef，与"提交"完全解耦。改通知不动 submit。
- 加新规则（如"misconception 3 次告警"）= 加一个 TriggerDef，不写循环、不写 polling。
- 跨进程也成立：Solution backend 写 ObjectType 类型定义，浏览器、CLI、Node 都能复用同一份。

## 什么 Solution 适合用？

**适合：**
- 业务里有清晰的"实体 + 动作"模型（教师 / 学生 / 课程 / 提交、医生 / 病人 / 诊断、客户 / 订单 / 退款 ...）
- AI Agent 需要发现可调用的 action（而不是 hard-code 几个 tool）
- 业务规则里有大量"事件 → 反应"链（提交完算分、状态变化通知、累计触发告警）
- 多端 / 多进程需要共享同一套类型（前端 + 后端 + Agent）
- 想长期维护稳定的权限模型（避免在每个 controller 重复 role check）

**不适合：**
- 单文件 prototype / 玩具 Solution，所有逻辑塞一个文件就够了
- 业务全部是"调 LLM、解析回复"，几乎没领域对象
- 一次性脚本、Demo

KedgeAgentic 把 Ontology + Workflow 设计成 **opt-in** —— 不用它，平台核心功能（Skill、MCP、Agent Engine、Workspace、Session）一样工作。用上它的 Solution（如 live-lesson）会得到声明式 + 类型安全 + Agent 自描述的额外能力。

## 与 Workflow 层的关系

Ontology **描述世界**：有什么对象 / 什么 action / 什么 boundary。

Workflow **执行规则**：根据 TriggerDef 看到事件就调 ActionDef、维护 cascade、租户隔离、跨进程 ingest。

设计上两层故意分开（参见 [概述](README.md) §设计哲学）：
- Ontology 包 framework-free，可以在浏览器 / CLI / Node CLI 复用同一份类型。
- Workflow 包是 NestJS 实现，依赖 DI / TypeORM / HTTP。

写 Solution 时这两块 API 都是给你用的，但层次不同：Ontology 是你 **描述** 业务，Workflow 是平台 **执行** 你描述的业务。

## 下一步

读懂了概念之后：

1. **想动手写：** [Schema 原语](schema-primitives.md) —— 5 块原语 + Zod schema + defineXxx helper 的完整 API
2. **想看 Trigger 怎么调度：** [Trigger + Workflow 引擎](trigger-and-workflow-engine.md)
3. **想看完整例子：** `packages/backend/src/ontology/live-lesson/` 是 live-lesson 的 4 个 ObjectType + 1 个 Manifest + 1 个 ActionDef 的完整实现
4. **想看 Phase 进度：** [`docs/ontology/PROGRESS.md`](../../../ontology/PROGRESS.md)
