# @ccaas/common Types

The `@ccaas/common` package provides TypeScript type definitions and Zod runtime validation schemas shared across all CCAAS packages.

## Installation

```bash
npm install @ccaas/common
```

## Import Usage

```typescript
// Import types
import { Session, Skill, Message, TokenUsage } from '@ccaas/common'

// Import Zod schemas
import { OutputUpdateEventSchema, AgentStatusEventSchema } from '@ccaas/common'
```

## Core Types

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

## Event Schemas (Zod)

`@ccaas/common` provides Zod schemas for runtime event validation:

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

## Protocol Utilities

### Field Mapping

`@ccaas/common` provides mappings from backend field names to frontend field names:

```typescript
import { fieldMapping } from '@ccaas/common'

// Example mappings:
// 'learningTasks' -> 'learningProcess'
// 'homeworkTasks' -> 'homeworkAssessment'
```

### Validation Functions

```typescript
import { validate, safeValidate } from '@ccaas/common'

// validate: Throws an exception on failure
// safeValidate: Returns { success, data?, error? }
```

## Lesson Plan Domain Types

`@ccaas/common` also includes domain-specific types for lesson plans:

```typescript
type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create'
type MaterialType = 'handout' | 'digital' | 'manipulative' | 'video' | 'other'
type ActivityType = 'introduction' | 'direct-instruction' | 'guided-practice' |
                    'independent-practice' | 'group' | 'assessment' | 'closure'

interface LearningObjective {
  description: string
  bloomLevel: BloomLevel
  assessmentCriteria: string
}

interface Activity {
  title: string
  description: string
  duration: number
  type: ActivityType
  instructions: string[]
  materials: string[]
  teacherNotes: string
}

// Utility functions
import { createEmptyLessonPlan, isLessonPlanComplete, LESSON_PLAN_SYNC_FIELDS } from '@ccaas/common'
```
