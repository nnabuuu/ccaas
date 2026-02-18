# @ccaas/common 类型

`@ccaas/common` 包提供所有 CCAAS 包共享的 TypeScript 类型定义和 Zod 运行时验证 Schema。

## 安装

```bash
npm install @ccaas/common
```

## 导入方式

```typescript
// 导入类型
import { Session, Skill, Message, TokenUsage, ErrorCode, HttpErrorResponse } from '@ccaas/common'

// 导入 Zod Schema
import { OutputUpdateEventSchema, AgentStatusEventSchema } from '@ccaas/common'
```

## 核心类型

### Session

```typescript
type SessionStatus = 'idle' | 'processing' | 'error' | 'completed'

interface Session {
  id: string
  tenantId: string
  status: SessionStatus
  createdAt: string
  updatedAt: string
  metadata?: Record<string, any>
}

interface SessionSummary {
  messageCount: number
  tokenUsage: TokenUsage
}
```

### Message

```typescript
type MessageRole = 'user' | 'assistant' | 'system'

interface Message {
  id: string
  sessionId: string
  role: MessageRole
  content: string
  toolCalls?: ToolCall[]
  thinkingBlocks?: ThinkingBlock[]
  createdAt: string
}

interface ToolCall {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  input?: any
  output?: any
  duration?: number
  error?: string
}

interface ThinkingBlock {
  type: 'thinking'
  content: string
}
```

### Skill

```typescript
type SkillType = 'prompt' | 'workflow' | 'sub-agent' | 'tool-config'
type SkillStatus = 'draft' | 'published' | 'archived'

interface Skill {
  id: string
  tenantId: string
  name: string
  slug: string
  description: string
  type: SkillType
  status: SkillStatus
  content: string
  triggers: SkillTrigger[]
  allowedTools: string[]
  version: number
  createdAt: string
  updatedAt: string
}

interface SkillTrigger {
  type: 'keyword' | 'pattern' | 'intent' | 'context'
  value: string
  priority?: number
}

interface SkillVersion {
  id: string
  skillId: string
  version: number
  prompt: string
  triggers: SkillTrigger[]
  allowedTools: string[]
  changelog: string
  createdAt: string
}
```

### Tenant

```typescript
interface Tenant {
  id: string
  name: string
  slug: string
  settings: TenantSettings
}

interface TenantSettings {
  maxSessions: number
  maxTokensPerDay: number
  allowedModels: string[]
}
```

### API Key

```typescript
type ApiKeyScope =
  | 'skills:read' | 'skills:write' | 'skills:execute' | 'skills:delete'
  | 'mcp:read' | 'mcp:write'
  | 'chat'
  | 'analytics:read'
  | 'admin'

interface ApiKey {
  id: string
  tenantId: string
  name: string
  prefix: string
  scopes: ApiKeyScope[]
  expiresAt?: string
  lastUsedAt?: string
  createdAt: string
}
```

### Token Usage

```typescript
interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

interface TokenUsageSummary {
  daily: { date: string; usage: TokenUsage }[]
  estimatedCostUsd: number
}
```

### 错误类型

完整的错误处理文档，请参见 [错误处理指南](error-handling.md)。

```typescript
// REST 和 WebSocket 共享的标准错误代码
type ErrorCode =
  | 'VALIDATION_ERROR'      // 400 - 请求无效
  | 'SESSION_EXPIRED'       // 401 - 未授权
  | 'PERMISSION_DENIED'     // 403 - 禁止访问
  | 'SKILL_NOT_FOUND'       // 404 - 未找到
  | 'RATE_LIMITED'          // 429 - 请求过多
  | 'INTERNAL_ERROR'        // 500 - 内部服务器错误
  | 'CLI_ERROR'             // 500 - CLI 进程错误
  | 'INVALID_OUTPUT'        // 500 - 输出格式无效
  | 'PARTIAL_FAILURE'       // 500 - 部分失败
  | 'MCP_ERROR'             // 502 - 网关错误
  | 'CONNECTION_LOST'       // 503 - 服务不可用
  | 'TIMEOUT'               // 504 - 网关超时

// HTTP 错误响应结构
interface HttpErrorResponse {
  code: ErrorCode
  message: string
  statusCode: number
  recoverable: boolean
  retryable: boolean
  timestamp: string
  path?: string
  requestId?: string
  retryAfterMs?: number
  failedFields?: string[]
  partialOutput?: Record<string, unknown>
}
```

**使用示例:**

```typescript
import { HttpErrorResponse } from '@ccaas/common'

async function handleApiError(response: Response) {
  if (!response.ok) {
    const error: HttpErrorResponse = await response.json()

    console.error('API 错误:', {
      code: error.code,
      message: error.message,
      requestId: error.requestId,
    })

    // 检查是否可重试
    if (error.retryable && error.code === 'RATE_LIMITED') {
      const waitTime = error.retryAfterMs || 60000
      await sleep(waitTime)
      // 重试请求...
    }
  }
}
```

## 事件 Schema（Zod）

`@ccaas/common` 提供 Zod Schema 进行运行时事件验证：

### OutputUpdateEvent

```typescript
import { OutputUpdateEventSchema } from '@ccaas/common'

const result = OutputUpdateEventSchema.safeParse(rawEvent)
if (result.success) {
  const event = result.data
  // event.payload.data.field, event.payload.data.value
}
```

### AgentStatusEvent

```typescript
import { AgentStatusEventSchema } from '@ccaas/common'

// Status: 'idle' | 'thinking' | 'exploring' | 'executing' | 'running' | 'complete' | 'error'
```

### ToolActivityEvent

```typescript
import { ToolActivityEventSchema } from '@ccaas/common'

// Phase: 'start' | 'progress' | 'end'
// Includes: toolName, toolId, description, decisionLogic, duration, success
```

## 协议工具函数

### 字段映射

`@ccaas/common` 提供后端字段名到前端字段名的映射：

```typescript
import { fieldMapping } from '@ccaas/common'

// 示例映射：
// 'learningTasks' → 'learningProcess'
// 'homeworkTasks' → 'homeworkAssessment'
```

### 验证函数

```typescript
import { validate, safeValidate } from '@ccaas/common'

// validate: 抛出异常
// safeValidate: 返回 { success, data?, error? }
```

## Solution 领域类型

`@ccaas/common` 只包含平台基础设施类型。领域类型（如教案、题目等）属于各 Solution 的内部实现，定义在 Solution 自身的代码库中，不通过 `@ccaas/common` 共享。

> **架构原则**：Core（`@ccaas/common`）= 基础设施类型；Solution = 领域逻辑与类型。两者不应混用。
