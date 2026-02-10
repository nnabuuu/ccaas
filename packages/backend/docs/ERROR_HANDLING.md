# HTTP Error Handling

This document describes the standardized HTTP error handling system in the CCAAS backend.

## Overview

The backend uses a three-layer error handling system:

1. **Protocol ErrorCode** - 12 standard error codes shared between HTTP and WebSocket
2. **Exception Classes** - Type-safe exception classes for each error code
3. **Global Filter** - Unified exception filter that transforms all errors into standardized responses

## Error Codes

All HTTP errors use the same `ErrorCode` enum as WebSocket errors, defined in `protocol/errors.ts`:

```typescript
type ErrorCode =
  | 'VALIDATION_ERROR'      // 400 - Bad Request
  | 'SESSION_EXPIRED'       // 401 - Unauthorized
  | 'PERMISSION_DENIED'     // 403 - Forbidden
  | 'SKILL_NOT_FOUND'       // 404 - Not Found
  | 'RATE_LIMITED'          // 429 - Too Many Requests
  | 'INTERNAL_ERROR'        // 500 - Internal Server Error
  | 'CLI_ERROR'             // 500 - CLI process error
  | 'INVALID_OUTPUT'        // 500 - Invalid output format
  | 'PARTIAL_FAILURE'       // 500 - Partial failure
  | 'MCP_ERROR'             // 502 - Bad Gateway
  | 'CONNECTION_LOST'       // 503 - Service Unavailable
  | 'TIMEOUT';              // 504 - Gateway Timeout
```

## Standardized Response Format

All HTTP errors return a consistent JSON structure:

```json
{
  "code": "SKILL_NOT_FOUND",
  "message": "Skill not found: skill-123",
  "statusCode": 404,
  "recoverable": false,
  "retryable": false,
  "timestamp": "2026-02-09T10:30:00.000Z",
  "path": "/api/v1/skills/skill-123",
  "requestId": "req_123",
  "retryAfterMs": null,
  "failedFields": []
}
```

### Response Fields

- **code** - Protocol error code (see above)
- **message** - Human-readable error message
- **statusCode** - HTTP status code (400-599)
- **recoverable** - Whether the error can be recovered from
- **retryable** - Whether the request should be retried
- **timestamp** - ISO 8601 timestamp
- **path** - Request path
- **requestId** - Unique request identifier
- **retryAfterMs** - (Optional) Milliseconds to wait before retrying
- **failedFields** - (Optional) List of fields that failed validation
- **partialOutput** - (Optional) Partial data for PARTIAL_FAILURE errors

## Using Exception Classes

### Basic Usage

```typescript
import {
  ValidationException,
  SkillNotFoundException,
  PermissionDeniedException,
  SessionExpiredException,
  RateLimitedException,
  TimeoutException,
  InternalException,
  McpException,
  ConnectionLostException,
  InvalidOutputException,
  PartialFailureException,
  CliException,
} from '../protocol/http-exceptions';

// In your controller or service:
@Get(':id')
async getSkill(@Param('id') id: string) {
  const skill = await this.skillsService.findOne(id);

  if (!skill) {
    throw new SkillNotFoundException(id);
  }

  return skill;
}
```

### Validation Errors with Field-Level Details

```typescript
@Post()
async createSkill(@Body() dto: CreateSkillDto) {
  const errors = await this.validateSkill(dto);

  if (errors.length > 0) {
    throw new ValidationException(
      'Skill validation failed',
      errors.map(e => e.field)
    );
  }

  return this.skillsService.create(dto);
}
```

### Rate Limiting with Retry Hints

```typescript
@Post('execute')
async executeSkill(@Param('id') id: string) {
  const isRateLimited = await this.rateLimiter.check();

  if (isRateLimited) {
    const retryAfterMs = 60000; // 1 minute
    throw new RateLimitedException(retryAfterMs);
  }

  return this.skillsService.execute(id);
}
```

### Partial Failures with Recoverable Data

```typescript
@Post('batch')
async batchUpdate(@Body() items: UpdateItem[]) {
  const results = await this.processBatch(items);

  if (results.failedCount > 0) {
    throw new PartialFailureException(
      `${results.failedCount} items failed to update`,
      results.failedFields,
      results.successfulData
    );
  }

  return results;
}
```

### MCP Server Errors

```typescript
@Get('mcp/:serverId/tools')
async getMcpTools(@Param('serverId') serverId: string) {
  try {
    return await this.mcpService.getTools(serverId);
  } catch (error) {
    throw new McpException(
      `Failed to fetch tools from MCP server: ${error.message}`,
      { serverId, originalError: error.message }
    );
  }
}
```

