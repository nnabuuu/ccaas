/**
 * Token Usage Integration Tests
 *
 * Tests for token usage tracking and analytics:
 * - Token usage event creation
 * - Multi-tenant usage tracking
 * - Cost calculation
 * - Analytics queries
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { MessagesModule } from '../../src/messages/messages.module';
import { TokenUsageService } from '../../src/messages/token-usage.service';
import { TokenUsageEvent } from '../../src/messages/entities/token-usage-event.entity';
import { Message } from '../../src/messages/entities/message.entity';

import {
  getTestDatabaseOptions,
  seedTestData,
  TEST_ENTITIES,
} from '../setup/test-database';

describe('Token Usage Integration Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let tokenUsageService: TokenUsageService;
  let usageRepository: Repository<TokenUsageEvent>;
  let messageRepository: Repository<Message>;
  let testTenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({})],
        }),
        TypeOrmModule.forRoot(getTestDatabaseOptions()),
        TypeOrmModule.forFeature(TEST_ENTITIES),
        MessagesModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    tokenUsageService = moduleFixture.get(TokenUsageService);
    usageRepository = dataSource.getRepository(TokenUsageEvent);
    messageRepository = dataSource.getRepository(Message);

    // Seed test data
    const { tenant } = await seedTestData(dataSource);
    testTenantId = tenant.id;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await usageRepository.clear();
    await messageRepository.clear();
  });

  describe('Token Usage Recording', () => {
    it('should record token usage with tenant ID', async () => {
      const sessionId = `session-${Date.now()}`;
      const messageId = 'msg-123';

      const usage = await tokenUsageService.recordUsage({
        messageId,
        sessionId,
        tenantId: testTenantId,
        model: 'claude-sonnet-4-20250514',
        inputTokens: 1000,
        outputTokens: 500,
        cachedInputTokens: 200,
        cacheReadTokens: 150,
        cacheCreationTokens: 50,
        reasoningTokens: 100,
        stopReason: 'end_turn',
        apiMessageId: 'msg_api_123',
      });

      expect(usage).toBeDefined();
      expect(usage.tenantId).toBe(testTenantId);
      expect(usage.inputTokens).toBe(1000);
      expect(usage.outputTokens).toBe(500);
      expect(usage.cachedInputTokens).toBe(200);
      expect(usage.cacheReadTokens).toBe(150);
      expect(usage.cacheCreationTokens).toBe(50);
      expect(usage.reasoningTokens).toBe(100);
      expect(usage.estimatedCostUsd).toBeDefined();
      expect(usage.estimatedCostUsd).toBeGreaterThan(0);
    });

    it('should calculate cost correctly for different models', async () => {
      const sessionId = `session-${Date.now()}`;
      const messageId = 'msg-123';

      // Record usage for Sonnet (cheaper)
      const sonnetUsage = await tokenUsageService.recordUsage({
        messageId,
        sessionId,
        tenantId: testTenantId,
        model: 'claude-sonnet-4-20250514',
        inputTokens: 1000,
        outputTokens: 500,
      });

      // Record usage for Opus (more expensive)
      const opusUsage = await tokenUsageService.recordUsage({
        messageId: 'msg-456',
        sessionId,
        tenantId: testTenantId,
        model: 'claude-opus-4-5-20251101',
        inputTokens: 1000,
        outputTokens: 500,
      });

      // Opus should cost more than Sonnet
      expect(opusUsage.estimatedCostUsd!).toBeGreaterThan(sonnetUsage.estimatedCostUsd!);
    });

    it('should handle null tenant ID', async () => {
      const sessionId = `session-${Date.now()}`;

      const usage = await tokenUsageService.recordUsage({
        messageId: 'msg-no-tenant',
        sessionId,
        tenantId: null,
        model: 'claude-sonnet-4-20250514',
        inputTokens: 100,
        outputTokens: 50,
      });

      expect(usage).toBeDefined();
      expect(usage.tenantId).toBeNull();
    });
  });

  describe('Session Summary', () => {
    it('should calculate session usage summary', async () => {
      const sessionId = `session-${Date.now()}`;

      // Record multiple usage events
      for (let i = 0; i < 5; i++) {
        await tokenUsageService.recordUsage({
          messageId: `msg-${i}`,
          sessionId,
          tenantId: testTenantId,
          model: 'claude-sonnet-4-20250514',
          inputTokens: 100 * (i + 1),
          outputTokens: 50 * (i + 1),
          cachedInputTokens: 20 * (i + 1),
          reasoningTokens: 10 * (i + 1),
        });
      }

      const summary = await tokenUsageService.getSessionSummary(sessionId);

      expect(summary.requestCount).toBe(5);
      expect(summary.totalInputTokens).toBe(100 + 200 + 300 + 400 + 500);
      expect(summary.totalOutputTokens).toBe(50 + 100 + 150 + 200 + 250);
      expect(summary.totalCachedTokens).toBe(20 + 40 + 60 + 80 + 100);
      expect(summary.totalReasoningTokens).toBe(10 + 20 + 30 + 40 + 50);
      expect(summary.totalCostUsd).toBeGreaterThan(0);
      expect(summary.cacheHitRate).toBeGreaterThan(0);
    });

    it('should calculate model breakdown', async () => {
      const sessionId = `session-${Date.now()}`;

      // Mix of models
      await tokenUsageService.recordUsage({
        messageId: 'msg-1',
        sessionId,
        tenantId: testTenantId,
        model: 'claude-sonnet-4-20250514',
        inputTokens: 1000,
        outputTokens: 500,
      });

      await tokenUsageService.recordUsage({
        messageId: 'msg-2',
        sessionId,
        tenantId: testTenantId,
        model: 'claude-sonnet-4-20250514',
        inputTokens: 1500,
        outputTokens: 750,
      });

      await tokenUsageService.recordUsage({
        messageId: 'msg-3',
        sessionId,
        tenantId: testTenantId,
        model: 'claude-opus-4-5-20251101',
        inputTokens: 500,
        outputTokens: 250,
      });

      const summary = await tokenUsageService.getSessionSummary(sessionId);

      expect(summary.modelBreakdown).toBeDefined();
      expect(Object.keys(summary.modelBreakdown).length).toBe(2);
      expect(summary.modelBreakdown['claude-sonnet-4-20250514'].requests).toBe(2);
      expect(summary.modelBreakdown['claude-opus-4-5-20251101'].requests).toBe(1);
    });
  });

  describe('Tenant Usage Analytics', () => {
    it('should aggregate usage by model for a tenant', async () => {
      const sessionId = `session-${Date.now()}`;

      // Record various usage events
      await tokenUsageService.recordUsage({
        messageId: 'msg-1',
        sessionId,
        tenantId: testTenantId,
        model: 'claude-sonnet-4-20250514',
        inputTokens: 1000,
        outputTokens: 500,
      });

      await tokenUsageService.recordUsage({
        messageId: 'msg-2',
        sessionId,
        tenantId: testTenantId,
        model: 'claude-haiku-3.5',
        inputTokens: 2000,
        outputTokens: 1000,
      });

      const usageByModel = await tokenUsageService.getTenantUsageByModel(testTenantId);

      expect(usageByModel.length).toBe(2);

      const sonnetUsage = usageByModel.find(u => u.model === 'claude-sonnet-4-20250514');
      expect(sonnetUsage).toBeDefined();
      expect(Number(sonnetUsage!.totalInputTokens)).toBe(1000);

      const haikuUsage = usageByModel.find(u => u.model === 'claude-haiku-3.5');
      expect(haikuUsage).toBeDefined();
      expect(Number(haikuUsage!.totalInputTokens)).toBe(2000);
    });

    it('should filter usage by date range', async () => {
      const sessionId = `session-${Date.now()}`;

      // Create usage events
      await tokenUsageService.recordUsage({
        messageId: 'msg-1',
        sessionId,
        tenantId: testTenantId,
        model: 'claude-sonnet-4-20250514',
        inputTokens: 1000,
        outputTokens: 500,
      });

      const now = new Date();
      const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow

      // Query with future date range (should return nothing)
      const noUsage = await tokenUsageService.getTenantUsageByModel(
        testTenantId,
        futureDate,
        new Date(futureDate.getTime() + 24 * 60 * 60 * 1000),
      );

      expect(noUsage.length).toBe(0);

      // Query with current date range (should return results)
      const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday
      const hasUsage = await tokenUsageService.getTenantUsageByModel(
        testTenantId,
        pastDate,
        futureDate,
      );

      expect(hasUsage.length).toBe(1);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should isolate usage by tenant', async () => {
      const tenant1 = 'tenant-1';
      const tenant2 = 'tenant-2';

      // Record usage for tenant 1
      await tokenUsageService.recordUsage({
        messageId: 'msg-t1',
        sessionId: 'session-t1',
        tenantId: tenant1,
        model: 'claude-sonnet-4-20250514',
        inputTokens: 1000,
        outputTokens: 500,
      });

      // Record usage for tenant 2
      await tokenUsageService.recordUsage({
        messageId: 'msg-t2',
        sessionId: 'session-t2',
        tenantId: tenant2,
        model: 'claude-sonnet-4-20250514',
        inputTokens: 2000,
        outputTokens: 1000,
      });

      // Query tenant 1
      const tenant1Usage = await tokenUsageService.getTenantUsageByModel(tenant1);
      expect(tenant1Usage.length).toBe(1);
      expect(Number(tenant1Usage[0].totalInputTokens)).toBe(1000);

      // Query tenant 2
      const tenant2Usage = await tokenUsageService.getTenantUsageByModel(tenant2);
      expect(tenant2Usage.length).toBe(1);
      expect(Number(tenant2Usage[0].totalInputTokens)).toBe(2000);
    });

    it('should query usage with tenant index efficiently', async () => {
      // Record many usage events
      for (let i = 0; i < 100; i++) {
        await tokenUsageService.recordUsage({
          messageId: `msg-${i}`,
          sessionId: `session-${i % 10}`,
          tenantId: i % 2 === 0 ? testTenantId : 'other-tenant',
          model: 'claude-sonnet-4-20250514',
          inputTokens: 100,
          outputTokens: 50,
        });
      }

      // Query should be efficient with index
      const startTime = Date.now();
      const usage = await tokenUsageService.getTenantUsageByModel(testTenantId);
      const queryTime = Date.now() - startTime;

      expect(usage.length).toBe(1);
      expect(Number(usage[0].requestCount)).toBe(50); // Half of 100
      expect(queryTime).toBeLessThan(1000); // Should be fast
    });
  });

  describe('Context Window Tracking', () => {
    it('should track context window usage', async () => {
      const sessionId = `session-${Date.now()}`;

      await tokenUsageService.recordUsage({
        messageId: 'msg-1',
        sessionId,
        tenantId: testTenantId,
        model: 'claude-sonnet-4-20250514',
        inputTokens: 50000,
        outputTokens: 5000,
        contextWindowUsage: {
          used: 55000,
          limit: 200000,
          percentFull: 27.5,
        },
      });

      await tokenUsageService.recordUsage({
        messageId: 'msg-2',
        sessionId,
        tenantId: testTenantId,
        model: 'claude-sonnet-4-20250514',
        inputTokens: 100000,
        outputTokens: 10000,
        contextWindowUsage: {
          used: 165000,
          limit: 200000,
          percentFull: 82.5,
        },
      });

      const summary = await tokenUsageService.getSessionSummary(sessionId);

      expect(summary.averageContextUsage).toBeDefined();
      expect(summary.averageContextUsage).toBeCloseTo(55, 0); // Average of 27.5 and 82.5
    });
  });

  describe('Cleanup', () => {
    it('should delete usage events by session', async () => {
      const sessionId = `session-${Date.now()}`;

      // Create usage events
      for (let i = 0; i < 5; i++) {
        await tokenUsageService.recordUsage({
          messageId: `msg-${i}`,
          sessionId,
          tenantId: testTenantId,
          model: 'claude-sonnet-4-20250514',
          inputTokens: 100,
          outputTokens: 50,
        });
      }

      // Verify events exist
      const before = await tokenUsageService.getBySessionId(sessionId);
      expect(before.length).toBe(5);

      // Delete
      const deleted = await tokenUsageService.deleteBySessionId(sessionId);
      expect(deleted).toBe(5);

      // Verify deletion
      const after = await tokenUsageService.getBySessionId(sessionId);
      expect(after.length).toBe(0);
    });
  });
});
