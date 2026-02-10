/**
 * Error Handling Example
 *
 * This file demonstrates how to use the standardized HTTP error handling system.
 */

import {
  ValidationException,
  SkillNotFoundException,
  PermissionDeniedException,
  RateLimitedException,
  TimeoutException,
  PartialFailureException,
} from '../src/protocol/http-exceptions';

// ============================================================================
// Example 1: Basic Not Found Error
// ============================================================================

class SkillService {
  async getSkill(id: string) {
    const skill = await this.findSkillById(id);

    if (!skill) {
      throw new SkillNotFoundException(id);
    }

    return skill;
  }

  private async findSkillById(id: string) {
    // Simulate database lookup
    return null;
  }
}

// ============================================================================
// Example 2: Validation Error with Failed Fields
// ============================================================================

interface CreateSkillDto {
  name: string;
  trigger: string;
  content: string;
}

class SkillController {
  async createSkill(dto: CreateSkillDto) {
    const errors = this.validateSkill(dto);

    if (errors.length > 0) {
      throw new ValidationException(
        'Skill validation failed',
        errors.map((e) => e.field),
      );
    }

    return { success: true };
  }

  private validateSkill(dto: CreateSkillDto) {
    const errors: Array<{ field: string; message: string }> = [];

    if (!dto.name || dto.name.length < 3) {
      errors.push({ field: 'name', message: 'Name must be at least 3 characters' });
    }

    if (!dto.trigger) {
      errors.push({ field: 'trigger', message: 'Trigger is required' });
    }

    return errors;
  }
}

// ============================================================================
// Example 3: Rate Limiting with Retry Hint
// ============================================================================

class RateLimiter {
  private requests = new Map<string, number[]>();

  async checkRateLimit(apiKeyId: string, limit: number = 100) {
    const now = Date.now();
    const windowMs = 60000; // 1 minute

    const userRequests = this.requests.get(apiKeyId) || [];
    const recentRequests = userRequests.filter((time) => now - time < windowMs);

    if (recentRequests.length >= limit) {
      const retryAfterMs = windowMs - (now - recentRequests[0]);
      throw new RateLimitedException(retryAfterMs);
    }

    this.requests.set(apiKeyId, [...recentRequests, now]);
  }
}

// ============================================================================
// Example 4: Permission Denied with Custom Message
// ============================================================================

class AuthService {
  checkPermission(userId: string, scope: string) {
    const userScopes = this.getUserScopes(userId);

    if (!userScopes.includes(scope)) {
      throw new PermissionDeniedException(
        `Missing required scope: ${scope}. Available scopes: ${userScopes.join(', ')}`,
      );
    }
  }

  private getUserScopes(userId: string): string[] {
    // Simulate scope lookup
    return ['skills:read', 'chat'];
  }
}

// ============================================================================
// Example 5: Timeout with Retry
// ============================================================================

class AgentExecutor {
  async executeWithTimeout(skillId: string, timeoutMs: number = 30000) {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new TimeoutException(
        `Skill execution timed out after ${timeoutMs}ms`
      )), timeoutMs)
    );

    const executionPromise = this.executeSkill(skillId);

    return Promise.race([executionPromise, timeoutPromise]);
  }

  private async executeSkill(skillId: string) {
    // Simulate long-running operation
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return { result: 'success' };
  }
}

// ============================================================================
// Example 6: Partial Failure with Recoverable Data
// ============================================================================

interface BatchItem {
  id: string;
  data: unknown;
}

class BatchProcessor {
  async processBatch(items: BatchItem[]) {
    const results = {
      successful: [] as string[],
      failed: [] as string[],
      successfulData: {} as Record<string, unknown>,
    };

    for (const item of items) {
      try {
        const result = await this.processItem(item);
        results.successful.push(item.id);
        results.successfulData[item.id] = result;
      } catch (error) {
        results.failed.push(item.id);
      }
    }

    if (results.failed.length > 0) {
      throw new PartialFailureException(
        `${results.failed.length} out of ${items.length} items failed`,
        results.failed,
        results.successfulData,
      );
    }

    return results;
  }

  private async processItem(item: BatchItem) {
    // Simulate processing with random failures
    if (Math.random() < 0.3) {
      throw new Error('Random failure');
    }
    return { processed: true, id: item.id };
  }
}

// ============================================================================
// Example 7: Error Response Format
// ============================================================================

