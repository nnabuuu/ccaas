# Session 生命周期

> Session 从启动到结束之间，Solution 和平台之间需要交换什么信号 + 怎么避免泄漏。这一章讲 PUT indicators → DELETE session 的完整 lifecycle 协议。

## 信号顺序

```
[Solution session 启动]
   ↓
PUT /api/v1/workflow/sessions/:id/indicators   ← 推 indicator 目录（M5.3a）
   │ replace 语义；幂等
   ↓
[Solution + 平台稳态：Solution 推 events，平台跑 trigger/cascade，dashboard 读 platform]
   ↓
[Solution session 结束]
   ↓
DELETE /api/v1/workflow/sessions/:id           ← 信号 teardown（M6 pass-1/2）
   │ tenant-scoped；幂等；空 ok
   ↓
[平台 IndicatorRegistry 释放 catalog，engine queue drain]
```

## PUT `/indicators`

详见 [Indicator 目录](indicator-catalog.md)。要点：

- Solution 在 session 启动时调用一次
- replace 语义（Solution 同 session 多次调，最后一次赢）
- 失败时 platform 侧 LLM cascade 会 `'no indicators; skip'` —— 不影响 session 启动；下次启动重 push

## DELETE `/api/v1/workflow/sessions/:sessionId`

```
DELETE /api/v1/workflow/sessions/:sessionId
Authorization: Bearer <chat-scope key>

→ 204 No Content
→ 400 校验失败 / 没 tenant 绑定
```

平台内部：

```typescript
async clearSession(sessionId, @TenantId() solutionId) {
  if (!solutionId) throw 400;
  this.engine.clearSessionQueue(sessionId);                   // drain queue（租户无关）
  this.indicators.clearTenantSession(solutionId, sessionId);  // 仅清自己 tenant 的目录
}
```

**为什么用 `clearSessionQueue` 而不是 `clearSession`：** 后者 cascade 到 `IndicatorRegistry.clearSession` 是 sessionId-broad（跨 tenant 删除）。租户 A 的 DELETE 不应误删 B 的目录。M6 pass-2 SF3 加了 `clearSessionQueue`（仅 drain queue，不动 indicator）+ `clearTenantSession`（仅删本 tenant 数据），让 DELETE controller 走窄路径。

## Live-lesson 侧调用点

```typescript
// solutions/business/live-lesson/backend/src/application/classroom/classroom.service.ts

async endSession(code: string) {
  const session = await this.resolveSession(code);

  // M6 pass-2 SF2: 在 already-ended early-return 之前 fire
  // 上次 endSession 可能因 platform 暂时挂掉没成功，重试是幂等的
  void this.workflowLifecycle.clearSession(session.id);

  if (session.status === 'ended') {
    return { ok: true, status: 'ended' };
  }
  // ... 其余本地清理
}

private async cleanupStaleSessions(): Promise<void> {
  // M6 pass-2 SF1: crash-path 也要清平台
  // process kill / abandoned endSession 走不到上面那条
  for (const session of staleSessions) {
    this.stateService.cleanupSession(session.id, session.lessonId);
    this.broadcastService.cleanupSession(session.id);
    void this.workflowLifecycle.clearSession(session.id);
  }
}
```

`WorkflowSessionLifecycleService.clearSession(sessionId)` 包装 `WorkflowClient.clearSession`，fire-and-forget，平台 4xx 不重试（terminal）；transient 5xx 等下次 endSession / cleanupStaleSessions 自然重试。

## 租户隔离的两个边界

平台有两套 clear API，目的不同：

| API | 范围 | 调用者 |
|---|---|---|
| `IndicatorRegistryService.clearSession(sessionId)` | 跨 tenant（按 sessionId 后缀匹配） | `WorkflowEngineService.clearSession` —— 引擎内部 teardown |
| `IndicatorRegistryService.clearTenantSession(solutionId, sessionId)` | 仅 (solutionId, sessionId) tuple | `SessionLifecycleController` —— 外部 HTTP DELETE |
| `WorkflowEngineService.clearSession(sessionId)` | drain queue + 广义 indicator clear | 未来 SessionService teardown（尚未 wire） |
| `WorkflowEngineService.clearSessionQueue(sessionId)` | 仅 drain queue | `SessionLifecycleController` —— 外部 DELETE |

**为什么两套：** 引擎 teardown 在进程内 trusts sessionId 全局唯一（UUID），用广义清理更省事；外部 HTTP DELETE 走 auth 边界，必须 tenant-scoped。

## Race condition：indicator push 还在飞 + chat_turn 已到

Session 启动后立刻：
1. `pushIndicators(...)` HTTP PUT 在飞
2. 第一个 `chat_turn` event 在飞

Race 窗口：如果 chat_turn 比 PUT 先到 platform，ChatTurnService 看到空 catalog → `'no indicators; skip'` → 这条 chat_turn 没被分类。

**目前处理：** 接受这个小窗口。Solution 启动顺序通常是 session create → indicators push → 学生加入 → 第一条 chat 至少几百 ms 之后。M5.3a 没显式处理。

**可选 hardening（未实现）：** 平台 `pushIndicators` 同步等到 setIndicators 完成再 return；或前端拿到 dashboard "indicator catalog 空" 显示 banner。

## 故障模式

| 现象 | 原因 |
|---|---|
| DELETE 400 "solutionId not resolved" | API key 没绑 tenant（dev-login admin key 会这样） |
| Session 结束后 IndicatorRegistry 还有 catalog | 平台没收到 DELETE 或 DELETE 失败；M6 pass-2 SF1 + SF2 已收敛绝大多数 case |
| 跨 tenant 数据被一起删 | M6 pass-1 是这样（用了广义 cascade）；M6 pass-2 SF3 修复 |
| Tenant B 看到 tenant A push 的数据 | 不应发生：keyed by `(solutionId, sessionId)`；M5 pass-1 MF3 + 专门 spec |

## 相关文件

| 文件 | 职责 |
|---|---|
| `packages/backend/src/workflow/session-lifecycle/session-lifecycle.controller.ts` | DELETE endpoint（M6 pass-1/2） |
| `packages/backend/src/workflow/llm/indicator-registry.service.ts` `clearTenantSession` | tenant-scoped 清理（M6 pass-2 SF3） |
| `packages/backend/src/workflow/workflow-engine.service.ts` `clearSessionQueue` | 仅 drain queue（M6 pass-2 SF3） |
| `packages/workflow-client/src/index.ts` `clearSession` | client 端 DELETE 方法 |
| `solutions/business/live-lesson/backend/src/adapters/workflow-outbox/workflow-session-lifecycle.service.ts` | Solution 侧 wrapper |
| `solutions/business/live-lesson/backend/src/application/classroom/classroom.service.ts` endSession + cleanupStaleSessions | 调用点（happy-path + crash-path） |
