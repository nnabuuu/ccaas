# Message Queue Status - Frontend Integration Guide

本指南说明如何在 Solution 前端集成消息队列状态功能。

## 概述

消息队列系统提供：
- **FIFO 处理**: 每个 session 的消息按顺序处理
- **实时状态更新**: WebSocket 事件推送队列状态
- **重试机制**: 失败消息自动重试（指数退避）
- **队列深度监控**: 实时显示队列中的消息数量

---

## React Integration

### 1. 基本使用

```tsx
import { useAgentConnection, useQueueStatus, QueueStatusIndicator } from '@ccaas/react-sdk'

function MyApp() {
  // 1. 建立 WebSocket 连接
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',  // Core CCAAS backend
  })

  // 2. 监控队列状态
  const queue = useQueueStatus({
    socket: connection.socket,
    sessionId: connection.sessionId,
    serverUrl: connection.serverUrl,
  })

  return (
    <div>
      {/* 3. 显示队列状态 */}
      <QueueStatusIndicator
        processingStatus={queue.processingStatus}
        queueDepth={queue.queueDepth}
        showDetails
      />

      {/* 你的其他 UI */}
    </div>
  )
}
```

### 2. 自定义 UI

如果不想使用内置的 QueueStatusIndicator 组件，可以直接使用 hook 数据：

```tsx
function CustomQueueStatus() {
  const queue = useQueueStatus({
    socket: connection.socket,
    sessionId: connection.sessionId,
    serverUrl: connection.serverUrl,
  })

  // 根据状态显示不同的 UI
  if (queue.processingStatus.status === 'idle' && queue.queueDepth.total === 0) {
    return null  // 队列为空，不显示
  }

  return (
    <div className="queue-status">
      {/* 处理中状态 */}
      {queue.processingStatus.status === 'processing' && (
        <div className="flex items-center gap-2">
          <Spinner />
          <span>正在处理消息 {queue.processingStatus.position}...</span>
        </div>
      )}

      {/* 重试状态 */}
      {queue.processingStatus.status === 'retrying' && (
        <div className="flex items-center gap-2 text-yellow-600">
          <RefreshIcon />
          <span>
            重试中 ({queue.processingStatus.retryCount}/{queue.processingStatus.maxRetries})
          </span>
        </div>
      )}

      {/* 失败状态 */}
      {queue.processingStatus.status === 'failed' && (
        <div className="text-red-600">
          <span>处理失败: {queue.processingStatus.error}</span>
        </div>
      )}

      {/* 队列深度 */}
      {queue.queueDepth.pending > 0 && (
        <div className="text-sm text-gray-600">
          队列中还有 {queue.queueDepth.pending} 条消息等待处理
        </div>
      )}
    </div>
  )
}
```

### 3. 队列深度监控（用于显示"排队中"提示）

```tsx
function ChatInput() {
  const queue = useQueueStatus({
    socket: connection.socket,
    sessionId: connection.sessionId,
    serverUrl: connection.serverUrl,
  })

  const isProcessing = queue.queueDepth.processing > 0
  const queuedMessages = queue.queueDepth.pending

  return (
    <div>
      <textarea
        disabled={isProcessing}
        placeholder={
          isProcessing
            ? '正在处理消息...'
            : queuedMessages > 0
            ? `队列中有 ${queuedMessages} 条消息等待处理`
            : '输入你的消息'
        }
      />

      {queuedMessages > 0 && (
        <div className="text-sm text-amber-600">
          提示：你的消息将在队列中的 {queuedMessages} 条消息处理完后开始处理
        </div>
      )}
    </div>
  )
}
```

### 4. 手动刷新队列状态

```tsx
function QueueDebugPanel() {
  const queue = useQueueStatus({
    socket: connection.socket,
    sessionId: connection.sessionId,
    serverUrl: connection.serverUrl,
    autoLoad: true,  // 自动加载队列状态
  })

  return (
    <div>
      <button onClick={queue.refresh}>
        刷新队列状态
      </button>

      <div>
        <h3>队列统计</h3>
        <ul>
          <li>总计: {queue.queueDepth.total}</li>
          <li>等待中: {queue.queueDepth.pending}</li>
          <li>处理中: {queue.queueDepth.processing}</li>
        </ul>
      </div>

      <div>
        <h3>队列项列表</h3>
        {queue.queueItems.map(item => (
          <div key={item.id}>
            {item.status} - {item.message.substring(0, 50)}
          </div>
        ))}
      </div>
    </div>
  )
}
```

### 5. 启用轮询（用于状态恢复）

如果需要定期同步队列状态（例如用户刷新页面后恢复状态）：

```tsx
const queue = useQueueStatus({
  socket: connection.socket,
  sessionId: connection.sessionId,
  serverUrl: connection.serverUrl,
  autoLoad: true,           // 挂载时自动加载
  pollingInterval: 5000,    // 每 5 秒轮询一次（可选）
})
```

**注意**: 通常不需要轮询，因为 WebSocket 事件已经提供实时更新。轮询仅用于：
- 用户刷新页面后恢复状态
- WebSocket 连接不稳定的情况
- 调试和监控