/**
 * When any of the above exceptions are thrown in a NestJS controller,
 * the GlobalHttpExceptionFilter automatically transforms them into:
 *
 * {
 *   "code": "SKILL_NOT_FOUND",
 *   "message": "Skill not found: skill-123",
 *   "statusCode": 404,
 *   "recoverable": false,
 *   "retryable": false,
 *   "timestamp": "2026-02-09T10:30:00.000Z",
 *   "path": "/api/v1/skills/skill-123",
 *   "requestId": "req_abc123",
 *   "retryAfterMs": null,
 *   "failedFields": []
 * }
 *
 * Clients can use these fields to:
 * - Identify error type via `code`
 * - Determine if retry is worthwhile via `retryable`
 * - Wait before retry via `retryAfterMs`
 * - Show specific field errors via `failedFields`
 * - Preserve partial data via `partialOutput`
 */

// ============================================================================
// Example 8: Client-Side Error Handling
// ============================================================================

interface ErrorResponse {
  code: string;
  message: string;
  statusCode: number;
  recoverable: boolean;
  retryable: boolean;
  retryAfterMs?: number;
  failedFields?: string[];
  partialOutput?: Record<string, unknown>;
}

class ApiClient {
  async retryableRequest<T>(
    url: string,
    options: RequestInit = {},
    maxRetries: number = 3,
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);

        if (!response.ok) {
          const errorData: ErrorResponse = await response.json();

          // Rate limited - use server's retry hint
          if (errorData.code === 'RATE_LIMITED' && errorData.retryAfterMs) {
            await this.sleep(errorData.retryAfterMs);
            continue;
          }

          // Server error and retryable - exponential backoff
          if (errorData.retryable && errorData.statusCode >= 500) {
            const backoffMs = Math.pow(2, attempt) * 1000;
            await this.sleep(backoffMs);
            continue;
          }

          // Non-retryable error
          throw new Error(errorData.message);
        }

        return response.json();
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error;
        }
      }
    }

    throw new Error('Max retries exceeded');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Example 9: Handling Partial Failures
// ============================================================================

class BatchUploadClient {
  async uploadBatch(items: BatchItem[]) {
    try {
      return await this.apiCall('/batch-upload', items);
    } catch (error: any) {
      if (error.code === 'PARTIAL_FAILURE') {
        console.log('Partial success:');
        console.log('- Successful:', Object.keys(error.partialOutput || {}).length);
        console.log('- Failed:', error.failedFields?.length || 0);

        // Save successful data
        await this.savePartialResults(error.partialOutput);

        // Retry only failed items
        const failedItems = items.filter((item) =>
          error.failedFields?.includes(item.id),
        );
        return this.retryFailedItems(failedItems);
      }

      throw error;
    }
  }

  private async apiCall(url: string, data: unknown) {
    // Simulate API call
    throw {
      code: 'PARTIAL_FAILURE',
      partialOutput: { item1: 'success' },
      failedFields: ['item2', 'item3'],
    };
  }

  private async savePartialResults(data: Record<string, unknown> | undefined) {
    console.log('Saving partial results:', data);
  }

  private async retryFailedItems(items: BatchItem[]) {
    console.log('Retrying failed items:', items.length);
  }
}

// ============================================================================
// Demo
// ============================================================================

async function demo() {
  console.log('=== HTTP Error Handling Examples ===\n');

  // Example 1: Skill not found
  try {
    const service = new SkillService();
    await service.getSkill('non-existent');
  } catch (error: any) {
    console.log('1. SkillNotFoundException:');
    console.log('   Code:', error.errorCode);
    console.log('   Message:', error.message);
    console.log('   Status:', error.getStatus());
    console.log();
  }

  // Example 2: Validation error
  try {
    const controller = new SkillController();
    await controller.createSkill({ name: 'ab', trigger: '', content: 'test' });
  } catch (error: any) {
    console.log('2. ValidationException:');
    console.log('   Code:', error.errorCode);
    console.log('   Message:', error.message);
    console.log('   Failed fields:', error.failedFields);
    console.log();
  }

  // Example 3: Rate limit
  try {
    const rateLimiter = new RateLimiter();
    for (let i = 0; i < 102; i++) {
      await rateLimiter.checkRateLimit('user-123');
    }
  } catch (error: any) {
    console.log('3. RateLimitedException:');
    console.log('   Code:', error.errorCode);
    console.log('   Retry after:', error.retryAfterMs, 'ms');
    console.log('   Retryable:', error.retryable);
    console.log();
  }

  // Example 4: Permission denied
  try {
    const authService = new AuthService();
    authService.checkPermission('user-123', 'skills:write');
  } catch (error: any) {
    console.log('4. PermissionDeniedException:');
    console.log('   Code:', error.errorCode);
    console.log('   Message:', error.message);
    console.log();
  }

  console.log('✅ All examples completed!');
}

// Run demo if executed directly
if (require.main === module) {
  demo().catch(console.error);
}

export {
  SkillService,
  SkillController,
  RateLimiter,
  AuthService,
  AgentExecutor,
  BatchProcessor,
  ApiClient,
  BatchUploadClient,
};
