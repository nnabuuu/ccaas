# SSE Session 事件流程详解

> **Advanced Topic**: 本文档面向需要深入理解 REST/SSE 消息通道实现的开发者。
>
> 最后更新：2026-02-20（commit `d019bd1`）

## 概述

KedgeAgentic 支持两种传输方式：**WebSocket**（ChatGateway）和 **REST/SSE**（SessionsController）。本文档专注于 REST/SSE 通道——客户端发一条 HTTP POST，服务器以 `text/event-stream` 格式流式返回 AgentEngine 的所有事件，直到本轮对话结束。

**涉及的核心组件：**

| 组件 | 文件 | 职责 |
|------|------|------|
| `SessionsController` | `src/sessions/sessions.controller.ts` | HTTP 端点，SSE 生命周期编排 |
| `StreamRegistryService` | `src/sessions/services/stream-registry.service.ts` | SSE 订阅者管理 + 事件缓冲 |
| `CompletionOrchestrationService` | `src/sessions/services/completion-orchestration.service.ts` | 10 步消息处理流水线 |
| `CliProcessService` | `src/sessions/services/cli-process.service.ts` | AgentEngine 子进程管理 |
| `EventMapperService` | `src/sessions/event-mapper.service.ts` | CLI stream-json → 前端事件翻译 |

---

## 一、整体架构

```
Client (React SDK)
    │
    │  POST /api/v1/sessions/:id/messages   (HTTP, text/event-stream)
    ▼
SessionsController
    ├── StreamRegistryService   ← SSE 订阅者注册 + 序号分配 + 断线重连缓冲
    │
    ├── CompletionOrchestrationService   ← 10 步流水线（技能同步、消息持久化、CLI 启动）
    │       │
    │       └── CliProcessService   ← spawn/stdin/stdout/close
    │               │
    │               └── EventMapperService   ← CLI stream-json → FrontendEvent
    │
    └── 流水线结束 → streamRegistry.closeSession() → res.end()
```

---

## 二、Happy Path 时序图

```
Client        Controller      StreamRegistry   Orchestration    CliProcess     AgentEngine
  │               │                │                │               │               │
  │ POST /messages│                │                │               │               │
  │──────────────►│                │                │               │               │
  │               │ subscribe()    │                │               │               │
  │               │───────────────►│                │               │               │
  │               │  subscriberId  │                │               │               │
  │               │◄───────────────│                │               │               │
  │               │                │                │               │               │
  │◄ ─ ─ ─ ─ ─ ─ HTTP 200, Content-Type: text/event-stream ─ ─ ─ ─│               │
  │  (连接保持)    │                │                │               │               │
  │               │                │  orchestrateMessage()          │               │
  │               │────────────────────────────────►│               │               │
  │               │                │                │               │               │
  │               │                │                │ ensureCLIProcess()            │
  │               │                │                │──────────────►│               │
  │               │                │                │               │ spawn claude  │
  │               │                │                │               │──────────────►│
  │               │                │                │               │               │
  │               │                │                │               │ stdin: {msg}  │
  │               │                │                │               │──────────────►│
  │               │                │                │               │               │
  │               │                │                │               │◄── text_delta (stream-json)
  │               │                │  emit()        │  onEvent()    │               │
  │               │                │◄───────────────────────────────│               │
  │◄─ SSE id:1 ───│◄───────────────│                │               │               │
  │  {text_delta} │                │                │               │               │
  │               │                │                │               │◄── tool_activity
  │               │                │  emit()        │  onEvent()    │               │
  │◄─ SSE id:2 ───│◄───────────────│                │               │               │
  │  {tool_activity}               │                │               │               │
  │               │                │                │               │               │
  │               │                │                │               │◄── process exits (code 0)
  │               │                │                │               │  handleCLIClose()
  │               │                │  emit()        │  onEvent()    │               │
  │◄─ SSE id:3 ───│◄───────────────│  (complete)    │               │               │
  │  {agent_status│                │                │               │               │
  │   complete}   │                │                │               │               │
  │               │                │           completionPromise resolves           │
  │               │                │                │◄──────────────│               │
  │               │  closeSession()│                │               │               │
  │               │───────────────►│                │               │               │
  │◄─ SSE: done ──│◄───────────────│                │               │               │
  │ (res.end())   │                │                │               │               │
```

