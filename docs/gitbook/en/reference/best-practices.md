# Best Practices

## Transport Configuration

### Use SSE (Default, Recommended)

Since v1.1.0, **SSE is the default transport**. No extra configuration needed:

```typescript
// ✅ SSE is the default - this is the recommended pattern
const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001', // Always use absolute URL to backend
  tenantId: 'my-solution',
})
const chat = useAgentChat({ connection, tenantId: 'my-solution' })
```

Chat messages stream via `POST /api/v1/sessions/:id/messages` returning `text/event-stream`.

### Socket.IO Transport is Deprecated

```typescript
// ❌ DEPRECATED - The backend returns 410 Gone
const chat = useAgentChat({
  connection,
  tenantId: 'my-solution',
  transport: 'socket', // Will print deprecation warning
})
```

The backend endpoint `POST /api/v1/sessions/:id/completion` returns **410 Gone**.

> **Known limitation:** Background task (`subagent_completed`) events currently only arrive via Socket.IO. In SSE mode, background task completion notifications are not received. This will be resolved in a future release.

### Always Use Absolute serverUrl

```typescript
// ❌ WRONG - Sends requests to frontend port!
const connection = useAgentConnection({ serverUrl: '' })

// ✅ CORRECT - Absolute URL to backend
const connection = useAgentConnection({ serverUrl: 'http://localhost:3001' })
```

## Types and Contract Management

### Use Shared Types

Always import shared types from `@ccaas/common` to keep frontend and backend types consistent:

```typescript
import { Session, Skill, TokenUsage } from '@ccaas/common'
```

### Runtime Validation

Use DTOs with class-validator for runtime request validation:

```typescript
class CreateCompletionDto {
  @IsString()
  clientId: string

  @IsString()
  message: string

  @IsOptional()
  @IsString()
  tenantId?: string
}
```

### Backward Compatibility

Use optional fields when adding new parameters to ensure backward compatibility:

```typescript
// New parameters should be optional with default values
interface Options {
  existingField: string
  newField?: string  // New, optional
}
```

## TDD Mandatory Rules

These are mandatory rules derived from real-world lessons learned.

### Before Modifying Code

```
[] Run npm test to confirm all existing tests pass
[] If changing an API/interface, check frontend type definitions and existing tests first
```

### After Modifying Code

```
[] Run related tests immediately -- do not wait until the end
[] Test failure = stop and analyze, do not continue moving forward
```

### Core Principle

> **Tests are the contract for code; plans are merely expressions of intent. When a plan conflicts with tests, question the plan -- not the tests.**

## End-to-End Data Flow

### Trace the Complete Call Chain

Before modifying any part of the system, trace the complete data flow:

```
UI Component -> Hook -> Socket.io -> Solution Backend -> CCAAS API -> Agent -> MCP -> Response
```

Ensure the data format is correct at every step.

### Prefer Reusing CCAAS Capabilities

- Use CCAAS session management instead of implementing your own
- Proxy common API calls through the platform
- Confirm whether the backend already provides a capability before building something new

## output\_update Handling

### Parse the Nested Structure Correctly

```typescript
// Correct
const { field, value } = event.payload.data

// Wrong
const { field, value } = event
```

### Use parseOutputUpdateEvent

```typescript
import { parseOutputUpdateEvent } from '../utils/outputUpdateParser'

socket.on('output_update', (raw) => {
  const parsed = parseOutputUpdateEvent(raw)
  if (parsed) {
    updateField(parsed.field, parsed.value, parsed.operation)
  }
})
```

### Zod Schema Validation

Validate write\_output data against a schema in your MCP Server:

```typescript
const fieldSchema = OutputSchema.shape[field]
if (fieldSchema) {
  const result = fieldSchema.safeParse(value)
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues })
  }
}
```

## Solution Development Rules

### Reuse Principle

- Reuse CCAAS backend capabilities: session management, Skill routing, message persistence
- Do not re-implement these capabilities within your Solution
- Use common functionality through proxied API calls

### Correct solution.json Configuration

- All MCP Servers must be declared in `mcpServers`
- A Skill's `allowedTools` should only include the tools it actually needs
- Trigger priorities should be set appropriately

### Complete Skill Integration

1. Use the `useSkills` Hook to fetch the Skill list
2. Implement Skill ID to slug conversion
3. Pass enabled Skills in the session Hook
4. Provide Skill toggles in the UI

## Code Organization

### Hook Call Order

Data provider Hooks should come before dependent Hooks:

```typescript
// Correct order
const { skills } = useSkills()          // Data provider
const { session } = useSession(skills)   // Depends on skills
```

### Minimal Change Principle

- Prefer using existing backend capabilities
- Do not over-engineer
- Keep the scope of changes as small as possible

## Common Mistakes and Lessons Learned

### API Format Incompatibility (Jan 2025 Incident)

**Problem**: Tests were not run before modifying code, and changes were not verified afterward, resulting in API format incompatibility that completely broke frontend functionality.

**Lessons**:
- Run tests before making changes
- Verify immediately after making changes
- Test failure = stop and analyze

### Skill Switching Not Taking Effect (Jan 2025 Incident)

**Problem**: After switching Skills in the frontend, AI behavior did not change because the complete data flow was not traced.

**Lessons**:
- Trace the complete data flow
- Confirm data format at every step
- Verify every step from UI to Agent

## Checklists

### New Feature Development

```
[] Run existing tests to confirm they pass
[] Trace the complete data flow
[] Confirm whether the backend already has the capability
[] Write tests
[] Implement the feature
[] Run tests to verify
[] End-to-end testing
```

### API/Interface Changes

```
[] Check all consumers (frontend, tests, other packages)
[] Ensure backward compatibility
[] Update type definitions
[] Update tests
[] Run all tests
```
