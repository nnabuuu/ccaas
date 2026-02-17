# @ccaas/common

Shared types, protocols, and utilities for Claude Code as a Service.

## Overview

This package provides shared TypeScript definitions used across all CCAAS packages:

- **Types** (`@ccaas/common/types`) - Core interfaces for sessions, messages, skills, tenants, etc.
- **Protocols** (`@ccaas/common/protocols`) - Real-time event protocols for output updates

## Installation

```bash
# Install from workspace
npm install @ccaas/common
```

## Usage

### Import Everything

```typescript
import {
  // Types
  Session,
  Message,
  Skill,
  TokenUsage,
  // Protocols
  OutputUpdateEvent,
  validateOutputUpdateEvent,
  mapFieldsToFrontend,
} from '@ccaas/common';
```

### Import Specific Modules

```typescript
// Just types
import { Session, Message, Skill } from '@ccaas/common/types';

// Just protocols
import { OutputUpdateEvent, validateOutputUpdateEvent } from '@ccaas/common/protocols';
```

## Types Module

### Session Types

```typescript
import { Session, SessionStatus, SessionSummary } from '@ccaas/common/types';

const session: Session = {
  id: 'sess_123',
  tenantId: 'tenant_456',
  status: 'processing',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};
```

### Message Types

```typescript
import { Message, ToolCall, ThinkingBlock } from '@ccaas/common/types';

const message: Message = {
  id: 'msg_123',
  sessionId: 'sess_123',
  role: 'assistant',
  content: 'Hello!',
  toolCalls: [],
  createdAt: '2024-01-01T00:00:00Z',
};
```

### Skill Types

```typescript
import { Skill, SkillVersion, SkillTrigger } from '@ccaas/common/types';

const skill: Skill = {
  id: 'skill_123',
  tenantId: 'tenant_456',
  name: 'Code Review',
  slug: 'code-review',
  type: 'prompt',
  status: 'published',
  prompt: 'You are a code reviewer...',
  version: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};
```

### API Key Types

```typescript
import { ApiKey, ApiKeyScope } from '@ccaas/common/types';

const scopes: ApiKeyScope[] = ['skills:read', 'skills:execute', 'chat'];
```

### Event Types (Socket.io)

```typescript
import {
  TextDeltaEvent,
  ToolActivityEvent,
  AgentStatusEvent,
} from '@ccaas/common/types';

// Type-safe event handling
socket.on('text_delta', (event: TextDeltaEvent) => {
  console.log(event.delta);
});
```

## Protocols Module

### Output Update Protocol

Used for streaming AI-generated content from backend to frontend.

```typescript
import {
  OutputUpdateEvent,
  validateOutputUpdateEvent,
  safeValidateOutputUpdateEvent,
  mapFieldsToFrontend,
} from '@ccaas/common/protocols';

// Backend: Emit event
const event: OutputUpdateEvent = {
  data: { textbookAnalysis: {...} },
  status: 'generating',
  progress: { totalSteps: 7, completedSteps: 1, percentage: 14 },
  timestamp: new Date().toISOString(),
};

// Validate before emitting
validateOutputUpdateEvent(event);

// Frontend: Receive event
socket.on('output_update', (rawEvent) => {
  const result = safeValidateOutputUpdateEvent(rawEvent);
  if (result.success) {
    const formData = mapFieldsToFrontend(result.data.data);
    store.updateFields(formData);
  }
});
```

### Field Mappings

Some fields have different names in backend vs frontend:

| Backend Field | Frontend Field |
|---------------|----------------|
| learningTasks | learningProcess |
| homeworkTasks | homeworkAssessment |

```typescript
import { mapFieldsToFrontend, mapFieldsToBackend } from '@ccaas/common/protocols';

// Backend → Frontend
const frontendData = mapFieldsToFrontend(backendData);

// Frontend → Backend
const backendData = mapFieldsToBackend(frontendData);
```

## API Reference

### Types

| Type | Description |
|------|-------------|
| `Session` | Session entity |
| `SessionStatus` | Session status enum |
| `Message` | Chat message entity |
| `ToolCall` | Tool invocation details |
| `ThinkingBlock` | Extended thinking content |
| `TokenUsage` | Token usage metrics |
| `Skill` | Skill definition |
| `SkillVersion` | Skill version history |
| `ApiKey` | API key entity |
| `ApiKeyScope` | Available API scopes |
| `Tenant` | Tenant entity |
| `PaginatedResult<T>` | Paginated response wrapper |

### Protocols

| Export | Description |
|--------|-------------|
| `OutputUpdateEvent` | Output update event interface |
| `validateOutputUpdateEvent()` | Validate event (throws on error) |
| `safeValidateOutputUpdateEvent()` | Safe validation (returns result) |
| `isOutputUpdateEvent()` | Type guard function |
| `mapFieldsToFrontend()` | Transform backend → frontend fields |
| `mapFieldsToBackend()` | Transform frontend → backend fields |
| `FIXTURES` | Valid event fixtures for testing |
| `INVALID_FIXTURES` | Invalid fixtures for testing |

## Development

```bash
# Build
npm run build

# Test
npm test

# Type check
npm run typecheck
```

## License

MIT