---

## 三、Cancel 时序图

取消通过独立的 REST 端点触发：`POST /api/v1/sessions/:id/cancel`

```
Client        Controller      StreamRegistry   CliProcess     AgentEngine
  │               │                │               │               │
  │ POST /cancel  │                │               │               │
  │──────────────►│                │               │               │
  │               │ cancelSession()│               │               │
  │               │────────────────────────────────►               │
  │               │                │               │ SIGTERM       │
  │               │                │               │──────────────►│
  │               │                │               │               │ (dying...)
  │               │                │               │               │
  │               │                │               │ handleCLIClose()
  │               │                │               │ wasCancelled = true
  │               │                │  emit()       │               │
  │               │                │◄──────────────│ onEvent(cancelled)
  │◄─ SSE id:N ───│◄───────────────│               │               │
  │  {cancelled}  │                │  resolveCompletion() ─────────│
  │               │  closeSession()│               │               │
  │               │───────────────►│               │               │
  │◄─ SSE: done ──│◄───────────────│               │               │
  │ (res.end())   │                │               │               │
  │               │                │               │               │
  │  200 {success}│                │               │               │
  │◄──────────────│                │               │               │
```

> **关键约束**：`handleCLIClose` 在 `wasCancelled=true` 时**必须**调用 `onEvent(cancelled)`，否则 `orchestrateMessage` 里的 `await completionPromise` 永远阻塞，Controller 连接泄露。详见 [commit d019bd1](../../packages/backend/src/sessions/services/cli-process.service.ts)。

---

## 四、CompletionOrchestrationService 的 10 步流水线

```
POST /messages 请求进入
        │
        ▼
┌──────────────────────────────────────────────────────────────────┐
│  Controller 预处理                                                │
│  · 生成 subscriberId (UUID)                                      │
│  · StreamRegistry.subscribe(sessionId, res)   ← SSE 流建立      │
│  · 若有 afterSeq：getEventsSince() replay 缓冲事件  ← 断线重连   │
│  · 加载 skills + 生成 systemPrompt                               │
│  · SessionService.getOrCreateSession()                           │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  CompletionOrchestrationService.orchestrateMessage()             │
│                                                                  │
│  Step 1   tenantsService.findOne()          解析 tenantId        │
│  Step 2   session.mcpServers = mcpServers   配置 MCP 服务器      │
│  Step 3   skillSyncService.syncToSession()  同步技能文件         │
│  Step 4   fs.copyFileSync(skillPath)        复制 skill 文件      │
│  Step 5   messagesService.create() × 2     持久化 user/assistant │
│  Step 5a  turnsService.createNextTurn()     创建 Turn 记录       │
│  Step 5b  autoGenerateTitle()              (首条消息)自动命名    │
│  Step 6   fs.writeFileSync(page-context.json)  写上下文文件      │
│  Step 7   conversationContextService.createOrUpdate()  (首条)    │
│                                                                  │
│  Step 8   创建 completionPromise                                 │
│           ┌─ basePromise   ← 等待 onEvent(terminal status)      │
│           └─ timeoutPromise (10分钟, .unref())  ← 安全兜底      │
│           completionPromise = Promise.race([base, timeout])      │
│                                                                  │
│  Step 9   fire-and-forget:                                       │
│           messageCount === 0 → ensureCLIProcess()  ← 新会话     │
│           messageCount  >  0 → sendFollowUp()      ← --resume   │
│           两者均 .catch(err => resolveCompletion())             │
│                                                                  │
│  await completionPromise   ← 阻塞至 complete/error/cancelled    │
│                               或 10 分钟超时                     │
│                                                                  │
│  return { sessionId, userMessageId, assistantMessageId, ... }   │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
        Controller: streamRegistry.closeSession()
                     │
                     ▼
          SSE: `done` 事件 → res.end()
```

