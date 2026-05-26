# 错误处理

即见Agentic 使用标准化的 HTTP 错误处理系统，在所有 API 端点提供一致且可操作的错误响应。

## 概述

所有 HTTP 错误响应遵循统一的结构，包括：

- REST 和 WebSocket 协议共享的标准错误代码
- HTTP 状态码映射
- 重试提示和恢复指导
- 用于调试的详细上下文

这种一致性使得构建具有适当错误处理和重试逻辑的健壮客户端应用程序变得更容易。

## 标准错误响应格式

所有 API 错误返回以下 JSON 结构:

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

### 响应字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | string | 标准错误代码(见下文) |
| `message` | string | 人类可读的错误描述 |
| `statusCode` | number | HTTP 状态码(400-599) |
| `recoverable` | boolean | 错误是否可恢复 |
| `retryable` | boolean | 是否应该重试请求 |
| `timestamp` | string | 错误发生时的 ISO 8601 时间戳 |
| `path` | string | 触发错误的请求路径 |
| `requestId` | string | 该请求的唯一标识符 |
| `retryAfterMs` | number \| null | 重试前等待的毫秒数(用于速率限制) |
| `failedFields` | string[] | 验证失败的字段列表(用于验证错误) |
| `partialOutput` | object \| null | 可恢复失败的部分数据 |

## 错误代码参考

即见Agentic 使用 13 个标准错误代码，在 REST API 和 WebSocket 事件中保持一致：

| 代码 | HTTP 状态 | 说明 | 可恢复 | 可重试 |
|------|-----------|------|--------|--------|
| `VALIDATION_ERROR` | 400 | 输入验证失败 | 否 | 否 |
| `SESSION_EXPIRED` | 401 | 会话过期或认证失败 | 否 | 否 |
| `PERMISSION_DENIED` | 403 | 此操作权限不足 | 否 | 否 |
| `SKILL_NOT_FOUND` | 404 | 请求的资源未找到 | 否 | 否 |
| `ALREADY_EXISTS` | 409 | 资源已存在（重复 slug、邮箱等） | 否 | 否 |
| `RATE_LIMITED` | 429 | 超过速率限制 | 是 | 是 |
| `INTERNAL_ERROR` | 500 | 意外的服务器错误 | 否 | 否 |
| `CLI_ERROR` | 500 | AgentEngine 进程错误 | 是 | 是 |
| `INVALID_OUTPUT` | 500 | 输出验证失败 | 否 | 否 |
| `PARTIAL_FAILURE` | 500 | 部分操作成功，部分失败 | 是 | 是 |
| `MCP_ERROR` | 502 | MCP 服务器通信错误 | 是 | 是 |
| `CONNECTION_LOST` | 503 | 服务暂时不可用 | 是 | 是 |
| `TIMEOUT` | 504 | 请求超时 | 是 | 是 |

### 错误分类

**4xx 客户端错误** - 请求无效或无法完成:
- `VALIDATION_ERROR` - 修正请求数据后重试
- `SESSION_EXPIRED` - 重新认证后重试
- `PERMISSION_DENIED` - 请求适当的权限
- `SKILL_NOT_FOUND` - 验证资源 ID
- `ALREADY_EXISTS` - 使用不同的 slug/邮箱，或更新已有资源
- `RATE_LIMITED` - 等待后重试(参见 `retryAfterMs`)

**5xx 服务器错误** - 服务器遇到错误:
- `INTERNAL_ERROR` - 如果持续出现请联系支持
- `CLI_ERROR` - 重试可能成功
- `INVALID_OUTPUT` - 报告给支持团队
- `PARTIAL_FAILURE` - 部分数据可能可用
- `MCP_ERROR` - MCP 服务器可能恢复
- `CONNECTION_LOST` - 服务恢复后重试
- `TIMEOUT` - 使用更简单的请求重试

## 常见错误场景

### 验证错误

**场景**: 无效或缺少必需字段

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

**操作**: 修正指定的字段并重新提交。

### 认证错误

**场景**: API 密钥缺失或过期

```json
{
  "code": "SESSION_EXPIRED",
  "message": "API key expired",
  "statusCode": 401,
  "recoverable": false,
  "retryable": false
}
```

**操作**: 获取新的 API 密钥并重试请求。

### 速率限制

**场景**: 短时间内请求过多

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

**操作**: 等待指定的 `retryAfterMs` 时长后重试。

### 资源已存在

**场景**: 创建资源时 slug 或邮箱重复

```json
{
  "code": "ALREADY_EXISTS",
  "message": "Solution with slug 'my-solution' already exists",
  "statusCode": 409,
  "recoverable": false,
  "retryable": false
}
```

**操作**: 使用不同的 slug/邮箱，或更新已有资源而非新建。

### 资源未找到

**场景**: 请求的技能、会话或 MCP 服务器不存在

```json
{
  "code": "SKILL_NOT_FOUND",
  "message": "Skill not found: skill-123",
  "statusCode": 404,
  "recoverable": false,
  "retryable": false
}
```

**操作**: 验证资源 ID 是否正确。

### 部分失败

**场景**: 批量操作中部分项目成功

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

**操作**: 从 `partialOutput` 保存成功的数据，并重试失败的项目。

### MCP 服务器错误

**场景**: MCP 服务器不可用或返回错误

```json
{
  "code": "MCP_ERROR",
  "message": "Failed to fetch tools from MCP server: connection timeout",
  "statusCode": 502,
  "recoverable": true,
  "retryable": true
}
```

