# 5 分钟快速体验

本指南帮助你快速体验即见Agentic 的核心功能。

## 启动服务

```bash
# 安装依赖并构建
npm install && npm run build:common

# 启动后端
npm run dev:backend
```

## 验证服务运行

```bash
curl http://localhost:3001/api/v1/chat/health
# 返回: { "status": "ok" }
```

## 体验 CCAAS Demo

最快的方式是运行 CCAAS Demo：

```bash
cd solutions/ccaas-demo
./setup.sh
```

启动完成后，访问 `http://localhost:5179` 即可体验：

1. **聊天交互** —— 在聊天界面输入消息，观察 AI 实时响应
2. **Skill 切换** —— 启用/禁用不同的 Skill，观察 AI 行为变化
3. **文件生成** —— 让 AI 生成文件并下载

## React SDK 快速集成（推荐）

推荐使用 `@kedge-agentic/react-sdk` 与后端交互，无需手动处理 SSE 流或状态管理：

```tsx
import { useAgentConnection, useAgentChat, useAgentStatus, ChatPanel } from '@kedge-agentic/react-sdk'

function App() {
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',  // 必须是绝对 URL
    sessionPrefix: 'my-app'
  })

  const chat = useAgentChat({ connection, tenantId: 'default' })
  const status = useAgentStatus({ connection })

  return (
    <ChatPanel
      messages={chat.messages}
      isProcessing={status.isProcessing}
      connected={connection.connected}
      activeTools={status.activeTools}
      activeSubAgents={status.activeSubAgents}
      onSendMessage={chat.sendMessage}
    />
  )
}
```

SDK 默认使用 SSE transport，自动处理流式解析、重连和状态管理。

## REST API 快速体验

### 健康检查和服务器状态

```bash
# 健康检查（无需认证）
curl http://localhost:3001/api/v1/chat/health

# 服务器状态（无需认证）
curl http://localhost:3001/api/v1/chat/status
```

### 发送消息（SSE 流式响应）

```bash
# 发送消息，接收 SSE 事件流
curl -N -X POST http://localhost:3001/api/v1/sessions/my-session/messages \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "message": "你好，请介绍一下你自己",
    "tenantId": "default"
  }'
```

响应为 SSE 事件流（`text/event-stream`），每个事件格式如下：

```
data: {"type":"agent_status","status":"running","sessionId":"my-session"}

data: {"type":"text_delta","delta":"你好！我是","sessionId":"my-session"}

data: {"type":"text_delta","delta":"即见Agentic AI 助手。","sessionId":"my-session"}

data: {"type":"agent_status","status":"complete","sessionId":"my-session"}
```

### 取消正在执行的任务

```bash
curl -X POST http://localhost:3001/api/v1/sessions/my-session/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "default"
  }'
```

### 订阅后台任务事件（推送频道）

```bash
# 长连接，接收后台子 Agent 的完成通知
curl -N http://localhost:3001/api/v1/sessions/my-session/events \
  -H "Accept: text/event-stream"
```

该端点保持连接，当后台 Task 工具完成时推送 `subagent_completed` 事件。

> 详细 API 文档：[SSE Transport 参考](../api/sse.md)

## 下一步

- 了解 [React SDK 聊天集成](../guide/chat-integration.md) 快速构建 Solution
- 查看 [SSE API 参考](../api/sse.md) 了解所有事件和端点
- 阅读 [最佳实践](../reference/best-practices.md) 避免常见陷阱
