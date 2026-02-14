# Message Queue P0 APIs - Frontend Integration Guide

## 概述

为消息队列系统添加了前端必需的API，支持队列状态监控和实时更新。

**实现状态**: ✅ Phase 5.1 & 5.2 完成（P0优先级）

## WebSocket 实时事件

### 1. `message_processing_started`

**何时发送**: Worker开始处理队列中的消息时

**数据结构**:
```typescript
{
  queueItemId: string;      // 队列项ID
  sessionId: string;        // 会话ID
  position: number;         // 当前队列位置
  message: string;          // 消息预览（前100字符）
}
```

**前端使用**:
```typescript
socket.on('message_processing_started', (data) => {
  console.log(`开始处理消息 ${data.queueItemId}`);
  setStatus('processing');
  setQueuePosition(data.position);
});
```

**UI建议**:
```tsx
{status === 'processing' && (
  <Alert>
    <Spinner /> 正在处理您的消息...
    {queuePosition > 1 && `还有 ${queuePosition - 1} 条消息在排队`}
  </Alert>
)}
```

---

### 2. `message_processing_completed`

**何时发送**: 消息处理成功完成时

**数据结构**:
```typescript
{
  queueItemId: string;           // 队列项ID
  sessionId: string;             // 会话ID
  userMessageId: string;         // 创建的用户消息ID
  assistantMessageId: string;    // 创建的助手消息ID
  durationMs: number;            // 处理耗时（毫秒）
}
```

**前端使用**:
```typescript
socket.on('message_processing_completed', (data) => {
  console.log(`消息 ${data.queueItemId} 处理完成（耗时 ${data.durationMs}ms）`);
  setStatus('completed');
  // 可以根据 userMessageId/assistantMessageId 定位到具体消息
});
```

**UI建议**:
```tsx
{status === 'completed' && (
  <Alert variant="success">
    <CheckIcon /> 消息处理完成
    <small>耗时 {(durationMs / 1000).toFixed(1)} 秒</small>
  </Alert>
)}
```

---

### 3. `message_processing_failed`

**何时发送**: 消息处理失败时（包括自动重试的失败）

**数据结构**:
```typescript
{
  queueItemId: string;      // 队列项ID
  sessionId: string;        // 会话ID
  error: string;            // 错误信息
  retryCount: number;       // 当前重试次数
  maxRetries: number;       // 最大重试次数
  nextRetryAt: Date | null; // 下次重试时间
  status: 'pending' | 'failed';  // 'pending'=将重试, 'failed'=永久失败
}
```

**前端使用**:
```typescript
socket.on('message_processing_failed', (data) => {
  if (data.status === 'pending') {
    // 将会自动重试
    const retryIn = Math.ceil((new Date(data.nextRetryAt).getTime() - Date.now()) / 1000);
    console.log(`消息失败，${retryIn}秒后重试（${data.retryCount}/${data.maxRetries}）`);
    setStatus('retrying');
    setRetryInfo({ count: data.retryCount, max: data.maxRetries, nextRetry: data.nextRetryAt });
  } else {
    // 永久失败
    console.error(`消息永久失败: ${data.error}`);
    setStatus('failed');
    setError(data.error);
  }
});
```

**UI建议**:
```tsx
{status === 'retrying' && (
  <Alert variant="warning">
    <RefreshIcon /> 处理失败，正在重试...
    <small>
      第 {retryInfo.count}/{retryInfo.max} 次重试
      {retryInfo.nextRetry && `（${getRetryCountdown(retryInfo.nextRetry)}后重试）`}
    </small>
  </Alert>
)}

{status === 'failed' && (
  <Alert variant="error">
    <ErrorIcon /> 处理失败（已达最大重试次数）
    <details>
      <summary>错误详情</summary>
      <code>{error}</code>
    </details>
  </Alert>
)}
```

---

## REST API

### 1. GET `/api/v1/sessions/:sessionId/queue`

**功能**: 获取会话的队列状态和消息列表

