# Error Handling

LoopAI uses a standardized HTTP error handling system that provides consistent, actionable error responses across all API endpoints.

## Overview

All HTTP error responses follow a unified structure that includes:

- Standard error codes shared between REST and WebSocket protocols
- HTTP status code mapping
- Retry hints and recovery guidance
- Detailed context for debugging

This consistency makes it easier to build robust client applications with proper error handling and retry logic.

## Standard Error Response Format

All API errors return the following JSON structure:

```json
{
  "code": "SKILL_NOT_FOUND",
  "message": "Skill not found: skill-123",
  "statusCode": 404,
  "recoverable": false,
  "retryable": false,
  "timestamp": "2026-02-09T10:30:00.000Z",
  "path": "/api/v1/skills/skill-123",
  "requestId": "req_abc123",
  "retryAfterMs": null,
  "failedFields": [],
  "partialOutput": null
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | Standard error code (see below) |
| `message` | string | Human-readable error description |
| `statusCode` | number | HTTP status code (400-599) |
| `recoverable` | boolean | Whether the error can be recovered from |
| `retryable` | boolean | Whether the request should be retried |
| `timestamp` | string | ISO 8601 timestamp of when the error occurred |
| `path` | string | Request path that triggered the error |
| `requestId` | string | Unique identifier for this request |
| `retryAfterMs` | number \| null | Milliseconds to wait before retrying (for rate limits) |
| `failedFields` | string[] | List of fields that failed validation (for validation errors) |
| `partialOutput` | object \| null | Partial data for recoverable failures |

## Error Codes Reference

LoopAI uses 12 standard error codes that are consistent across both REST API and WebSocket events:

| Code | HTTP Status | Description | Recoverable | Retryable |
|------|-------------|-------------|-------------|-----------|
| `VALIDATION_ERROR` | 400 | Input validation failed | No | No |
| `SESSION_EXPIRED` | 401 | Session expired or authentication failed | No | No |
| `PERMISSION_DENIED` | 403 | Insufficient permissions for this operation | No | No |
| `SKILL_NOT_FOUND` | 404 | Requested resource not found | No | No |
| `RATE_LIMITED` | 429 | Rate limit exceeded | Yes | Yes |
| `INTERNAL_ERROR` | 500 | Unexpected server error | No | No |
| `CLI_ERROR` | 500 | AgentEngine process error | Yes | Yes |
| `INVALID_OUTPUT` | 500 | Output validation failed | No | No |
| `PARTIAL_FAILURE` | 500 | Some operations succeeded, others failed | Yes | Yes |
| `MCP_ERROR` | 502 | MCP server communication error | Yes | Yes |
| `CONNECTION_LOST` | 503 | Service temporarily unavailable | Yes | Yes |
| `TIMEOUT` | 504 | Request exceeded timeout limit | Yes | Yes |

### Error Categories

**4xx Client Errors** - The request was invalid or cannot be fulfilled:
- `VALIDATION_ERROR` - Fix the request data and retry
- `SESSION_EXPIRED` - Re-authenticate and retry
- `PERMISSION_DENIED` - Request appropriate permissions
- `SKILL_NOT_FOUND` - Verify the resource ID
- `RATE_LIMITED` - Wait before retrying (see `retryAfterMs`)

**5xx Server Errors** - The server encountered an error:
- `INTERNAL_ERROR` - Contact support if persistent
- `CLI_ERROR` - Retry may succeed
- `INVALID_OUTPUT` - Report to support
- `PARTIAL_FAILURE` - Some data may be usable
- `MCP_ERROR` - MCP server may recover
- `CONNECTION_LOST` - Retry after service recovers
- `TIMEOUT` - Retry with simpler request

## Common Error Scenarios

### Validation Errors

**Scenario**: Invalid or missing required fields

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Skill validation failed",
  "statusCode": 400,
  "recoverable": false,
  "retryable": false,
  "failedFields": ["name", "prompt"]
}
```

**Action**: Fix the specified fields and resubmit.

### Authentication Errors

**Scenario**: Missing or expired API key

```json
{
  "code": "SESSION_EXPIRED",
  "message": "API key expired",
  "statusCode": 401,
  "recoverable": false,
  "retryable": false
}
```

**Action**: Obtain a new API key and retry the request.

### Rate Limiting

**Scenario**: Too many requests in a short time

```json
{
  "code": "RATE_LIMITED",
  "message": "Rate limit exceeded. Retry after 60000ms",
  "statusCode": 429,
  "recoverable": true,
  "retryable": true,
  "retryAfterMs": 60000
}
```

**Action**: Wait for the specified `retryAfterMs` duration before retrying.

### Resource Not Found

**Scenario**: Requested skill, session, or MCP server doesn't exist

```json
{
  "code": "SKILL_NOT_FOUND",
  "message": "Skill not found: skill-123",
  "statusCode": 404,
  "recoverable": false,
  "retryable": false
}
```

