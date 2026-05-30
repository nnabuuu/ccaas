# Indicator 目录

> **Indicator** 是 LLM 把对话分类到的 "知识点 / 误解点" 标签。`IndicatorRegistryService` 保存 session 范围的目录，Solution 通过 PUT endpoint 在 session 启动时推上来。

## IndicatorDef 数据形态

```typescript
interface IndicatorDef {
  id: string;            // 'K1' / 'M3' 之类的 anchor token；K = knowledge，M = misconception
  type: string;          // 'knowledge' | 'misconception'（平台层为 string，可扩展）
  label: string;         // 教师面板上显示
  description: string;   // 喂给 LLM classifier prompt
}
```

`anchor id` 是 ChatTurnService LLM 输出的 `anchors[]` 数组的合法值集合 —— LLM 可以瞎编 id，但平台过滤掉不在 registered 集合内的（**anti-hallucination filter**）。

## IndicatorRegistryService —— 服务端存储

`packages/backend/src/workflow/llm/indicator-registry.service.ts`

```typescript
@Injectable()
export class IndicatorRegistryService {
  setIndicators(solutionId, sessionId, indicators): void
  getIndicators(solutionId, sessionId): readonly IndicatorDef[]
  clearSession(sessionId): void              // 广义清理（跨租户；引擎 teardown 用）
  clearTenantSession(solutionId, sessionId): void  // 租户范围清理（DELETE endpoint 用）
}
```

**租户隔离 (M5 pass-1 MF3):** 内部 Map 用 `${solutionId}\x1f${sessionId}` 做 key（`\x1f` ASCII Unit Separator 防 slug 含空格的冲突）。M6 pass-2 SF3 加了 `clearTenantSession` 让 DELETE endpoint 只清自己 tenant 的数据。

**进程内 only:** Map<string, IndicatorDef[]>。重启后清空，Solution 在下次 session 启动时再 push。

## 注册端点：PUT `/api/v1/workflow/sessions/:sessionId/indicators`

```
PUT /api/v1/workflow/sessions/:sessionId/indicators
Authorization: Bearer <chat-scope key>
Content-Type: application/json

{
  "indicators": [
    { "id": "K1", "type": "knowledge", "label": "识别关键概念", "description": "学生能命名概念" },
    { "id": "M1", "type": "misconception", "label": "倒置因果", "description": "学生混淆方向" }
  ]
}

→ 204 No Content (replace 语义；空数组 = clear)
→ 400 校验失败 / tenant 未绑定
```

幂等（PUT 语义 = replace）。空数组合法，等于清空 session 目录。

Solution 端：`live-lesson` 在 `ClassroomStateService.loadIndicators` 从 lesson manifest 读取，调 `WorkflowIndicatorPushService.pushIndicators(sessionId, indicators)`，fire-and-forget。

## 端到端流水线

```
Solution 启动 session
  ↓
loadIndicators 从 manifest 读 IndicatorDef[]
  ↓
WorkflowIndicatorPushService.pushIndicators
  ↓ HTTP PUT /api/v1/workflow/sessions/:id/indicators
  ↓ 平台 IndicatorIngestController @TenantId() check → 400 if no tenant
  ↓ IndicatorRegistryService.setIndicators(solutionId, sessionId, list)
  ↓
后续每次 chat_turn:
  ChatTurnService.classifyWithLlm:
    indicators = this.indicators.getIndicators(solutionId, sessionId)
    if (indicators.length === 0) return 'no indicators; skip'  ← M5.3a 之前 prod 永远命中这条
    ... LLM call with indicator catalog in system prompt
  ↓
session end:
  ClassroomService.endSession
    workflowLifecycle.clearSession(sessionId)
    ↓ HTTP DELETE /api/v1/workflow/sessions/:id
    ↓ 平台 SessionLifecycleController:
       engine.clearSessionQueue(sessionId)      // drain queue
       indicators.clearTenantSession(solutionId, sessionId)  // tenant-scoped clear
```

## anti-hallucination filter

ChatTurnService 调 LLM 拿回 `{action, anchors, gist, quote}` 后：

```typescript
const validIds = new Set(indicators.map(a => a.id));
llmOutput.anchors = (llmOutput.anchors ?? []).filter(a => validIds.has(a));
```

LLM 可能瞎编 `anchors: ['K99', 'INJECTED']`，但 K99 不在 registered indicators 里 → 被丢弃。保留 `gist` 和 `quote` 文本（因为它们是描述性的，不影响下游 status 派生）。

## 故障模式

| 现象 | 原因 |
|---|---|
| PUT 返回 400 "solutionId not resolved" | API key 没绑 tenant；用 dev-login 的 admin key 时常见 |
| chat_turn 一直 skip | platform IndicatorRegistry 空 —— 见 [Session 生命周期](session-lifecycle.md) 的 race condition note |
| Indicators 重启后丢失 | by design：in-memory；Solution 下次 session 重 push |
| Tenant A push 后 tenant B 看到了 | 不应发生：keyed by `(solutionId, sessionId)` 元组；M5 pass-1 MF3 + spec covered |
| DELETE 后 tenant B 的目录被一起删了 | M6 pass-1 时是这样（broad cascade）；M6 pass-2 SF3 已修，现在 DELETE 用 `clearTenantSession` |

## 相关文件

| 文件 | 职责 |
|---|---|
| `packages/backend/src/workflow/llm/indicator-registry.service.ts` | 服务端 in-memory store |
| `packages/backend/src/workflow/indicator-ingest/indicator-ingest.controller.ts` | PUT endpoint + DTO |
| `packages/workflow-client/src/index.ts` `WorkflowClient.setIndicators` | client 端 push 方法 |
| `solutions/business/live-lesson/backend/src/adapters/workflow-outbox/workflow-indicator-push.service.ts` | Solution 侧 wrapper |
| `packages/backend/src/workflow/handlers/chat-turn/chat-turn.service.ts` | 主消费者（anchors anti-hallucination 在这里） |