**使用场景**:
- 页面刷新后恢复队列状态
- 显示"您有X条消息在排队"
- 查看队列历史

**请求**:
```bash
curl http://localhost:3001/api/v1/sessions/session-123/queue
```

**响应**:
```json
{
  "total": 3,
  "pending": 2,
  "processing": 1,
  "items": [
    {
      "id": "queue-1",
      "status": "processing",
      "message": "Design a lesson plan for grade 5 math about fractions...",
      "priority": 0,
      "retryCount": 0,
      "maxRetries": 2,
      "nextRetryAt": null,
      "createdAt": "2026-02-14T10:00:00Z",
      "startedAt": "2026-02-14T10:00:05Z",
      "error": null
    },
    {
      "id": "queue-2",
      "status": "pending",
      "message": "Create a quiz based on the lesson plan...",
      "priority": 0,
      "retryCount": 0,
      "maxRetries": 2,
      "nextRetryAt": null,
      "createdAt": "2026-02-14T10:00:10Z",
      "startedAt": null,
      "error": null
    }
  ]
}
```

**前端使用**:
```typescript
// 页面加载时恢复状态
useEffect(() => {
  const fetchQueueStatus = async () => {
    const response = await fetch(`/api/v1/sessions/${sessionId}/queue`);
    const data = await response.json();
    setQueueDepth({ total: data.total, pending: data.pending, processing: data.processing });
    setQueueItems(data.items);
  };

  fetchQueueStatus();
}, [sessionId]);
```

**React Hook示例**:
```typescript
function useQueueStatus(sessionId: string) {
  const [queueStatus, setQueueStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/sessions/${sessionId}/queue`)
      .then(res => res.json())
      .then(data => {
        setQueueStatus(data);
        setLoading(false);
      });
  }, [sessionId]);

  return { queueStatus, loading };
}
```

---

### 2. GET `/api/v1/queue/:queueItemId`

**功能**: 获取单个队列消息的详细信息

**使用场景**:
- 检查特定消息的状态
- 查看失败原因
- 显示处理耗时

**请求**:
```bash
curl http://localhost:3001/api/v1/queue/queue-1
```

**响应**:
```json
{
  "id": "queue-1",
  "sessionId": "session-1",
  "status": "completed",
  "message": "Design a lesson plan for grade 5 math about fractions and decimals. Include learning objectives, activities, and assessment methods.",
  "priority": 0,
  "retryCount": 0,
  "maxRetries": 2,
  "nextRetryAt": null,
  "createdAt": "2026-02-14T10:00:00Z",
  "startedAt": "2026-02-14T10:00:05Z",
  "completedAt": "2026-02-14T10:02:30Z",
  "durationMs": 145000,
  "userMessageId": "msg-user-1",
  "assistantMessageId": "msg-assistant-1",
  "error": null
}
```

**前端使用**:
```typescript
// 轮询检查消息状态
const checkMessageStatus = async (queueItemId: string) => {
  const response = await fetch(`/api/v1/queue/${queueItemId}`);
  const data = await response.json();

  if (data.status === 'completed') {
    console.log(`消息完成，耗时 ${data.durationMs}ms`);
    return data;
  } else if (data.status === 'failed') {
    console.error(`消息失败: ${data.error}`);
    throw new Error(data.error);
  } else {
    // 仍在处理中，继续等待
    return null;
  }
};
```

---

## 配置

### 环境变量 (`.env`)

```bash
# 消息队列功能开关（默认关闭，安全渐进式发布）
MESSAGE_QUEUE_ENABLED=false

# Worker轮询间隔（毫秒）
MESSAGE_QUEUE_POLL_INTERVAL_MS=1000

# 最大并发消息数（跨所有会话）
MESSAGE_QUEUE_CONCURRENCY=5

# 失败后最大重试次数
MESSAGE_QUEUE_MAX_RETRIES=2
```

### 开启消息队列

**开发环境**:
```bash
# .env
MESSAGE_QUEUE_ENABLED=true
```

**生产环境** (渐进式发布):
```bash
# Step 1: Staging测试
export MESSAGE_QUEUE_ENABLED=true

