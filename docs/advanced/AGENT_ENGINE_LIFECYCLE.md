# AgentEngine 生命周期详解

> **Advanced Topic**: 本文档面向需要深入理解 AgentEngine 进程管理的开发者。

## 概述

CCAAS backend 支持多种 AgentEngine 实现：
- **Claude Code** (默认) - Anthropic 官方 CLI
- **OpenCode** - 开源替代方案
- **Custom Engines** - 自研或第三方实现

所有 engine 遵循统一的生命周期管理协议。

## AgentEngine 进程什么时候被 kill？

**简短回答**：
- ❌ **不是**每次消息结束后被 backend kill
- ✅ **AgentEngine 自己会在完成响应后自动退出**
- ⚠️ **Backend 只在以下情况主动 kill 进程**：
  1. 用户点击取消（5秒超时保护）
  2. Session TTL 超时（默认 30 分钟）
  3. Session 达到上限需要清理
  4. 服务器关闭

---

## 详细流程

### 1. 正常消息处理流程

```
用户发送第1条消息
  ↓
Backend spawn AgentEngine 进程 (无 --resume)
  ↓
AgentEngine 处理消息，流式返回响应
  ↓
AgentEngine 完成响应后 **自动退出** ← 重点！
  ↓
Backend 收到 'close' 事件，清理 session.engineProcess
  ↓
session.status = 'idle'

用户发送第2条消息（follow-up）
  ↓
Backend 检测到 engineProcess = null
  ↓
Backend spawn 新 AgentEngine 进程 (用 --resume 恢复上下文)
  ↓
AgentEngine 处理消息，流式返回响应
  ↓
AgentEngine 完成响应后 **自动退出** ← 重点！
  ↓
...循环...
```

### 2. 关键代码证据

#### 进程复用逻辑 (Line 195-198)

```typescript
if (session.engineProcess && session.stdin && !session.engineProcess.killed) {
  this.logger.log(`Reusing AgentEngine for session ${session.sessionId}`);
  this.sendMessageToProcess(session, initialMessage, attachments);
  return;  // 如果进程还活着，直接复用
}

// 如果进程不存在，spawn 新进程
```

**关键点**：代码会**尝试复用**进程，但实际上进程通常已经退出了。

#### Follow-up 消息逻辑 (Line 280-291)

```typescript
if (session.engineProcess && !session.engineProcess.killed && session.stdin) {
  this.logger.log('Reusing existing AgentEngine for follow-up');
  this.sendMessageToProcess(session, message, attachments);
  return;
}

this.logger.log('AgentEngine not running, spawning new with --resume');
// 用 --resume 参数重新 spawn
```

**关键点**：通常会走到 "spawning new with --resume" 分支，说明进程已经不在运行。

---

## 3. Backend 主动 kill 进程的情况

### 情况 1：用户取消操作

```typescript
cancelSession(sessionId: string, onEvent?: (event: any) => void): boolean {
  session.status = 'cancelling';
  session.engineProcess.kill('SIGTERM');  // 发送终止信号

  // 5秒后如果还没退出，强制 SIGKILL
  setTimeout(() => {
    if (session.engineProcess && !session.engineProcess.killed) {
      session.engineProcess.kill('SIGKILL');
    }
  }, 5000);
}
```

**触发**：用户点击取消按钮
**目的**：立即终止正在处理的任务

### 情况 2：Session TTL 超时清理

```typescript
private cleanupIdleSessions(): void {
  const now = Date.now();

  for (const [sessionId, session] of this.sessions) {
    const idleTime = now - session.lastActivity.getTime();

    // 默认 30 分钟超时
    if (idleTime > this.sessionTtlMs && session.status !== 'processing') {
      this.closeSession(sessionId);  // 会 kill 进程
    }
  }
}
```

**触发**：Session 空闲超过 30 分钟（可配置）
**目的**：释放资源

### 情况 3：达到 Session 上限

```typescript
if (this.sessions.size >= this.maxSessions) {
  const cleaned = this.cleanupOldestIdleSession();  // 会 kill 最老的 session
}
```

**触发**：总 session 数达到上限（默认 100）
**目的**：为新 session 腾出空间

### 情况 4：服务器关闭

```typescript
shutdown(): void {
  for (const sessionId of this.sessions.keys()) {
    this.closeSession(sessionId);  // 关闭所有 session
  }
}
```

**触发**：Backend 进程退出
**目的**：优雅关闭

---

## 4. AgentEngine 的设计行为

### 支持的 Engine 类型

