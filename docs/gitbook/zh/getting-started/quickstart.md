# 5 分钟快速体验

本指南帮助你快速体验即见Agentic 的核心功能。

## 启动服务

```bash
# 安装依赖并构建
npm install && npm run build:shared

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

## REST API 快速体验

### 健康检查和服务器状态

```bash
# 健康检查（无需认证）
curl http://localhost:3001/api/v1/chat/health

# 服务器状态（无需认证）
curl http://localhost:3001/api/v1/chat/status
```

### 发送消息（推荐使用 SDK）

> **💡 提示**: 直接调用 REST API 需要同时管理 WebSocket 连接。推荐使用 `@ccaas/react-sdk` 或 `@ccaas/vue-sdk` 进行集成。

如果你确实需要直接调用 API：

```bash
# 需要先建立 WebSocket 连接，否则收不到响应事件
curl -X POST http://localhost:3001/api/v1/sessions/my-session/completion \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "test-client-001",
    "message": "你好，请介绍一下你自己",
    "tenantId": "default"
  }'
```

### 取消正在执行的任务

```bash
curl -X DELETE http://localhost:3001/api/v1/sessions/my-session/completion \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "test-client-001"
  }'
```

## WebSocket 连接体验

使用任意 WebSocket 客户端连接 `ws://localhost:3001`：

```javascript
import { io } from 'socket.io-client'

const socket = io('http://localhost:3001')

// 监听 Agent 状态
socket.on('agent_status', (data) => {
  console.log('Agent 状态:', data.status)
})

// 监听文本流
socket.on('text_delta', (data) => {
  process.stdout.write(data.text)
})

// 监听结构化输出
socket.on('output_update', (data) => {
  console.log('输出更新:', data)
})

// 发送消息
socket.emit('chat', {
  message: '请帮我生成一份报告',
  sessionId: 'my-session'
})
```

## 下一步

- 了解 [Solution 开发完整指南](../guide/solution-dev.md) 构建自己的应用
- 查看 [API 参考](../api/) 了解所有可用接口
- 阅读 [最佳实践](../reference/best-practices.md) 避免常见陷阱