# Step 2: 10% 流量
# 使用tenant过滤或A/B测试框架

# Step 3: 100% 流量
# 全面开启
```

---

## 向后兼容性

### ✅ 完全向后兼容

1. **WebSocket事件**:
   - 只在 `MESSAGE_QUEUE_ENABLED=true` 时发送
   - 旧版前端忽略新事件，继续正常工作
   - 新版前端可选择性监听

2. **REST API**:
   - 新增endpoints不影响现有API
   - `MESSAGE_QUEUE_ENABLED=false` 时返回空数据
   - 前端不调用就无影响

3. **现有事件**:
   - `agent_status: running` 仍然发送
   - `queue_status` 在enqueue时发送（仅feature开启时）
   - `cancel_response` 包含 `cancelledQueueMessages` 字段

---

## 前端集成示例

### React组件示例

```tsx
import { useState, useEffect } from 'react';
import { useAgentChat } from '@ccaas/react-sdk';

function ChatWithQueueStatus({ sessionId, serverUrl }) {
  const chat = useAgentChat({ sessionId, serverUrl });
  const [queueStatus, setQueueStatus] = useState(null);

  // 监听队列事件
  useEffect(() => {
    if (!chat.socket) return;

    chat.socket.on('message_processing_started', (data) => {
      console.log('开始处理:', data);
      setQueueStatus({ status: 'processing', data });
    });

    chat.socket.on('message_processing_completed', (data) => {
      console.log('处理完成:', data);
      setQueueStatus({ status: 'completed', data });
    });

    chat.socket.on('message_processing_failed', (data) => {
      console.log('处理失败:', data);
      setQueueStatus({ status: 'failed', data });
    });

    return () => {
      chat.socket.off('message_processing_started');
      chat.socket.off('message_processing_completed');
      chat.socket.off('message_processing_failed');
    };
  }, [chat.socket]);

  // 页面加载时获取队列状态
  useEffect(() => {
    fetch(`${serverUrl}/api/v1/sessions/${sessionId}/queue`)
      .then(res => res.json())
      .then(data => {
        if (data.total > 0) {
          setQueueStatus({ status: 'queue', data });
        }
      });
  }, [sessionId, serverUrl]);

  return (
    <div>
      {queueStatus?.status === 'processing' && (
        <Alert>
          <Spinner /> 正在处理您的消息...
        </Alert>
      )}

      {queueStatus?.status === 'queue' && queueStatus.data.pending > 0 && (
        <Alert>
          您有 {queueStatus.data.pending} 条消息在排队
        </Alert>
      )}

      <ChatPanel {...chat} />
    </div>
  );
}
```

### Vue组件示例

```vue
<template>
  <div>
    <Alert v-if="queueStatus === 'processing'">
      <Spinner /> 正在处理您的消息...
    </Alert>

    <Alert v-if="queueDepth.pending > 0">
      您有 {{ queueDepth.pending }} 条消息在排队
    </Alert>

    <ChatPanel v-bind="chat" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useAgentChat } from '@ccaas/vue-sdk';

const props = defineProps(['sessionId', 'serverUrl']);
const chat = useAgentChat({ sessionId: props.sessionId, serverUrl: props.serverUrl });
const queueStatus = ref(null);
const queueDepth = ref({ total: 0, pending: 0, processing: 0 });

onMounted(() => {
  // 监听队列事件
  chat.socket.value?.on('message_processing_started', (data) => {
    queueStatus.value = 'processing';
  });

  chat.socket.value?.on('message_processing_completed', (data) => {
    queueStatus.value = 'completed';
  });

  // 获取初始队列状态
  fetch(`${props.serverUrl}/api/v1/sessions/${props.sessionId}/queue`)
    .then(res => res.json())
    .then(data => {
      queueDepth.value = { total: data.total, pending: data.pending, processing: data.processing };
    });
});

