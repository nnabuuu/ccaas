# 6.7 会话持久化

## 本节目标

在本节中，你将为 Lesson Plan Designer Solution 添加会话持久化功能。完成后，用户可以刷新页面或关闭浏览器，再次访问时依然能看到之前的对话记录。

完成本节后，你将拥有：

- 存储在 CCAAS 后端数据库中的持久化会话
- 页面刷新时自动加载消息历史
- 用于开始新对话的"新会话"按钮
- 租户隔离机制，防止 Solution 之间的会话泄漏

## 理解持久化模型

CCAAS 使用**前端驱动的持久化模型**。核心设计是：浏览器中只存储 `conversationId`，所有消息内容存储在后端数据库中。

```
页面加载
  |
  v
useAgentConnection({ solutionId })
  |
  +--> 检查 localStorage 中的 ccaas_session_{solutionId}
  |      |
  |      +--> 找到: 使用已保存的 conversationId
  |      +--> 未找到: 生成 conv_{uuid}, 保存到 localStorage
  |
  +--> 使用 conversationId 连接 SSE
  |
  v
useAgentChat({ connection, solutionId })
  |
  +--> GET /api/v1/sessions/{conversationId}/messages?limit=100
  |
  +--> 填充 messages[] 状态
  |
  v
用户看到之前的对话
```

### 会话 vs 运行时会话

这两个概念是不同的：

| 概念 | 范围 | 生命周期 | ID 格式 |
|------|------|----------|---------|
| **会话 (Conversation)** | 面向用户，持久化 | 直到用户创建新会话 | `conv_{uuid}` |
| **运行时会话 (RuntimeSession)** | 后端 AgentEngine 进程 | 30 分钟空闲超时 | 内部 |

一个会话可以跨越多个运行时会话。当运行时会话因空闲超时被回收时，同一会话中的下一条消息会创建新的运行时会话，但会话及其消息历史会被保留。

### 租户隔离

每个 `solutionId` 拥有独立的 localStorage 键：

```
localStorage:
  ccaas_session_lesson-plan-designer  -> conv_a1b2c3d4...
  ccaas_session_lesson-plan-designer   -> conv_e5f6g7h8...
```

运行在同一域名下、使用不同 `solutionId` 的两个 Solution 不会共享会话。

## 第 1 步：在 useAgentConnection 中启用持久化

打开你的主会话 hook（或初始化连接的组件），将 `sessionPrefix` 替换为 `solutionId`：

```typescript
// src/hooks/useLessonPlanSession.ts

import {
  useAgentConnection,
  useAgentChat,
} from '@kedge-agentic/react-sdk'

const SOCKET_URL = import.meta.env.VITE_CCAAS_URL || 'http://localhost:3001'

export function useLessonPlanSession() {
  // 通过提供 solutionId 启用持久化
  const connection = useAgentConnection({
    serverUrl: SOCKET_URL,
    solutionId: 'lesson-plan-designer',  // ← 启用持久化
    autoConnect: true,
  })

  const chat = useAgentChat({
    connection,
    solutionId: 'lesson-plan-designer',
  })

  return { connection, chat }
}
```

当提供 `solutionId` 时：
1. SDK 生成一个 `conv_{uuid}` 格式的会话 ID（而不是基于随机前缀的 ID）
2. 会话 ID 保存到 `localStorage`，键名为 `ccaas_session_lesson-plan-designer`
3. 下次页面加载时，SDK 读取该键并使用同一个 `conversationId` 重新连接
4. `useAgentChat` 自动从后端获取消息历史

{% hint style="info" %}
如果省略 `solutionId` 而使用 `sessionPrefix`，会话将是临时的——页面刷新后丢失。这对于原型开发没问题，但不适合生产环境。
{% endhint %}

## 第 2 步：处理加载状态

在获取消息历史期间，`isLoadingHistory` 标志为 `true`。此时应显示加载指示器：

```typescript
// src/components/ChatPanel.tsx

export function ChatPanel() {
  const { chat } = useLessonPlanSession()

  if (chat.isLoadingHistory) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">正在加载对话...</p>
      </div>
    )
  }

  return (
    <div>
      {chat.messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
    </div>
  )
}
```

加载状态很短暂——后端在单次请求中返回最近 100 条消息。加载完成后，消息会立即显示。

## 第 3 步：添加"新会话"按钮

用户需要一种方式来开始新对话。`clearConversation()` 函数负责处理此操作：

```typescript
<button
  onClick={() => chat.clearConversation()}
  className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
>
  新会话
</button>
```

`clearConversation()` 执行三个操作：
1. 清空本地消息数组
2. 从 localStorage 中移除 `conversationId`
3. 生成新的 `conv_{uuid}`，断开连接并重新连接

调用 `clearConversation()` 后，聊天面板将清空并准备好新对话。旧对话仍存储在数据库中，可通过管理 API 访问。

### clearConversation vs clearMessages

| 方法 | 清空 UI | 清空存储 | 重新连接 | 使用场景 |
|------|---------|----------|----------|----------|
| `clearMessages()` | 是 | 否 | 否 | 仅清空显示；同一会话继续 |
| `clearConversation()` | 是 | 是 | 是 | 开始全新的会话 |

## 第 4 步：与 Solution 逻辑集成

在 Lesson Plan Designer 中，你可能希望在用户创建新项目或切换上下文时清除会话。以下是备课方案设计器 Solution 处理此模式的方式：