**操作**: 延迟后重试。如果持续出现，检查 MCP 服务器健康状态。

### 超时错误

**场景**: 请求完成时间过长

```json
{
  "code": "TIMEOUT",
  "message": "Request timeout after 30000ms",
  "statusCode": 504,
  "recoverable": true,
  "retryable": true
}
```

**操作**: 使用更简单的请求重试，或检查服务器负载。

## 重试策略

### 基本重试逻辑

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

      // 不重试不可重试的错误
      if (!error.retryable) {
        throw error;
      }

      // 重试前等待
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
  // 指数退避: 1秒, 2秒, 4秒, 8秒...
  return Math.min(1000 * Math.pow(2, attempt), 30000);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 速率限制处理

```typescript
async function handleRateLimit(error: ErrorResponse): Promise<void> {
  if (error.code === 'RATE_LIMITED') {
    const waitTime = error.retryAfterMs || 60000;
    console.log(`速率限制。等待 ${waitTime}ms...`);
    await sleep(waitTime);
  }
}
```

### 部分失败恢复

```typescript
async function batchUpdateWithRecovery(items: Item[]): Promise<Result> {
  try {
    return await batchUpdate(items);
  } catch (error) {
    if (error.code === 'PARTIAL_FAILURE') {
      // 保存成功的数据
      await saveResults(error.partialOutput);

      // 重试失败的项目
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

### 选择性重试策略

```typescript
function shouldRetry(error: ErrorResponse): boolean {
  // 如果服务器说可以重试，总是重试
  if (error.retryable) {
    return true;
  }

  // 重试特定的 5xx 错误
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

## 客户端实现示例

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

class JijianAgenticClient {
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

        // 记录错误详情
        console.error('API 错误:', {
          code: error.code,
          message: error.message,
          requestId: error.requestId,
        });

        // 如果不可重试则不重试
        if (!error.retryable) {
          throw new Error(`${error.code}: ${error.message}`);
        }

        // 处理速率限制
        if (error.code === 'RATE_LIMITED') {
          const waitTime = error.retryAfterMs || 60000;
          console.log(`速率限制。等待 ${waitTime}ms...`);
          await this.sleep(waitTime);
          continue;
        }

        // 其他可重试错误的指数退避
        if (attempt < this.maxRetries - 1) {
          const backoff = Math.pow(2, attempt) * 1000;
          console.log(`${backoff}ms 后重试...`);
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

    throw new Error('超过最大重试次数');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 使用示例
const client = new JijianAgenticClient('https://api.example.com', 'your-api-key');

try {
  const skill = await client.request('/api/v1/skills/123', {
    method: 'GET',
  });
  console.log('技能:', skill);
} catch (error) {
  console.error('获取技能失败:', error);
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
      const client = new JijianAgenticClient(baseURL, apiKey);
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

// 组件中使用
function SkillsPage() {
  const { request, loading, error } = useAPI(
    process.env.API_URL,
    process.env.API_KEY,
    {
      onError: (error) => {
        if (error.code === 'SESSION_EXPIRED') {
          // 重定向到登录页
          window.location.href = '/login';
        }
      }
    }
  );

  const fetchSkills = async () => {
    try {
      const skills = await request('/api/v1/skills');
      console.log('技能:', skills);
    } catch (err) {
      // 错误已由 hook 处理
    }
  };

  return (
    <div>
      {loading && <p>加载中...</p>}
      {error && <p>错误: {error.message}</p>}
      <button onClick={fetchSkills}>获取技能</button>
    </div>
  );
}
```

## 最佳实践

### 1. 始终检查 `retryable` 标志

不要重试不可重试的错误:

```typescript
if (!error.retryable) {
  throw error; // 不重试
}
```

### 2. 遵守速率限制的 `retryAfterMs`

使用服务器提供的重试延迟:

```typescript
if (error.code === 'RATE_LIMITED') {
  await sleep(error.retryAfterMs || 60000);
}
```

### 3. 使用指数退避

避免快速重试压垮服务器:

```typescript
const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
await sleep(delay);
```

### 4. 记录请求 ID

在日志中包含 `requestId` 以便调试:

```typescript
console.error('API 错误:', {
  requestId: error.requestId,
  code: error.code,
  message: error.message,
});
```

### 5. 优雅处理部分失败

重试失败之前保存成功的数据:

```typescript
if (error.code === 'PARTIAL_FAILURE') {
  await saveResults(error.partialOutput);
  // 仅重试失败的项目
}
```

### 6. 设置适当的超时

不要无限期等待响应:

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);

try {
  const response = await fetch(url, { signal: controller.signal });
} finally {
  clearTimeout(timeout);
}
```

### 7. 实施断路器模式

通过临时禁用失败的服务来避免级联失败:

```typescript
class CircuitBreaker {
  private failures = 0;
  private threshold = 5;
  private timeout = 60000;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      throw new Error('断路器已打开');
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

## 错误监控

### 推荐指标

跟踪这些指标以监控 API 健康状况:

- **按代码分类的错误率** - 哪些错误最频繁出现
- **重试成功率** - 有多少重试最终成功
- **平均重试次数** - 通常需要多少次重试
- **速率限制频率** - 客户端是否被过度限流
- **超时率** - 超时是否在增加

### 监控设置示例

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

## 另请参阅

- [REST API 端点](rest.md) - 完整 API 参考
- [WebSocket 事件](websocket.md) - 实时事件流格式
- [@kedge-agentic/common 类型](shared-types.md) - TypeScript 类型定义
