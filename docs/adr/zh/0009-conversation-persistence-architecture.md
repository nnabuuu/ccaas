# ADR-0009: 会话持久化架构

**状态**: 已实施
**决策日期**: 2026-02-15
**实施日期**: 2026-02-15
**决策人**: @niex
**相关问题**: 会话持久化阶段 1

---

## 背景 (上下文)

CCAAS 最初将会话视为临时运行时进程。每次页面加载都会生成一个新的 `sessionId`，并且在浏览器刷新后不会保留消息历史。与现代 AI 聊天应用程序 (ChatGPT, Claude.ai) 相比，这造成了糟糕的用户体验，用户期望:

- 会话在页面刷新后存活
- 返回会话时消息历史可见
- 用户可以明确开始"新会话"

关键挑战是 CCAAS 已经有一个与运行时进程生命周期绑定的 `Session` 实体 (AgentEngine 进程，30 分钟空闲 TTL)。我们需要在不与现有运行时会话语义冲突的情况下引入会话持久化。

---

## 决策

**我们决定**: 采用"会话优先"设计，其中用户端的 `conversationId` 是主要标识符，持久化在租户作用域的 localStorage 中，在重新连接时自动恢复消息历史。

**关键设计选择**:

1. **ConversationId 格式**: 提供 `solutionId` 时为 `conv_${uuid}`; 为了向后兼容回退到 `${sessionPrefix}_${uuid}`
2. **存储**: 租户作用域的 localStorage 键 `ccaas_session_${solutionId}` 在页面刷新后持久化 conversationId
3. **历史加载**: `useAgentChat` 在连接时通过 `GET /api/v1/sessions/:id/messages?limit=100` 自动获取消息历史
4. **新会话**: `clearConversation()` 清除 localStorage，生成新的 `conv_${uuid}`，断开连接并使用新状态重新连接
5. **向后兼容**: 当未提供 `solutionId` 时，SDK 的行为与之前完全相同 (无持久化)

---

## 考虑的替代方案

### 方案 A: 纯基于会话 (现状)

**描述**: 保持会话临时，无持久化。

**优点**:
- 不需要更改
- 简单的心智模型

**缺点**:
- 糟糕的用户体验 - 每次刷新都会丢失会话
- 没有会话历史
- 不符合现代 AI 聊天应用的用户期望

**未选择原因**: 生产使用的用户体验不可接受。

---

### 方案 B: 独立的会话实体

**描述**: 创建与 `Session` 不同的专用 `Conversation` 实体。

**优点**:
- 清晰的关注点分离
- 会话可以跨越多个会话
- 支持会话标题、固定、归档

**缺点**:
- 重大的后端重构
- 复杂的迁移路径
- 需要管理两个 ID (conversationId + sessionId)

**未选择原因**: 对于阶段 1 来说过度设计。现有的 Session 实体只需最小更改即可携带会话元数据。

---

### 方案 C: 重用带租户作用域持久化的 Session (已选择)

**描述**: 向 `useAgentConnection` 添加 `solutionId`，在 localStorage 中持久化 sessionId，自动加载消息历史。

**优点**:
- 最小的后端更改 (向现有 Session 实体添加列)
- 前端驱动 - SDK 透明地处理持久化
- 向后兼容 - 通过 `solutionId` 选择加入
- 立即与现有后端 API 配合使用

**缺点**:
- Session 实体同时携带运行时和会话语义
- localStorage 有 XSS 暴露风险 (通过仅存储 ID 而不是消息来缓解)

**选择原因**: 用户体验改进、实施工作量和向后兼容性的最佳平衡。

---

## 后果

### 积极影响
- 用户可以刷新页面并继续他们的会话
- 重新连接时消息历史自动加载
- 解决方案通过单个 `solutionId` 参数选择加入
- 对于不使用 `solutionId` 的现有解决方案零破坏性变更

### 消极影响
- Session 实体现在携带双重语义 (运行时进程 + 会话)
- localStorage 依赖意味着会话是设备/浏览器特定的

### 重要说明
- `conv_${uuid}` 格式清楚地将持久会话与旧版会话区分开来
- RuntimeSession TTL (30 分钟空闲) 独立于会话持久化; 会话可以跨越多个运行时会话
- 消息历史限制为 100 条，防止长会话的性能问题
- 未来阶段可以通过后端 API 添加会话列表、搜索和跨设备同步

---

## 实施指南

**前端集成 (2 行更改)**:

```typescript
// 之前 (临时)
const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',
  sessionPrefix: 'my-app',
})

// 之后 (持久)
const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',
  solutionId: 'my-app',
})
```

**新会话按钮**:
```typescript
const chat = useAgentChat({ connection, solutionId: 'my-app' })

// 开始新会话 (清除存储，新 sessionId，重新连接)
chat.clearConversation()
```

**加载状态**:
```typescript
// 加载历史时显示加载器
if (chat.isLoadingHistory) {
  return <Spinner />
}
```

**检查清单**:
- [ ] 在 `useAgentConnection` 中用 `solutionId` 替换 `sessionPrefix`
- [ ] 添加调用 `chat.clearConversation()` 的"新会话"按钮
- [ ] 在 `chat.isLoadingHistory` 为 true 时显示加载状态
- [ ] 测试: 刷新页面，验证消息持久
- [ ] 测试: 点击"新会话"，验证干净状态

---

## 参考资料

### 文档
- **[CONVERSATION_PERSISTENCE_IMPLEMENTATION_STATUS.md](../../zh/CONVERSATION_PERSISTENCE_IMPLEMENTATION_STATUS.md)** - 完整的实施状态、测试覆盖和概念模型 (中文)
- **[CONVERSATION_PERSISTENCE.md](../../zh/CONVERSATION_PERSISTENCE.md)** - 集成指南和架构概述 (中文)

### 实现
- `packages/react-sdk/src/hooks/useAgentConnection.ts` - 租户作用域 localStorage 持久化
- `packages/react-sdk/src/hooks/useAgentChat.ts` - 消息历史自动加载，clearConversation
- `solutions/ccaas-demo/src/hooks/useDemoSession.ts` - 参考集成 (ccaas-demo)
- `solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSession.ts` - 参考集成 (lesson-plan-designer)

---

## 更新历史

- **2026-02-15**: 初始版本 - 阶段 1 会话持久化
- **2026-02-15**: 状态更新为"已实施"，添加中文文档参考