---

## 五、事件在管道中的流动

```
AgentEngine stdout (每行一个 JSON)
  {"type":"assistant","message":{"content":[{"type":"text","text":"Hi"}]}}
        │
        ▼
  handleCLIOutput()
  · session.buffer += chunk           ← 处理 TCP 分包
  · split('\n') → 逐行 JSON.parse()
        │
        ▼
  EventMapperService.mapToFrontendEvents(cliEvent)
  ┌─────────────────────────────────────────────────────┐
  │  CLI type           →  Frontend event type(s)       │
  │  ─────────────────────────────────────────────────  │
  │  assistant:text     →  text_delta                   │
  │  assistant:tool_use →  tool_activity {phase:start}  │
  │  user:tool_result   →  tool_activity {phase:end}    │
  │  result:success     →  chat_response                │
  │                         + agent_status:complete     │
  │  thinking-delta     →  agent_thinking               │
  │  message_delta      →  token_usage                  │
  │  (write_output)     →  output_update                │
  │  (todo_write)       →  todo_update                  │
  └─────────────────────────────────────────────────────┘
        │
        ▼
  orchestrateMessage 的 handleEvent(event) 回调
  · text_delta     → accumulatedText += delta
  · complete       → messagesService.updateContent() + completeTurn()
  · terminal status → resolveCompletion()
        │
        ▼
  emitEvent(event) → streamRegistry.emit(sessionId, event)
  · 分配全局自增 seq
  · 追加到 eventBuffer（最多 200 条）
  · 向所有 subscribers 写入
        │
        ▼
  res.write(`id: ${seq}\ndata: ${JSON.stringify(envelope)}\n\n`)
        │
        ▼
  Client 收到 SSE 事件
```

---

## 六、SSE Wire Format

客户端实际收到的字节流：

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

id: 1
data: {"seq":1,"sessionId":"abc-123","timestamp":"2026-02-20T10:00:00.000Z","event":{"type":"text_delta","delta":"Hello","sessionId":"abc-123","clientId":"sse:abc-123"}}

id: 2
data: {"seq":2,"sessionId":"abc-123","timestamp":"2026-02-20T10:00:00.100Z","event":{"type":"tool_activity","payload":{"toolName":"Read","phase":"start",...}}}

id: 3
data: {"seq":3,"sessionId":"abc-123","timestamp":"2026-02-20T10:00:01.200Z","event":{"type":"agent_status","status":"complete","sessionId":"abc-123"}}

data: done

```

> `data: done` 是 `closeSession()` 发出的终止信号，之后 `res.end()` 关闭连接。

---

## 七、StreamRegistry：两个频道

每个 Session 注册两个独立的 SSE 频道：

```
┌─────────────────────────────────────────────────────────────────┐
│  频道 1：sessionId                                               │
│  ─────────────────────────────────────────────────────          │
│  生命周期: 每轮对话（per-turn）                                   │
│  建立:     POST /messages 时 subscribe()                        │
│  关闭:     每轮结束时 closeSession(sessionId)                    │
│  事件:     text_delta, tool_activity, agent_status, done        │
├─────────────────────────────────────────────────────────────────┤
│  频道 2：`${sessionId}:push`                                    │
│  ─────────────────────────────────────────────────────          │
│  生命周期: 跨轮持久化                                            │
│  建立:     GET /sessions/:id/events 时订阅                      │
│  关闭:     session 整体销毁时 cleanupSession()                  │
│  事件:     subagent_started, subagent_completed                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 八、断线重连