### Timeout Errors

```typescript
@Post('execute/:id')
async executeWithTimeout(@Param('id') id: string) {
  const timeout = 30000; // 30 seconds

  try {
    return await Promise.race([
      this.skillsService.execute(id),
      new Promise((_, reject) =>
        setTimeout(() => reject(new TimeoutException(
          `Skill execution timeout after ${timeout}ms`
        )), timeout)
      )
    ]);
  } catch (error) {
    if (error instanceof TimeoutException) {
      throw error;
    }
    throw new InternalException(error.message);
  }
}
```

## Backward Compatibility

The system maintains backward compatibility with existing custom error classes:

### Legacy Auth Errors

```typescript
// Old way (still works)
throw new AuthenticationError('Invalid token');

// New way (recommended)
throw new SessionExpiredException();
```

### Legacy MCP Errors

```typescript
// Old way (still works)
throw new McpError('MCP_VALIDATION_ERROR', 'Invalid config', 400);

// New way (recommended)
throw new ValidationException('Invalid MCP config');
```

## Exception Hierarchy

```
Error
└── HttpException (NestJS)
    └── ProtocolHttpException
        ├── ValidationException
        ├── SkillNotFoundException
        ├── PermissionDeniedException
        ├── SessionExpiredException
        ├── RateLimitedException
        ├── TimeoutException
        ├── InternalException
        ├── McpException
        ├── ConnectionLostException
        ├── InvalidOutputException
        ├── PartialFailureException
        └── CliException
```

## Error Recovery Patterns

### Client-Side Retry Logic

```typescript
async function retryableRequest(url: string, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetch(url);
    } catch (error) {
      if (error.statusCode === 429) {
        // Rate limited - use retryAfterMs
        await sleep(error.retryAfterMs || 60000);
        continue;
      }

      if (error.statusCode >= 500 && error.retryable) {
        // Server error - exponential backoff
        await sleep(Math.pow(2, attempt) * 1000);
        continue;
      }

      // Non-retryable error
      throw error;
    }
  }
}
```

### Partial Failure Handling

```typescript
try {
  await batchUpdate(items);
} catch (error) {
  if (error.code === 'PARTIAL_FAILURE') {
    // Save successful data
    await savePartialResults(error.partialOutput);

    // Retry failed fields
    await retryFailedFields(error.failedFields);
  }
}
```

## Logging

The global filter automatically logs errors with appropriate severity:

- **4xx errors** - Logged as WARN
- **5xx errors** - Logged as ERROR with stack trace

Log format includes:
```json
{
  "requestId": "req_123",
  "path": "/api/v1/skills/123",
  "method": "GET",
  "code": "SKILL_NOT_FOUND",
  "statusCode": 404,
  "userAgent": "Mozilla/5.0...",
  "ip": "127.0.0.1"
}
```

## Testing Error Responses

```typescript
import { Test } from '@nestjs/testing';
import { SkillNotFoundException } from '../protocol/http-exceptions';

describe('SkillsController', () => {
  it('should throw 404 for non-existent skill', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/skills/non-existent')
      .expect(404);

    expect(response.body).toMatchObject({
      code: 'SKILL_NOT_FOUND',
      statusCode: 404,
      message: 'Skill not found: non-existent',
      recoverable: false,
      retryable: false,
    });
  });
});
```

## Best Practices

1. **Use Specific Exception Classes** - Don't use generic HttpException
2. **Include Helpful Messages** - Provide actionable error messages
3. **Set Retry Hints** - Use retryAfterMs for rate limiting
4. **Track Failed Fields** - Include failedFields for validation errors
5. **Preserve Partial Data** - Return partialOutput when some operations succeed
6. **Log Context** - Include requestId and relevant context in logs
7. **Test Error Paths** - Write tests for error scenarios

## Migration Guide

To migrate from custom error classes to protocol exceptions:

1. Import the new exception class
2. Replace throw statements
3. Update tests to expect new response format
4. Remove deprecated custom error classes after migration

Example:
```typescript
// Before
throw new HttpException('Skill not found', 404);

// After
throw new SkillNotFoundException(skillId);
```

## Related Documentation

- [Protocol Events](./protocol/events.ts) - Event type definitions
- [Error Recovery](./protocol/errors.ts) - Retry policies
- [WebSocket Errors](./common/filters/ws-exception.filter.ts) - WebSocket error handling
