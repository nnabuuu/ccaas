# Ontology & Workflow 概述

> KedgeAgentic 的 **本体层** + **动能层** —— Palantir-Carbon 风格的声明式架构，让 Solution 用类型化的对象、动作、触发器来描述业务，而不是手写的 NestJS 服务。

## 两个包，两个职责

```
@kedge-agentic/ontology  (framework-free)        Ontology = 数据 + 关系 + 动作
  ├── ObjectTypeDef    (Lesson / Student / ...)
  ├── ActionDef        (emit_todo_card / record_observation / ...)
  ├── ManifestDef      (LessonSession = session 内绑定的对象 + 状态 + 事件流)
  ├── StreamDef        (events / student_alerts / ...)
  └── checkBoundary    (动作的访问控制：role / state / slot 前置条件)

packages/backend/src/workflow/  (NestJS)         Workflow = 触发器 + 引擎 + 处理
  ├── TriggerDef       (event / state-change / object-set-change 三种触发方式)
  ├── WorkflowEngine   (cascade + per-session FIFO + 队列回压)
  ├── 各类 Handler     (LifecycleObservation / ChatTurn / StatusChange / ...)
  └── 跨进程 ingest     (POST /api/v1/workflow/sessions/:id/events)
```

**为什么分两个包：** Ontology 是 Solution 作者描述业务的 **类型规范**，必须 framework-free + 跨进程 + 可序列化（schema endpoint + agent prompt 投影）。Workflow 是平台运行时如何 **执行** 这些规范的 NestJS 实现，依赖 DI、TypeORM、HTTP。把 Ontology 包独立出来意味着 Solution 可以在浏览器、CLI、Node CLI 复用同一份类型定义。

## 你为什么需要读这章

{% hint style="info" %}
**第一次接触 Ontology 这个概念？** 先读 [什么是 Ontology](what-is-ontology.md) —— 用最少代码讲清 Palantir 风格 ontology 解决什么问题、什么 Solution 适合用。
{% endhint %}

| 你是 | 你关心 | 重点章节 |
|---|---|---|
| Solution 作者 | 用 ObjectType + Action 描述业务，让 Agent 调用 | [什么是 Ontology](what-is-ontology.md) → [Schema 原语](schema-primitives.md) → [Trigger + Workflow](trigger-and-workflow-engine.md) |
| 后端工程师 | 平台如何处理跨进程事件、cascade、teardown | [跨进程事件推送](cross-process-events.md) → [Session 生命周期](session-lifecycle.md) |
| 前端工程师 | 教师 dashboard 的 wire shape、observation 如何投影 | [Dashboard 契约](dashboard-contract.md) → [Observation 管线](observation-pipeline.md) |
| 运维 / SRE | schema endpoint、ingest endpoint、auth、tenant 隔离 | [跨进程事件推送](cross-process-events.md) §auth + [Session 生命周期](session-lifecycle.md) §租户隔离 |

## 设计哲学

**Palantir-Carbon 纯：** Ontology 包只描述 schema（5 块：ObjectType / Manifest / Action / Stream / State）。Carbon / Workshop / Notification 这类"动能 / 执行 / 通知"概念在 Palantir 中是独立产品，在 KedgeAgentic 中对应 `packages/backend/src/workflow/`。这种分层避免了 Ontology 包被 NestJS / TypeORM 渗透。

**类型 + 运行时一致：** Solution 作者写 `defineObjectType(...)` 时拿到 TypeScript 类型，启动时 `OntologyRegistry.seal()` 做 cross-def 验证，运行时 `checkBoundary(...)` 检查访问控制。同一份 Zod schema 在 schema endpoint 上序列化为 JSON Schema，给 Agent prompt 投影使用。

**单写、单读：** Phase 5 之前 live-lesson 同时跑 observer-engine（本地观察存储）+ 新的 workflow（跨进程推送），是 dual-write 过渡期。Phase 5 M6 完成后只有 workflow 一条路径：live-lesson 推事件、平台写 observation 表、live-lesson HTTP 拉 dashboard。

## 章节地图

| 章节 | 内容 |
|---|---|
| [什么是 Ontology](what-is-ontology.md) | 概念 / 设计动机 / Palantir 风格 / 4 个核心问题 / 不用 vs 用对比 / 何时适用 |
| [Schema 原语](schema-primitives.md) | ObjectTypeDef / ActionDef / ManifestDef / StreamDef / StateDef / defineXxx 辅助 |
| [Trigger + Workflow 引擎](trigger-and-workflow-engine.md) | TriggerDef 三种 kind / WorkflowEngine 调度 / cascade / 队列 |
| [Observation 管线](observation-pipeline.md) | `Observation` 行类型 / 5 种 type（lifecycle / exercise / progress / indicator_hit / student_status）/ observer-engine 退役时间线 |
| [Indicator 目录](indicator-catalog.md) | IndicatorRegistry / PUT `/indicators` endpoint / M4 LLM cascade 端到端 |
| [Dashboard 契约](dashboard-contract.md) | `DashboardPayload`（新）+ `ObservationDashboardPayload`（legacy projector）+ 两个 endpoint |
| [跨进程事件推送](cross-process-events.md) | `@kedge-agentic/workflow-client` / outbox / dedup / 重试 |
| [Session 生命周期](session-lifecycle.md) | PUT indicators / DELETE session / 租户隔离 / 引擎队列 |

## 实现进度

详细的 phase / milestone / 决策记录见 [`docs/ontology/PROGRESS.md`](../../../ontology/PROGRESS.md)。当前状态（2026-05）：

- Phase 1 ✅ Ontology v0.1（5 块原语 + 包级测试 + serialize/digest/projection）
- Phase 2 ✅ context-layer 重构（EntityRegistry → OntologyRegistry 委托）
- Phase 3 ✅ live-lesson 接入 + Action → Tool 桥
- Phase 4 🔵 Tier 2 原语（ObjectSetDef 已 ship；InterfaceDef + BoundaryPredicate 待真实需求触发）
- Phase 5 🔵 Workflow 重写（M1–M6 done；M5 second pass 前端改写仍在 backlog）