---

## Hook API 参考

### `useQueueStatus(options)`

#### 参数

```typescript
interface UseQueueStatusOptions {
  /** Socket.io 连接（来自 useAgentConnection） */
  socket: Socket | null

  /** Session ID */
  sessionId: string

  /** Backend 服务器 URL（用于 REST API 调用） */
  serverUrl: string

  /** 是否在挂载时自动加载队列状态（默认: true） */
  autoLoad?: boolean

  /** 轮询间隔（毫秒），0 表示不轮询（默认: 0） */
  pollingInterval?: number
}
```

#### 返回值

```typescript
interface UseQueueStatusReturn {
  /** 当前处理状态 */
  processingStatus: ProcessingStatus

  /** 队列深度（总计、等待中、处理中） */
  queueDepth: QueueDepth

  /** 队列项列表（仅活跃项） */
  queueItems: QueueItem[]

  /** 初次加载状态 */
  loading: boolean

  /** 错误状态 */
  error: Error | null

  /** 手动刷新队列状态 */
  refresh: () => Promise<void>

  /** 获取特定队列项的详细信息 */
  getQueueItem: (queueItemId: string) => Promise<QueueItem | null>
}
```

#### 处理状态类型

```typescript
interface ProcessingStatus {
  /** 状态: idle | processing | retrying | completed | failed */
  status: 'idle' | 'processing' | 'retrying' | 'completed' | 'failed'

  /** 队列项 ID */
  queueItemId?: string

  /** 队列中的位置 */
  position?: number

  /** 重试次数 */
  retryCount?: number

  /** 最大重试次数 */
  maxRetries?: number

  /** 下次重试时间 */
  nextRetryAt?: Date | null

  /** 错误消息（如果失败） */
  error?: string

  /** 处理耗时（毫秒） */
  durationMs?: number
}
```

#### 队列深度类型

```typescript
interface QueueDepth {
  /** 队列中总消息数（等待中 + 处理中） */
  total: number

  /** 等待处理的消息数 */
  pending: number

  /** 正在处理的消息数 */
  processing: number
}
```

---

## QueueStatusIndicator 组件

### Props

```typescript
interface QueueStatusIndicatorProps {
  /** 当前处理状态 */
  processingStatus: ProcessingStatus

  /** 队列深度统计 */
  queueDepth: QueueDepth

  /** 自定义样式类名 */
  className?: string

  /** 是否显示详细信息（默认: false） */
  showDetails?: boolean
}
```

### 状态视觉指示

| 状态 | 图标 | 颜色 | 标签 |
|------|------|------|------|
| idle | ⏸️ | 灰色 | 等待中 |
| processing | ⚙️ | 蓝色 | 处理中 |
| retrying | 🔄 | 黄色 | 重试中 |
| completed | ✅ | 绿色 | 已完成 |
| failed | ❌ | 红色 | 失败 |

### 详细信息（showDetails=true）

当 `showDetails` 为 true 时，组件会显示：
- **队列深度**: "队列: 2 待处理 / 1 处理中"
- **重试信息**: "重试 1/2"
- **处理耗时**: "耗时 5.2秒"
- **错误信息**: "错误: Connection timeout"

---

## WebSocket 事件说明

Hook 自动监听以下 WebSocket 事件（你**不需要**手动监听）：

### 1. `queue_status`

消息入队时发送，包含队列的初始状态。

```typescript
interface QueueStatusEvent {
  queueItemId: string  // 队列项 ID
  position: number     // 队列中的位置
  pending: number      // 等待处理数量
  processing: number   // 正在处理数量
}
```

### 2. `message_processing_started`

消息开始处理时发送。

```typescript
interface MessageProcessingStartedEvent {
  queueItemId: string   // 队列项 ID
  sessionId: string     // Session ID
  position: number      // 队列中的位置
  message: string       // 消息内容（前 100 字符）
}
```

### 3. `message_processing_completed`

消息处理成功完成时发送。

```typescript
interface MessageProcessingCompletedEvent {
  queueItemId: string         // 队列项 ID
  sessionId: string           // Session ID
  userMessageId: string       // 用户消息 ID
  assistantMessageId: string  // 助手回复消息 ID
  durationMs: number          // 处理耗时（毫秒）
}
```

### 4. `message_processing_failed`

消息处理失败时发送（包含重试信息）。

```typescript
interface MessageProcessingFailedEvent {
  queueItemId: string      // 队列项 ID
  sessionId: string        // Session ID
  error: string            // 错误消息
  retryCount: number       // 当前重试次数
  maxRetries: number       // 最大重试次数
  nextRetryAt: Date | null // 下次重试时间
  status: 'pending' | 'failed'  // 'pending' = 将重试, 'failed' = 永久失败
}
```

---

## REST API 参考

Hook 使用以下 REST API 获取队列状态（你**通常不需要**直接调用）：

### GET `/api/v1/sessions/:sessionId/queue`

获取 session 的队列状态。