onUnmounted(() => {
  chat.socket.value?.off('message_processing_started');
  chat.socket.value?.off('message_processing_completed');
});
</script>
```

---

## 测试

### 手动测试

```bash
# 1. 启动后端（开启队列）
cd packages/backend
MESSAGE_QUEUE_ENABLED=true npm run start:dev

# 2. 测试REST API
curl http://localhost:3001/api/v1/sessions/test-session/queue

# 3. 测试WebSocket（使用前端或wscat）
wscat -c ws://localhost:3001
> {"type":"chat","sessionId":"test","message":"Hello"}
# 应该收到 queue_status, message_processing_started, message_processing_completed 事件
```

### 集成测试（TODO）

```typescript
describe('Message Queue API', () => {
  it('should emit processing events in correct order', async () => {
    const events = [];
    socket.on('queue_status', (data) => events.push({ type: 'queue_status', data }));
    socket.on('message_processing_started', (data) => events.push({ type: 'started', data }));
    socket.on('message_processing_completed', (data) => events.push({ type: 'completed', data }));

    socket.emit('chat', { sessionId: 'test', message: 'Hello' });

    await waitFor(() => events.length === 3);

    expect(events[0].type).toBe('queue_status');
    expect(events[1].type).toBe('started');
    expect(events[2].type).toBe('completed');
  });

  it('should return queue status via REST API', async () => {
    // 发送3条消息
    socket.emit('chat', { sessionId: 'test', message: 'Message 1' });
    socket.emit('chat', { sessionId: 'test', message: 'Message 2' });
    socket.emit('chat', { sessionId: 'test', message: 'Message 3' });

    // 查询队列状态
    const response = await fetch('/api/v1/sessions/test/queue');
    const data = await response.json();

    expect(data.total).toBeGreaterThan(0);
    expect(data.items).toHaveLength(data.total);
  });
});
```

---

## 下一步（Phase 5.3）

1. **react-sdk集成** ⏳
   - 添加 `useQueueStatus(sessionId)` hook
   - 自动监听队列事件
   - 提供队列状态管理

2. **vue-sdk集成** ⏳
   - 添加 `useQueueStatus(sessionId)` composable
   - 响应式队列状态
   - 自动事件监听

3. **UI组件** ⏳
   - `<QueueStatus>` - 队列状态指示器
   - `<MessageQueueItem>` - 单个队列消息展示
   - `<RetryIndicator>` - 重试倒计时

4. **完整集成测试** ⏳
   - E2E测试队列流程
   - 压力测试（100条并发消息）
   - 重试逻辑测试

---

## FAQ

**Q: MESSAGE_QUEUE_ENABLED=false时会发生什么？**

A:
- WebSocket事件：不发送任何队列相关事件
- REST API：返回空数据（`{total:0, pending:0, processing:0, items:[]}`）
- 聊天功能：走旧路径，直接orchestration（立即处理）

**Q: 前端如何判断队列功能是否开启？**

A:
1. 发送消息后检查是否收到 `queue_status` 事件
2. 或调用 `GET /api/v1/sessions/:id/queue`，如果返回非空数据说明开启

**Q: 如果用户快速发送10条消息会怎样？**

A:
- 全部入队（10个queue items）
- Worker每秒轮询1次，每次处理1条（session级FIFO）
- 大约需要10秒全部处理完
- 前端会收到10次 `started` → `completed` 事件

**Q: 消息失败后会自动重试吗？**

A:
- 是的，默认最多重试2次
- 重试间隔：1s, 2s, 4s（指数退避）
- 前端会收到 `message_processing_failed` 事件（status='pending'表示将重试）
- 如果3次全失败，收到 `message_processing_failed` 事件（status='failed'表示永久失败）

---

## 相关文档

- **实现文档**: [MESSAGE_QUEUE_IMPLEMENTATION.md](./MESSAGE_QUEUE_IMPLEMENTATION.md)
- **架构设计**: Phase 1-4 完整设计
- **配置说明**: `.env.example.nestjs`
- **API文档**: Swagger (http://localhost:3001/api/docs)
