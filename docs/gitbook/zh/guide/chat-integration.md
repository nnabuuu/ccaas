# React SDK 聊天集成

学习如何使用 `@ccaas/react-sdk` 包将 CCAAS 聊天功能集成到您的 React Solution 中。

## 概述

React SDK 提供预构建的组件和 Hooks，用于构建聊天界面，包含以下功能:

- 通过 SSE（Server-Sent Events）实时消息流
- Agent 状态跟踪（工具、思考、待办事项、子 Agent）
- AI 建议与表单同步
- 多种布局模式
- 技能管理

## Transport：SSE（默认）

自 v1.1.0 起，SDK 默认使用 **SSE（Server-Sent Events）作为 transport**。SSE 通过单个 HTTP 连接流式传输 Agent 响应，无需 WebSocket。

> **⚠️ Socket.IO transport 已弃用。** 后端端点 `POST /api/v1/sessions/:id/completion` 返回 **410 Gone**。请使用 SSE（默认）替代。
>
> **后台任务事件（`subagent_completed`）现已支持 SSE 模式。** `useAgentStatus` 在 SSE 模式下自动订阅 `GET /events` 推送频道，无需额外配置。

## 快速开始

```tsx
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  ChatPanel
} from '@ccaas/react-sdk'

function App() {
  // SSE 是默认 transport，无需额外配置
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    sessionPrefix: 'demo'
    // transport: 'sse' 为默认值
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

## 核心概念

### 模块化 Hooks

SDK 使用可组合的 Hooks 处理不同关注点:

- **useAgentConnection** - 连接管理（默认 SSE，无需 WebSocket）
- **useAgentChat** - 消息处理，使用 SSE 流式传输
- **useAgentStatus** - Agent 执行跟踪
- **useChatLayout** - UI 布局状态
- **useSkills** - Solution 技能管理

### 组件

预构建的 UI 组件:

- **ChatPanel** - 完整的聊天界面
- **MessageBubble** - 单条消息显示
- **AgentActivityLine** - 状态栏，带可展开详情
- **OutputUpdateCard** - AI 建议更新，带同步/丢弃操作
- **QuickActions** - 快捷操作按钮
- **SubAgentCard** - 子 Agent 进度跟踪

### 自定义 Hook 模式

提取 Solution 特定逻辑:

```tsx
export function useMySession() {
  const connection = useAgentConnection({...})
  const chat = useAgentChat({ connection, tenantId: 'default' })
  const status = useAgentStatus({ connection })
  const layout = useChatLayout()

  // 添加自定义状态/逻辑
  const [customData, setCustomData] = useState(...)

  return {
    ...connection,
    ...chat,
    ...status,
    ...layout,
    customData
  }
}
```

## 文档

完整的集成指南和示例:

- [聊天集成指南](../../../packages/react-sdk/docs/CHAT_INTEGRATION_GUIDE.md) - 详细教程和示例
- [React SDK README](../../../packages/react-sdk/README.md) - 组件和 Hook API 参考
- [Solution 模板](../../SOLUTION_TEMPLATE.md) - 新 Solution 的模板

## 示例

查看工作示例:

- `solutions/ccaas-demo` - 基础聊天，带文件跟踪
- `solutions/lesson-plan-designer` - 表单同步与输出更新

## 下一步

1. 查看 [聊天集成指南](../../../packages/react-sdk/docs/CHAT_INTEGRATION_GUIDE.md)
2. 复制 [Solution 模板](../../SOLUTION_TEMPLATE.md)
3. 为您的领域定制 Hooks 和组件
4. 添加 Solution 特定功能

## 支持

- [API 参考](../api/README.md) - REST 和 WebSocket API
- [前端集成指南](frontend.md) - 通用前端模式
- [最佳实践](../reference/best-practices.md) - 开发指南