客户端断开后，使用 `afterSeq` 参数重连：

```
1. Client 在 seq=38 时掉线

2. Client 重连：
   POST /messages
   { "message": "...", "afterSeq": 38 }

3. Controller：
   getEventsSince(sessionId, 38)
   → 返回 seq 39, 40, 41 ... (EventBuffer 最多缓存 200 条)
   → 立即 replay 给客户端

4. 新事件继续实时推送
```

---

## 九、completionPromise 状态机

```
orchestrateMessage() 开始
        │
        ▼
   创建 completionPromise
   Promise.race([
     basePromise,       ← onEvent(terminal) 时 resolve
     timeoutPromise     ← 10 分钟后 resolve，.unref() 避免阻塞进程退出
   ])
        │
        ▼
   await completionPromise
        │
   ┌────┴────────────────────────────────────────────┐
   │                                                  │
   ▼                                                  ▼
 正常结束                                         异常/超时
   │                                                  │
   ├─ CLI exit code 0 → onEvent(complete)            ├─ CLI rejected → .catch → resolveCompletion()
   ├─ CLI exit code ≠0 → onEvent(error)              ├─ SIGTERM/SIGKILL → onEvent(cancelled)
   └─ wasCancelled    → onEvent(cancelled)            └─ 10分钟无响应   → timeout resolve
        │                                                  │
        └────────────────┬─────────────────────────────────┘
                         │
                    resolveCompletion()
                    （幂等：首次调用有效，后续 no-op）
                         │
                         ▼
                 completionPromise resolves
                         │
                         ▼
              Controller: streamRegistry.closeSession()
                 → emit done → res.end()
```

---

## 十、关键设计决策

| 决策 | 原因 |
|------|------|
| 用 `Promise.race` 而非裸 Promise | 10 分钟超时兜底，防止 AgentEngine 假死导致 HTTP 连接永久泄露 |
| `resolveCompletion()` 幂等 | `complete` + `timeout` 竞争时，第二次调用安全忽略 |
| `handleCLIClose` 的 cancelled 分支必须调用 `onEvent` | REST cancel 没有 WebSocket，只有 `onEvent` 回调能触发 `resolveCompletion()` |
| `.catch` on fire-and-forget | CLI spawn 失败时，`void promise` 会静默吞掉错误并永久阻塞 |
| `timer.unref()` | 10 分钟定时器不应阻止 Node.js 进程优雅退出 |
| Synthetic clientId `sse:${sessionId}` | SSE 模式无 WebSocket 连接，需要一个稳定的 clientId 标识 |
| EventBuffer 最多 200 条 | 断线重连场景足够，同时防止内存无限增长 |
| 两个 SSE 频道 | per-turn 频道随对话关闭；push 频道跨轮持久化（后台任务通知） |

---

## 十一、相关文件速查

| 文件 | 关键方法 | 行号 |
|------|----------|------|
| `sessions/sessions.controller.ts` | `sendMessage()` | ~179–318 |
| `sessions/sessions.controller.ts` | `cancelTurn()` | ~370–397 |
| `sessions/services/stream-registry.service.ts` | `subscribe()`, `emit()`, `closeSession()`, `getEventsSince()` | — |
| `sessions/services/completion-orchestration.service.ts` | `orchestrateMessage()` | ~122–410 |
| `sessions/services/cli-process.service.ts` | `ensureCLIProcess()`, `handleCLIClose()`, `cancelSession()` | 51–387 |
| `sessions/event-mapper.service.ts` | `mapToFrontendEvents()` | ~216–927 |

---

## 另见

- [AgentEngine 生命周期详解](./AGENT_ENGINE_LIFECYCLE.md) — CLI 进程管理的更多细节
- [ADR-0004: 单入口消息处理](../adr/0004-single-entry-point-for-messages.md) — 为什么 WebSocket 和 REST 共用同一个 Orchestration Service