**Action**: Verify the resource ID is correct.

### Partial Failures

**Scenario**: Batch operation where some items succeeded

```json
{
  "code": "PARTIAL_FAILURE",
  "message": "3 items failed to update",
  "statusCode": 500,
  "recoverable": true,
  "retryable": true,
  "failedFields": ["item-2", "item-5", "item-8"],
  "partialOutput": {
    "successCount": 7,
    "successfulItems": ["item-1", "item-3", "..."]
  }
}
```

**Action**: Save the successful data from `partialOutput` and retry the failed items.

### MCP Server Errors

**Scenario**: MCP server unavailable or returned an error

```json
{
  "code": "MCP_ERROR",
  "message": "Failed to fetch tools from MCP server: connection timeout",
  "statusCode": 502,
  "recoverable": true,
  "retryable": true
}
```

**Action**: Retry after a delay. Check MCP server health if persistent.

### Timeout Errors

**Scenario**: Request took too long to complete

```json
{
  "code": "TIMEOUT",
  "message": "Request timeout after 30000ms",
  "statusCode": 504,
  "recoverable": true,
  "retryable": true
}
```

**Action**: Retry with a simpler request or check server load.

## Retry Strategies

### Basic Retry Logic

```typescript
async function requestWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) {
        return response;
      }

      const error = await response.json();

      // Don't retry non-retryable errors
      if (!error.retryable) {
        throw error;
      }

      // Wait before retrying
      const delay = error.retryAfterMs || calculateBackoff(attempt);
      await sleep(delay);

    } catch (err) {
      if (attempt === maxRetries - 1) {
        throw err;
      }
    }
  }
}

function calculateBackoff(attempt: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s...
  return Math.min(1000 * Math.pow(2, attempt), 30000);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Rate Limit Handling

```typescript
async function handleRateLimit(error: ErrorResponse): Promise<void> {
  if (error.code === 'RATE_LIMITED') {
    const waitTime = error.retryAfterMs || 60000;
    console.log(`Rate limited. Waiting ${waitTime}ms...`);
    await sleep(waitTime);
  }
}
```

### Partial Failure Recovery

```typescript
async function batchUpdateWithRecovery(items: Item[]): Promise<Result> {
  try {
    return await batchUpdate(items);
  } catch (error) {
    if (error.code === 'PARTIAL_FAILURE') {
      // Save successful data
      await saveResults(error.partialOutput);

      // Retry failed items
      const failedItems = items.filter(item =>
        error.failedFields.includes(item.id)
      );

      if (failedItems.length > 0) {
        return await batchUpdate(failedItems);
      }
    }
    throw error;
  }
}
```

### Selective Retry Strategy

```typescript
function shouldRetry(error: ErrorResponse): boolean {
  // Always retry if server says it's retryable
  if (error.retryable) {
    return true;
  }

  // Retry specific 5xx errors
  const retryableCodes = [
    'TIMEOUT',
    'RATE_LIMITED',
    'CONNECTION_LOST',
    'MCP_ERROR',
    'CLI_ERROR',
    'PARTIAL_FAILURE'
  ];

  return retryableCodes.includes(error.code);
}
```

## Client Implementation Examples

### TypeScript/JavaScript

```typescript
interface ErrorResponse {
  code: string;
  message: string;
  statusCode: number;
  recoverable: boolean;
  retryable: boolean;
  timestamp: string;
  path?: string;
  requestId?: string;
  retryAfterMs?: number;
  failedFields?: string[];
  partialOutput?: Record<string, unknown>;
}

class LoopAIClient {
  private baseURL: string;
  private apiKey: string;
  private maxRetries: number = 3;

  constructor(baseURL: string, apiKey: string) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, { ...options, headers });

        if (response.ok) {
          return await response.json();
        }

        const error: ErrorResponse = await response.json();

        // Log error details
        console.error('API Error:', {
          code: error.code,
          message: error.message,
          requestId: error.requestId,
        });

        // Don't retry if not retryable
        if (!error.retryable) {
          throw new Error(`${error.code}: ${error.message}`);
        }

        // Handle rate limiting
        if (error.code === 'RATE_LIMITED') {
          const waitTime = error.retryAfterMs || 60000;
          console.log(`Rate limited. Waiting ${waitTime}ms...`);
          await this.sleep(waitTime);
          continue;
        }

        // Exponential backoff for other retryable errors
        if (attempt < this.maxRetries - 1) {
          const backoff = Math.pow(2, attempt) * 1000;
          console.log(`Retrying in ${backoff}ms...`);
          await this.sleep(backoff);
          continue;
        }

        throw new Error(`${error.code}: ${error.message}`);

      } catch (err) {
        if (attempt === this.maxRetries - 1) {
          throw err;
        }
      }
    }

    throw new Error('Max retries exceeded');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage
const client = new LoopAIClient('https://api.example.com', 'your-api-key');

try {
  const skill = await client.request('/api/v1/skills/123', {
    method: 'GET',
  });
  console.log('Skill:', skill);
} catch (error) {
  console.error('Failed to fetch skill:', error);
}
```

### React Hook

```typescript
import { useState, useCallback } from 'react';

interface UseAPIOptions {
  maxRetries?: number;
  onError?: (error: ErrorResponse) => void;
}

export function useAPI(
  baseURL: string,
  apiKey: string,
  options: UseAPIOptions = {}
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorResponse | null>(null);

  const request = useCallback(async <T,>(
    endpoint: string,
    requestOptions: RequestInit = {}
  ): Promise<T> => {
    setLoading(true);
    setError(null);

    try {
      const client = new LoopAIClient(baseURL, apiKey);
      const result = await client.request<T>(endpoint, requestOptions);
      return result;
    } catch (err) {
      const errorResponse = err as ErrorResponse;
      setError(errorResponse);
      options.onError?.(errorResponse);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [baseURL, apiKey, options]);

  return { request, loading, error };
}

// Usage in component
function SkillsPage() {
  const { request, loading, error } = useAPI(
    process.env.API_URL,
    process.env.API_KEY,
    {
      onError: (error) => {
        if (error.code === 'SESSION_EXPIRED') {
          // Redirect to login
          window.location.href = '/login';
        }
      }
    }
  );

  const fetchSkills = async () => {
    try {
      const skills = await request('/api/v1/skills');
      console.log('Skills:', skills);
    } catch (err) {
      // Error already handled by hook
    }
  };

  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      <button onClick={fetchSkills}>Fetch Skills</button>
    </div>
  );
}
```

## Best Practices

### 1. Always Check `retryable` Flag

Don't retry errors that aren't retryable:

```typescript
if (!error.retryable) {
  throw error; // Don't retry
}
```

### 2. Respect `retryAfterMs` for Rate Limits

Use the server-provided retry delay:

```typescript
if (error.code === 'RATE_LIMITED') {
  await sleep(error.retryAfterMs || 60000);
}
```

### 3. Use Exponential Backoff

Avoid overwhelming the server with rapid retries:

```typescript
const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
await sleep(delay);
```

### 4. Log Request IDs

Include `requestId` in logs for debugging:

```typescript
console.error('API Error:', {
  requestId: error.requestId,
  code: error.code,
  message: error.message,
});
```

### 5. Handle Partial Failures Gracefully

Save successful data before retrying failures:

```typescript
if (error.code === 'PARTIAL_FAILURE') {
  await saveResults(error.partialOutput);
  // Retry only failed items
}
```

### 6. Set Appropriate Timeouts

Don't wait indefinitely for responses:

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);

try {
  const response = await fetch(url, { signal: controller.signal });
} finally {
  clearTimeout(timeout);
}
```

### 7. Implement Circuit Breaker Pattern

Avoid cascading failures by temporarily disabling failing services:

```typescript
class CircuitBreaker {
  private failures = 0;
  private threshold = 5;
  private timeout = 60000;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.state = 'open';
      setTimeout(() => {
        this.state = 'half-open';
      }, this.timeout);
    }
  }
}
```

## Error Monitoring

### Recommended Metrics

Track these metrics to monitor API health:

- **Error rate by code** - Which errors occur most frequently
- **Retry success rate** - How many retries eventually succeed
- **Average retry count** - How many retries are typically needed
- **Rate limit frequency** - Are clients being throttled too often
- **Timeout rate** - Are timeouts increasing

### Example Monitoring Setup

```typescript
interface ErrorMetrics {
  totalErrors: number;
  errorsByCode: Record<string, number>;
  retryAttempts: number;
  successfulRetries: number;
  avgRetryCount: number;
}

class MetricsCollector {
  private metrics: ErrorMetrics = {
    totalErrors: 0,
    errorsByCode: {},
    retryAttempts: 0,
    successfulRetries: 0,
    avgRetryCount: 0,
  };

  recordError(error: ErrorResponse, attempt: number) {
    this.metrics.totalErrors++;
    this.metrics.errorsByCode[error.code] =
      (this.metrics.errorsByCode[error.code] || 0) + 1;

    if (attempt > 0) {
      this.metrics.retryAttempts++;
    }
  }

  recordSuccess(attempts: number) {
    if (attempts > 0) {
      this.metrics.successfulRetries++;
      this.metrics.avgRetryCount =
        (this.metrics.avgRetryCount + attempts) / this.metrics.successfulRetries;
    }
  }

  getReport(): ErrorMetrics {
    return { ...this.metrics };
  }
}
```

## See Also

- [REST API Endpoints](rest.md) - Complete API reference
- [WebSocket Events](websocket.md) - Real-time event stream format
- [@ccaas/common Types](shared-types.md) - TypeScript type definitions
