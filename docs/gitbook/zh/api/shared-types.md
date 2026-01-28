# @ccaas/shared 类型

`@ccaas/shared` 包提供所有 CCAAS 包共享的 TypeScript 类型定义和 Zod 运行时验证 Schema。

## 安装

```bash
npm install @ccaas/shared
```

## 导入方式

```typescript
// 导入类型
import { Session, Skill, Message, TokenUsage } from '@ccaas/shared'

// 导入 Zod Schema
import { OutputUpdateEventSchema, AgentStatusEventSchema } from '@ccaas/shared'
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

## 事件 Schema（Zod）

`@ccaas/shared` 提供 Zod Schema 进行运行时事件验证：

### OutputUpdateEvent

```typescript
import { OutputUpdateEventSchema } from '@ccaas/shared'

const result = OutputUpdateEventSchema.safeParse(rawEvent)
if (result.success) {
  const event = result.data
  // event.payload.data.field, event.payload.data.value
}
```

### AgentStatusEvent

```typescript
import { AgentStatusEventSchema } from '@ccaas/shared'

// Status: 'idle' | 'thinking' | 'exploring' | 'executing' | 'running' | 'complete' | 'error'
```

### ToolActivityEvent

```typescript
import { ToolActivityEventSchema } from '@ccaas/shared'

// Phase: 'start' | 'progress' | 'end'
// Includes: toolName, toolId, description, decisionLogic, duration, success
```

## 协议工具函数

### 字段映射

`@ccaas/shared` 提供后端字段名到前端字段名的映射：

```typescript
import { fieldMapping } from '@ccaas/shared'

// 示例映射：
// 'learningTasks' → 'learningProcess'
// 'homeworkTasks' → 'homeworkAssessment'
```

### 验证函数

```typescript
import { validate, safeValidate } from '@ccaas/shared'

// validate: 抛出异常
// safeValidate: 返回 { success, data?, error? }
```

## 教案特定类型

`@ccaas/shared` 还包含教案相关的领域类型：

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

// 工具函数
import { createEmptyLessonPlan, isLessonPlanComplete, LESSON_PLAN_SYNC_FIELDS } from '@ccaas/shared'
```
