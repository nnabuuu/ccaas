# @kedge-agentic/common Types

The `@kedge-agentic/common` package provides TypeScript type definitions and Zod runtime validation schemas shared across all CCAAS packages.

## Installation

```bash
npm install @kedge-agentic/common
```

## Import Usage

```typescript
// Import types
import { Session, Skill, Message, TokenUsage, ErrorCode, HttpErrorResponse } from '@kedge-agentic/common'

// Import Zod schemas
import { OutputUpdateEventSchema, AgentStatusEventSchema } from '@kedge-agentic/common'
```

## Core Types

### Session

```typescript
type SessionStatus = 'idle' | 'processing' | 'error' | 'completed'

interface Session {
  id: string
  tenantId: string
  status: SessionStatus
  templateName?: string  // Session template slug (e.g., 'farmer-advisor')
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

### User

```typescript
type UserStatus = 'active' | 'suspended' | 'deleted'

interface User {
  id: string
  email: string
  name: string
  username?: string
  status: UserStatus
  createdAt: string
  updatedAt: string
}
```

### UserTenant

```typescript
type UserRole = 'admin' | 'developer' | 'viewer'

interface UserTenant {
  id: string
  userId: string
  tenantId: string
  role: UserRole
  canCreateSkills: boolean
  isActive: boolean
  joinedAt: string
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
  | 'builder'

interface ApiKey {
  id: string
  tenantId: string
  userId?: string
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

### Error Types

For complete error handling documentation, see [Error Handling Guide](error-handling.md).

```typescript
// Standard error codes used across REST and WebSocket
type ErrorCode =
  | 'VALIDATION_ERROR'      // 400 - Bad Request
  | 'SESSION_EXPIRED'       // 401 - Unauthorized
  | 'PERMISSION_DENIED'     // 403 - Forbidden
  | 'SKILL_NOT_FOUND'       // 404 - Not Found
  | 'ALREADY_EXISTS'        // 409 - Conflict
  | 'RATE_LIMITED'          // 429 - Too Many Requests
  | 'INTERNAL_ERROR'        // 500 - Internal Server Error
  | 'CLI_ERROR'             // 500 - CLI process error
  | 'INVALID_OUTPUT'        // 500 - Invalid output format
  | 'PARTIAL_FAILURE'       // 500 - Partial failure
  | 'MCP_ERROR'             // 502 - Bad Gateway
  | 'CONNECTION_LOST'       // 503 - Service Unavailable
  | 'TIMEOUT'               // 504 - Gateway Timeout

// HTTP error response structure
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

**Usage Example:**

```typescript
import { HttpErrorResponse } from '@kedge-agentic/common'

async function handleApiError(response: Response) {
  if (!response.ok) {
    const error: HttpErrorResponse = await response.json()

    console.error('API Error:', {
      code: error.code,
      message: error.message,
      requestId: error.requestId,
    })

    // Check if retryable
    if (error.retryable && error.code === 'RATE_LIMITED') {
      const waitTime = error.retryAfterMs || 60000
      await sleep(waitTime)
      // Retry request...
    }
  }
}
```

## Event Schemas (Zod)

`@kedge-agentic/common` provides Zod schemas for runtime event validation:

### OutputUpdateEvent

```typescript
import { OutputUpdateEventSchema } from '@kedge-agentic/common'

const result = OutputUpdateEventSchema.safeParse(rawEvent)
if (result.success) {
  const event = result.data
  // event.payload.data.field, event.payload.data.value
}
```

### AgentStatusEvent

```typescript
import { AgentStatusEventSchema } from '@kedge-agentic/common'

// Status: 'idle' | 'thinking' | 'exploring' | 'executing' | 'running' | 'complete' | 'error'
```

### ToolActivityEvent

```typescript
import { ToolActivityEventSchema } from '@kedge-agentic/common'

// Phase: 'start' | 'progress' | 'end'
// Includes: toolName, toolId, description, decisionLogic, duration, success
```

## Protocol Utilities

### Field Mapping

`@kedge-agentic/common` provides mappings from backend field names to frontend field names:

```typescript
import { fieldMapping } from '@kedge-agentic/common'

// Example mappings:
// 'learningTasks' -> 'learningProcess'
// 'homeworkTasks' -> 'homeworkAssessment'
```

### Validation Functions

```typescript
import { validate, safeValidate } from '@kedge-agentic/common'

// validate: Throws an exception on failure
// safeValidate: Returns { success, data?, error? }
```

## Solution Domain Types

`@kedge-agentic/common` only contains platform infrastructure types. Domain types (such as lesson plans, quiz data, etc.) belong to each Solution's internal implementation and are defined within the Solution's own codebase — they are not shared through `@kedge-agentic/common`.

> **Architecture principle**: Core (`@kedge-agentic/common`) = infrastructure types; Solution = domain logic and types. These two must not be mixed.