```typescript
// 当用户创建新项目时，开始新的对话
const createNewProject = useCallback(async (input: CreateProjectInput) => {
  const project = await api.createProject(input)

  // 清空表单状态
  resetFormState()

  // 为这个项目开始新的对话
  chat.clearConversation()

  return project
}, [api, resetFormState, chat])
```

这确保 AI Agent 不会将前一个项目的上下文带入新项目。

## 第 5 步：挂载时强制新会话（可选）

如果你的 Solution 应该始终以新对话开始（例如一次性设置向导），使用 `forceNewConversation`：

```typescript
const connection = useAgentConnection({
  serverUrl: SOCKET_URL,
  solutionId: 'lesson-plan-wizard',
  forceNewConversation: true,  // 始终开始新对话
})
```

这会在挂载时清除所有已保存的 `conversationId` 并生成新的。请谨慎使用——大多数 Solution 都受益于持久化。

## 底层工作原理

### 消息存储

当你发送消息时，后端将其存储在 `messages` 表中：

```
messages 表:
  id          | sessionId         | role      | content              | messageIndex
  msg_001     | conv_a1b2c3d4...  | user      | "创建一个任务..."    | 0
  msg_002     | conv_a1b2c3d4...  | assistant | "好的，我来创建..."  | 1
  msg_003     | conv_a1b2c3d4...  | user      | "设置优先级为高"     | 2
  msg_004     | conv_a1b2c3d4...  | assistant | "完成，优先级..."    | 3
```

消息通过 `sessionId` 和 `messageIndex` 建立索引，以实现快速检索。

### 会话恢复流程

当用户刷新页面时：

1. `useAgentConnection` 从 localStorage 读取 `ccaas_session_lesson-plan-designer`
2. 获取 `conv_a1b2c3d4...` 作为 conversationId
3. 使用此 conversationId 建立 SSE 连接
4. `useAgentChat` 调用 `GET /api/v1/sessions/conv_a1b2c3d4.../messages?limit=100`
5. 后端按时间顺序返回消息
6. 消息填充到 `messages[]` 状态中
7. 用户看到之前的对话

### 运行时会话过期

如果用户在 30 分钟不活动后返回：

1. 旧的运行时会话已被回收（AgentEngine 进程已停止）
2. conversationId (`conv_a1b2c3d4...`) 仍在 localStorage 中
3. SDK 使用相同的 conversationId 重新连接
4. 消息历史从数据库加载
5. 当用户发送新消息时，后端启动新的 AgentEngine 进程
6. AgentEngine 使用 `--resume` 恢复对话上下文

用户不会注意到任何差异——他们看到消息历史并可以无缝继续对话。

### localStorage 安全性

localStorage 中只存储 `conversationId` 字符串，不存储消息内容。这最大限度地降低了 XSS 攻击的风险。SDK 使用安全的包装器来处理：

- localStorage 被禁用（隐私浏览模式）——回退到临时会话
- 存储配额超限——优雅降级
- 权限错误——不会抛出异常

## 会话管理的后端 API

CCAAS 后端提供了用于程序化管理会话的 API：

```
GET    /api/v1/conversations              # 列出会话（分页）
GET    /api/v1/conversations/search       # 按标题搜索
PATCH  /api/v1/conversations/:id          # 更新标题或置顶状态
DELETE /api/v1/conversations/:id          # 软删除
GET    /api/v1/conversations/:id/turns    # 每轮分析数据
```

这些是管理级别的 API，适用于构建会话列表 UI 或分析仪表板。

## 检查点

进入下一节之前，请验证：

- [ ] 发送消息后刷新页面，能看到之前的对话
- [ ] 消息加载期间 `isLoadingHistory` 标志为 `true`，加载后为 `false`
- [ ] 点击"新会话"按钮可以清空聊天并开始新对话
- [ ] 新对话获得不同的 `conv_{uuid}`（检查 localStorage）
- [ ] 使用不同 `solutionId` 的两个 Solution 不会共享会话

## 常见错误

### 1. 使用 sessionPrefix 而不是 solutionId

```typescript
// 错误：没有持久化
const connection = useAgentConnection({
  serverUrl: SOCKET_URL,
  sessionPrefix: 'lesson-plan',
})

// 正确：启用持久化
const connection = useAgentConnection({
  serverUrl: SOCKET_URL,
  solutionId: 'lesson-plan-designer',
})
```

### 2. 忘记处理 isLoadingHistory

如果你不处理加载状态，用户会在消息出现前短暂看到空白的聊天面板。始终显示加载指示器。

### 3. 使用 clearMessages 而不是 clearConversation

`clearMessages()` 只清空 UI。下次页面刷新会重新加载同一个会话。当你想要开始真正的新对话时，请使用 `clearConversation()`。

### 4. 不同 Solution 使用相同的 solutionId

如果两个 Solution 都使用 `solutionId: 'default'`，它们将共享同一个会话。始终为每个 Solution 使用唯一的、描述性的 `solutionId`。

## 本节小结

在本节中你添加了：

- 通过在 `useAgentConnection` 中使用 `solutionId` 实现会话持久化
- 通过 `useAgentChat` 自动加载消息历史
- 使用 `isLoadingHistory` 的加载状态
- 使用 `clearConversation()` 的"新会话"按钮
- 对会话与运行时会话区别的理解

会话持久化是让 CCAAS Solution 从一次性聊天窗口变成真正应用程序的关键。用户可以离开、返回，并从上次中断的地方继续。

---

**下一节：** [7. 部署上线](../07-deployment.md)
**上一节：** [6.6 测试](06-testing.md)