**响应**:
```json
{
  "total": 3,
  "pending": 2,
  "processing": 1,
  "items": [
    {
      "id": "queue-item-123",
      "sessionId": "session-456",
      "status": "processing",
      "message": "Design a lesson plan for...",
      "priority": 0,
      "retryCount": 0,
      "maxRetries": 2,
      "createdAt": "2026-02-14T10:00:00Z",
      "startedAt": "2026-02-14T10:00:05Z"
    }
  ]
}
```

### GET `/api/v1/queue/:queueItemId`

获取特定队列项的详细信息。

**响应**:
```json
{
  "id": "queue-item-123",
  "sessionId": "session-456",
  "status": "completed",
  "message": "Design a lesson plan for...",
  "priority": 0,
  "retryCount": 0,
  "maxRetries": 2,
  "createdAt": "2026-02-14T10:00:00Z",
  "startedAt": "2026-02-14T10:00:05Z",
  "completedAt": "2026-02-14T10:00:15Z",
  "durationMs": 10000,
  "userMessageId": "msg-user-789",
  "assistantMessageId": "msg-assistant-012"
}
```

---

## 常见问题

### 1. 什么时候使用队列状态？

**适合的场景**:
- 显示"正在处理"状态，避免用户重复发送消息
- 显示队列深度，告知用户还有多少消息等待处理
- 实现"取消"按钮（配合 `connection.cancelSession()`）
- 监控重试状态，显示错误提示

**不需要的场景**:
- 如果只是简单的聊天 UI，基本的 loading 状态就够了
- 如果用户不需要看到队列深度或重试信息

### 2. 队列状态和消息状态有什么区别？

- **队列状态**: 消息在**队列中**的状态（pending, processing, completed, failed）
- **消息状态**: 消息的**聊天内容**状态（用户消息、助手回复、流式更新）

两者是独立的：
- 队列状态由 `useQueueStatus` 管理
- 消息内容由 `useAgentChat` 管理

### 3. 如何禁用消息队列？

消息队列由 backend 的 `MESSAGE_QUEUE_ENABLED` 环境变量控制：

```bash
# .env
MESSAGE_QUEUE_ENABLED=false  # 禁用队列，使用直接处理模式
```

前端代码**不需要修改**，hook 会自动适配：
- 队列启用: 显示队列状态
- 队列禁用: 队列深度始终为 0，状态为 idle

### 4. 轮询会影响性能吗？

通常**不需要轮询**，因为 WebSocket 已经提供实时更新。

如果启用轮询（`pollingInterval > 0`）：
- 每次轮询都会发起 HTTP 请求到 backend
- 建议间隔不小于 5000ms（5 秒）
- 仅用于状态恢复和调试

### 5. 队列项列表（queueItems）有什么用？

默认情况下你**不需要**使用 `queueItems`，只需要：
- `processingStatus` - 当前处理状态
- `queueDepth` - 队列深度

`queueItems` 适用于**调试面板**或**管理界面**，显示队列中所有消息的详细信息。

---

## 迁移指南

### 从无队列状态迁移

**之前（无队列状态）**:
```tsx
function MyApp() {
  const connection = useAgentConnection({ ... })
  const chat = useAgentChat({ connection })

  return (
    <div>
      {chat.isProcessing && <Spinner />}
      <ChatPanel {...chat} />
    </div>
  )
}
```

**之后（添加队列状态）**:
```tsx
function MyApp() {
  const connection = useAgentConnection({ ... })
  const chat = useAgentChat({ connection })
  const queue = useQueueStatus({
    socket: connection.socket,
    sessionId: connection.sessionId,
    serverUrl: connection.serverUrl,
  })

  return (
    <div>
      {/* 用队列状态替换简单的 Spinner */}
      <QueueStatusIndicator
        processingStatus={queue.processingStatus}
        queueDepth={queue.queueDepth}
        showDetails
      />

      <ChatPanel {...chat} />
    </div>
  )
}
```

**改动最小化**: 只需添加 3 行代码（import, hook, component）即可完成集成。

---

## 示例代码

完整示例请参考:
- `solutions/lesson-plan-designer/frontend/src/App.tsx` - 课程设计工具集成示例
- `solutions/quiz-analyzer/frontend/src/App.tsx` - 测验分析工具集成示例

---

## 技术细节

### 重试机制

- **指数退避**: 1s, 2s, 4s, 8s, 16s, 最大 30s
- **最大重试次数**: 默认 2 次（可在 backend 配置）
- **重试状态**: `processingStatus.status === 'retrying'`
- **永久失败**: 超过最大重试次数后，`status === 'failed'`

### 队列优先级

- 所有消息默认 `priority = 0`
- 未来可支持高优先级消息（例如取消请求）

### 并发控制

- **每个 session**: 同时最多处理 **1 条消息**（FIFO）
- **全局**: 同时最多处理 **5 条消息**（跨 sessions）

### 状态持久化

- 队列项存储在 SQLite 数据库（`message_queue` 表）
- 即使 backend 重启，队列项也会保留
- Worker 恢复后会继续处理未完成的消息