#### Claude Code (默认)
```bash
# 第一次运行（新 session）
claude --output-format stream-json

# Engine 处理完消息后自动退出，exit code 0

# 后续运行（恢复 session）
claude --output-format stream-json --resume 'session-123'

# Engine 加载历史上下文，处理完消息后自动退出
```

#### OpenCode
```bash
# 类似协议，使用 opencode 命令
opencode --output-format stream-json --resume 'session-123'
```

#### 自定义 Engine
```bash
# 必须实现相同的协议
custom-engine --output-format stream-json --resume 'session-123'
```

**为什么 AgentEngine 会自动退出？**
- Engine 是无状态的，上下文保存在本地 session 目录
- 每次启动时通过 --resume 加载历史
- 完成响应后退出，释放资源
- 这是 CLI 工具的标准行为模式

### 配置不同的 Engine

在 `.env` 文件中设置：

```bash
# 使用 Claude Code (默认)
AGENT_ENGINE_PATH=claude

# 使用 OpenCode
AGENT_ENGINE_PATH=opencode

# 使用自定义 Engine
AGENT_ENGINE_PATH=/path/to/custom-engine
```

---

## 5. 进程生命周期时间线

### 正常场景

```
T=0s    用户发送消息
T=0.1s  Backend spawn AgentEngine 进程
T=0.5s  AgentEngine 开始流式返回响应
T=10s   AgentEngine 完成响应
T=10.1s AgentEngine 自动退出 (exit code 0)
T=10.2s Backend 收到 'close' 事件
T=10.3s session.engineProcess = null, session.status = 'idle'

[等待用户下一条消息...]

T=60s   用户发送第2条消息
T=60.1s Backend 检测进程已退出，spawn 新进程 (--resume)
T=60.5s AgentEngine 加载历史，开始处理
T=70s   AgentEngine 完成响应并退出
```

### 用户取消场景

```
T=0s    用户发送消息
T=0.1s  Backend spawn AgentEngine 进程
T=0.5s  AgentEngine 开始处理
T=2s    用户点击取消 ← 触发 cancelSession()
T=2.0s  session.status = 'cancelling'
T=2.0s  Backend 发送 SIGTERM
T=2.0s  Socket.io emit: agent_status: cancelled
T=2.1s  AgentEngine 收到 SIGTERM，开始清理
T=2.5s  AgentEngine 退出
T=2.6s  Backend 收到 'close' 事件
T=2.6s  handleEngineClose() 检测到 wasCancelled = true
T=2.6s  session.status = 'idle' (不发送 complete 事件)

[如果 AgentEngine 没有退出...]
T=7s    5秒超时到达，Backend 发送 SIGKILL
T=7.1s  AgentEngine 被强制终止
```

---

## 6. 配置参数

```typescript
// src/chat/session.service.ts
constructor() {
  this.sessionTtlMs = configService.get('workspace.sessionTtlMs', 1800000);      // 30 分钟
  this.maxSessions = configService.get('workspace.maxSessions', 100);            // 最多 100 个
  this.cleanupIntervalMs = configService.get('workspace.cleanupIntervalMs', 300000); // 5 分钟检查一次
}
```

**环境变量**：
- `WORKSPACE_SESSION_TTL_MS` - Session 超时时间（毫秒）
- `WORKSPACE_MAX_SESSIONS` - 最大 Session 数
- `WORKSPACE_CLEANUP_INTERVAL_MS` - 清理检查间隔

---

## 7. 总结

| 场景 | AgentEngine 退出方式 | 退出时间 | Backend 行为 |
|------|---------------------|----------|--------------|
| **正常消息完成** | Engine 自己退出 | 响应完成后立即 | 收到 close 事件，清理引用 |
| **用户取消** | Backend kill (SIGTERM) | 2-7秒内 | 发送 cancelled 事件 |
| **Session 超时** | Backend kill (SIGTERM) | 30分钟后 | 删除 session |
| **服务器关闭** | Backend kill (SIGTERM) | 立即 | 清理所有 session |

**5 秒 SIGKILL 超时**只在**用户取消**场景生效，不影响正常流程。

**正常流程中，AgentEngine 自己会在完成响应后立即退出，不需要等待任何超时。**

---

## 8. 进程管理 API

Backend 暴露以下方法控制 AgentEngine 生命周期：

### `ensureAgentEngine(session, message)`
确保 session 有一个运行中的 AgentEngine 实例，如果没有则 spawn 新进程。

### `cancelSession(sessionId)`
取消正在运行的 session，发送 SIGTERM 信号，5秒后强制 SIGKILL。

### `closeSession(sessionId)`
关闭 session 并清理资源，如果 engine 仍在运行会先 kill。

### `hasActiveProcess(sessionId)`
检查 session 是否有活跃的 AgentEngine 进程。
