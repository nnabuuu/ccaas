/**
 * Multi-Tenancy Entity Tests
 *
 * Tests to verify that entities have proper solutionId property.
 */

import { TokenUsageEvent } from './token-usage-event.entity';
import { ThinkingBlock } from './thinking-block.entity';
import { ToolEvent } from './tool-event.entity';
import { ProcessLifecycleEvent } from './process-lifecycle-event.entity';
import { ApiErrorEvent } from './api-error-event.entity';
import { UserContextEvent } from './user-context-event.entity';

describe('Multi-Tenancy Entity Configuration', () => {
  describe('TokenUsageEvent', () => {
    it('should allow setting solutionId', () => {
      const event = new TokenUsageEvent();
      event.solutionId = 'tenant-123';
      expect(event.solutionId).toBe('tenant-123');
    });

    it('should allow undefined solutionId', () => {
      const event = new TokenUsageEvent();
      expect(event.solutionId).toBeUndefined();
    });

    it('should have solutionId as optional property', () => {
      const event = new TokenUsageEvent();
      // Should not throw when accessing undefined solutionId
      expect(() => event.solutionId).not.toThrow();
    });
  });

  describe('ThinkingBlock', () => {
    it('should allow setting solutionId', () => {
      const block = new ThinkingBlock();
      block.solutionId = 'tenant-456';
      expect(block.solutionId).toBe('tenant-456');
    });

    it('should allow undefined solutionId', () => {
      const block = new ThinkingBlock();
      expect(block.solutionId).toBeUndefined();
    });

    it('should have solutionId as optional property', () => {
      const block = new ThinkingBlock();
      expect(() => block.solutionId).not.toThrow();
    });
  });

  describe('ToolEvent', () => {
    it('should allow setting solutionId', () => {
      const event = new ToolEvent();
      event.solutionId = 'tenant-789';
      expect(event.solutionId).toBe('tenant-789');
    });

    it('should allow undefined solutionId', () => {
      const event = new ToolEvent();
      expect(event.solutionId).toBeUndefined();
    });

    it('should have solutionId as optional property', () => {
      const event = new ToolEvent();
      expect(() => event.solutionId).not.toThrow();
    });
  });

  describe('ProcessLifecycleEvent', () => {
    it('should allow setting solutionId', () => {
      const event = new ProcessLifecycleEvent();
      event.solutionId = 'tenant-abc';
      expect(event.solutionId).toBe('tenant-abc');
    });

    it('should allow undefined solutionId', () => {
      const event = new ProcessLifecycleEvent();
      expect(event.solutionId).toBeUndefined();
    });

    it('should have solutionId as optional property', () => {
      const event = new ProcessLifecycleEvent();
      expect(() => event.solutionId).not.toThrow();
    });
  });

  describe('ApiErrorEvent', () => {
    it('should allow setting solutionId', () => {
      const event = new ApiErrorEvent();
      event.solutionId = 'tenant-def';
      expect(event.solutionId).toBe('tenant-def');
    });

    it('should allow undefined solutionId', () => {
      const event = new ApiErrorEvent();
      expect(event.solutionId).toBeUndefined();
    });

    it('should have solutionId as optional property', () => {
      const event = new ApiErrorEvent();
      expect(() => event.solutionId).not.toThrow();
    });
  });

  describe('UserContextEvent', () => {
    it('should allow setting solutionId', () => {
      const event = new UserContextEvent();
      event.solutionId = 'tenant-ghi';
      expect(event.solutionId).toBe('tenant-ghi');
    });

    it('should allow undefined solutionId', () => {
      const event = new UserContextEvent();
      expect(event.solutionId).toBeUndefined();
    });

    it('should have solutionId as optional property', () => {
      const event = new UserContextEvent();
      expect(() => event.solutionId).not.toThrow();
    });
  });

  describe('Entity TenantId Values', () => {
    const entities = [
      { name: 'TokenUsageEvent', instance: new TokenUsageEvent() },
      { name: 'ThinkingBlock', instance: new ThinkingBlock() },
      { name: 'ToolEvent', instance: new ToolEvent() },
      { name: 'ProcessLifecycleEvent', instance: new ProcessLifecycleEvent() },
      { name: 'ApiErrorEvent', instance: new ApiErrorEvent() },
      { name: 'UserContextEvent', instance: new UserContextEvent() },
    ];

    entities.forEach(({ name, instance }) => {
      describe(`${name}`, () => {
        it('should accept UUID format solutionId', () => {
          const uuid = '123e4567-e89b-12d3-a456-426614174000';
          (instance as any).solutionId = uuid;
          expect((instance as any).solutionId).toBe(uuid);
        });

        it('should accept slug format solutionId', () => {
          const slug = 'my-company-tenant';
          (instance as any).solutionId = slug;
          expect((instance as any).solutionId).toBe(slug);
        });

        it('should accept null-like empty string', () => {
          (instance as any).solutionId = '';
          expect((instance as any).solutionId).toBe('');
        });
      });
    });
  });
});
