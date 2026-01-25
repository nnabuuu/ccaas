/**
 * Multi-Tenancy Entity Tests
 *
 * Tests to verify that entities have proper tenantId property.
 */

import { TokenUsageEvent } from './token-usage-event.entity';
import { ThinkingBlock } from './thinking-block.entity';
import { ToolEvent } from './tool-event.entity';
import { ProcessLifecycleEvent } from './process-lifecycle-event.entity';
import { ApiErrorEvent } from './api-error-event.entity';
import { UserContextEvent } from './user-context-event.entity';

describe('Multi-Tenancy Entity Configuration', () => {
  describe('TokenUsageEvent', () => {
    it('should allow setting tenantId', () => {
      const event = new TokenUsageEvent();
      event.tenantId = 'tenant-123';
      expect(event.tenantId).toBe('tenant-123');
    });

    it('should allow undefined tenantId', () => {
      const event = new TokenUsageEvent();
      expect(event.tenantId).toBeUndefined();
    });

    it('should have tenantId as optional property', () => {
      const event = new TokenUsageEvent();
      // Should not throw when accessing undefined tenantId
      expect(() => event.tenantId).not.toThrow();
    });
  });

  describe('ThinkingBlock', () => {
    it('should allow setting tenantId', () => {
      const block = new ThinkingBlock();
      block.tenantId = 'tenant-456';
      expect(block.tenantId).toBe('tenant-456');
    });

    it('should allow undefined tenantId', () => {
      const block = new ThinkingBlock();
      expect(block.tenantId).toBeUndefined();
    });

    it('should have tenantId as optional property', () => {
      const block = new ThinkingBlock();
      expect(() => block.tenantId).not.toThrow();
    });
  });

  describe('ToolEvent', () => {
    it('should allow setting tenantId', () => {
      const event = new ToolEvent();
      event.tenantId = 'tenant-789';
      expect(event.tenantId).toBe('tenant-789');
    });

    it('should allow undefined tenantId', () => {
      const event = new ToolEvent();
      expect(event.tenantId).toBeUndefined();
    });

    it('should have tenantId as optional property', () => {
      const event = new ToolEvent();
      expect(() => event.tenantId).not.toThrow();
    });
  });

  describe('ProcessLifecycleEvent', () => {
    it('should allow setting tenantId', () => {
      const event = new ProcessLifecycleEvent();
      event.tenantId = 'tenant-abc';
      expect(event.tenantId).toBe('tenant-abc');
    });

    it('should allow undefined tenantId', () => {
      const event = new ProcessLifecycleEvent();
      expect(event.tenantId).toBeUndefined();
    });

    it('should have tenantId as optional property', () => {
      const event = new ProcessLifecycleEvent();
      expect(() => event.tenantId).not.toThrow();
    });
  });

  describe('ApiErrorEvent', () => {
    it('should allow setting tenantId', () => {
      const event = new ApiErrorEvent();
      event.tenantId = 'tenant-def';
      expect(event.tenantId).toBe('tenant-def');
    });

    it('should allow undefined tenantId', () => {
      const event = new ApiErrorEvent();
      expect(event.tenantId).toBeUndefined();
    });

    it('should have tenantId as optional property', () => {
      const event = new ApiErrorEvent();
      expect(() => event.tenantId).not.toThrow();
    });
  });

  describe('UserContextEvent', () => {
    it('should allow setting tenantId', () => {
      const event = new UserContextEvent();
      event.tenantId = 'tenant-ghi';
      expect(event.tenantId).toBe('tenant-ghi');
    });

    it('should allow undefined tenantId', () => {
      const event = new UserContextEvent();
      expect(event.tenantId).toBeUndefined();
    });

    it('should have tenantId as optional property', () => {
      const event = new UserContextEvent();
      expect(() => event.tenantId).not.toThrow();
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
        it('should accept UUID format tenantId', () => {
          const uuid = '123e4567-e89b-12d3-a456-426614174000';
          (instance as any).tenantId = uuid;
          expect((instance as any).tenantId).toBe(uuid);
        });

        it('should accept slug format tenantId', () => {
          const slug = 'my-company-tenant';
          (instance as any).tenantId = slug;
          expect((instance as any).tenantId).toBe(slug);
        });

        it('should accept null-like empty string', () => {
          (instance as any).tenantId = '';
          expect((instance as any).tenantId).toBe('');
        });
      });
    });
  });
});
