/**
 * E2E Integration Tests
 *
 * Tests for core backend services without requiring actual CLI spawning.
 * These tests verify the data flow and persistence layers.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { MessagesModule } from '../../src/messages/messages.module';
import { SkillsModule } from '../../src/skills/skills.module';
import { FilesModule } from '../../src/files/files.module';
import { TenantsModule } from '../../src/tenants/tenants.module';
import { McpModule } from '../../src/mcp/mcp.module';

import { MessagesService } from '../../src/messages/messages.service';
import { TokenUsageService } from '../../src/messages/token-usage.service';
import { ThinkingBlocksService } from '../../src/messages/thinking-blocks.service';
import { ToolEventsService } from '../../src/messages/tool-events.service';
import { Message } from '../../src/messages/entities/message.entity';

import {
  getTestDatabaseOptions,
  seedTestData,
  TEST_ENTITIES,
} from '../setup/test-database';

describe('E2E Integration Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let messagesService: MessagesService;
  let tokenUsageService: TokenUsageService;
  let thinkingBlocksService: ThinkingBlocksService;
  let toolEventsService: ToolEventsService;
  let messageRepository: Repository<Message>;
  let testTenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              workspace: {
                dir: '/tmp/ccaas-e2e-test',
              },
            }),
          ],
        }),
        TypeOrmModule.forRoot(getTestDatabaseOptions()),
        TypeOrmModule.forFeature(TEST_ENTITIES),
        MessagesModule,
        SkillsModule,
        FilesModule,
        TenantsModule,
        McpModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    messagesService = moduleFixture.get(MessagesService);
    tokenUsageService = moduleFixture.get(TokenUsageService);
    thinkingBlocksService = moduleFixture.get(ThinkingBlocksService);
    toolEventsService = moduleFixture.get(ToolEventsService);
    messageRepository = dataSource.getRepository(Message);

    // Seed test data
    const { tenant } = await seedTestData(dataSource);
    testTenantId = tenant.id;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clear messages before each test
    await messageRepository.clear();
  });

  describe('Message Persistence', () => {
    it('should create and retrieve messages', async () => {
      const sessionId = `session-${Date.now()}`;

      // Create user message
      const userMessage = await messagesService.create({
        sessionId,
        solutionId: testTenantId,
        role: 'user',
        content: 'Hello, Claude!',
      });

      expect(userMessage).toBeDefined();
      expect(userMessage.role).toBe('user');
      expect(userMessage.content).toBe('Hello, Claude!');
      expect(userMessage.solutionId).toBe(testTenantId);

      // Create assistant response
      const assistantMessage = await messagesService.create({
        sessionId,
        solutionId: testTenantId,
        role: 'assistant',
        content: 'Hello! How can I help you today?',
      });

      expect(assistantMessage.role).toBe('assistant');

      // Retrieve messages for session
      const messages = await messagesService.findBySessionId(sessionId);
      expect(messages.length).toBe(2);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
    });

    it('should update message content', async () => {
      const sessionId = `session-${Date.now()}`;

      const message = await messagesService.create({
        sessionId,
        solutionId: testTenantId,
        role: 'assistant',
        content: 'Initial content',
      });

      // Update content (simulating streaming accumulation)
      await messagesService.updateContent(message.id, 'Updated full content');

      const updated = await messagesService.findById(message.id);
      expect(updated?.content).toBe('Updated full content');
    });

    it('should isolate messages by tenant', async () => {
      const sessionId1 = `session-t1-${Date.now()}`;
      const sessionId2 = `session-t2-${Date.now()}`;
      const tenant1 = 'tenant-msg-1';
      const tenant2 = 'tenant-msg-2';

      await messagesService.create({
        sessionId: sessionId1,
        solutionId: tenant1,
        role: 'user',
        content: 'Solution 1 message',
      });

      await messagesService.create({
        sessionId: sessionId2,
        solutionId: tenant2,
        role: 'user',
        content: 'Solution 2 message',
      });

      // Query by tenant
      const t1Messages = await messageRepository.find({
        where: { solutionId: tenant1 },
      });
      const t2Messages = await messageRepository.find({
        where: { solutionId: tenant2 },
      });

      expect(t1Messages.length).toBe(1);
      expect(t1Messages[0].content).toBe('Solution 1 message');

      expect(t2Messages.length).toBe(1);
      expect(t2Messages[0].content).toBe('Solution 2 message');
    });
  });

  describe('Token Usage Tracking', () => {
    it('should track token usage for messages', async () => {
      const sessionId = `session-${Date.now()}`;

      const message = await messagesService.create({
        sessionId,
        solutionId: testTenantId,
        role: 'assistant',
        content: 'Response content',
      });

      // Record token usage
      const usage = await tokenUsageService.recordUsage({
        messageId: message.id,
        sessionId,
        solutionId: testTenantId,
        model: 'claude-sonnet-4-20250514',
        inputTokens: 1000,
        outputTokens: 500,
        cachedInputTokens: 200,
      });

      expect(usage.inputTokens).toBe(1000);
      expect(usage.outputTokens).toBe(500);
      expect(usage.estimatedCostUsd).toBeGreaterThan(0);
    });

    it('should calculate session summary', async () => {
      const sessionId = `session-${Date.now()}`;

      // Create multiple usage events
      for (let i = 0; i < 3; i++) {
        await tokenUsageService.recordUsage({
          messageId: `msg-${i}`,
          sessionId,
          solutionId: testTenantId,
          model: 'claude-sonnet-4-20250514',
          inputTokens: 100 * (i + 1),
          outputTokens: 50 * (i + 1),
        });
      }

      const summary = await tokenUsageService.getSessionSummary(sessionId);

      expect(summary.requestCount).toBe(3);
      expect(summary.totalInputTokens).toBe(100 + 200 + 300);
      expect(summary.totalOutputTokens).toBe(50 + 100 + 150);
      expect(summary.totalCostUsd).toBeGreaterThan(0);
    });
  });

  describe('Thinking Block Tracking', () => {
    it('should track thinking blocks', async () => {
      const sessionId = `session-${Date.now()}`;

      const message = await messagesService.create({
        sessionId,
        solutionId: testTenantId,
        role: 'assistant',
        content: 'Response with thinking',
      });

      // Start thinking block
      const thinkingBlock = await thinkingBlocksService.startThinking({
        messageId: message.id,
        sessionId,
        solutionId: testTenantId,
        thinkingId: 'thinking_001',
        content: 'Let me analyze this problem step by step...',
      });

      expect(thinkingBlock).toBeDefined();
      expect(thinkingBlock.content).toContain('step by step');
      expect(thinkingBlock.status).toBe('in_progress');
    });

    it('should append to thinking content and complete', async () => {
      const sessionId = `session-${Date.now()}`;

      const message = await messagesService.create({
        sessionId,
        solutionId: testTenantId,
        role: 'assistant',
        content: 'Response',
      });

      // Start thinking block
      await thinkingBlocksService.startThinking({
        messageId: message.id,
        sessionId,
        solutionId: testTenantId,
        thinkingId: 'thinking_002',
        content: 'First thought...',
      });

      // Append more content using delta
      await thinkingBlocksService.appendDelta('thinking_002', ' Second thought...');

      // End thinking
      const updated = await thinkingBlocksService.endThinking('thinking_002', 150);
      expect(updated?.content).toBe('First thought... Second thought...');
      expect(updated?.status).toBe('complete');
      expect(updated?.thinkingTokens).toBe(150);
    });
  });

  describe('Tool Event Tracking', () => {
    it('should track tool invocations', async () => {
      const sessionId = `session-${Date.now()}`;

      const message = await messagesService.create({
        sessionId,
        solutionId: testTenantId,
        role: 'assistant',
        content: 'Response with tool use',
      });

      // Record tool start
      const startEvent = await toolEventsService.create({
        messageId: message.id,
        sessionId,
        solutionId: testTenantId,
        toolUseId: 'toolu_123',
        toolName: 'Write',
        phase: 'start',
        toolInput: { file_path: '/test.txt', content: 'Hello' },
      });

      expect(startEvent).toBeDefined();
      expect(startEvent.toolName).toBe('Write');
      expect(startEvent.phase).toBe('start');

      // Record tool end with result
      const endEvent = await toolEventsService.create({
        messageId: message.id,
        sessionId,
        solutionId: testTenantId,
        toolUseId: 'toolu_123',
        toolName: 'Write',
        phase: 'end',
        toolInput: { file_path: '/test.txt', content: 'Hello' },
        toolOutput: 'File written successfully',
        success: true,
        durationMs: 50,
      });

      expect(endEvent.phase).toBe('end');
      expect(endEvent.success).toBe(true);
      expect(endEvent.toolOutput).toBe('File written successfully');
      expect(endEvent.durationMs).toBe(50);
    });

    it('should track tool errors', async () => {
      const sessionId = `session-${Date.now()}`;

      const message = await messagesService.create({
        sessionId,
        solutionId: testTenantId,
        role: 'assistant',
        content: 'Response with tool error',
      });

      // Record tool start
      await toolEventsService.create({
        messageId: message.id,
        sessionId,
        solutionId: testTenantId,
        toolUseId: 'toolu_456',
        toolName: 'Bash',
        phase: 'start',
        toolInput: { command: 'invalid-command' },
      });

      // Record tool end with error
      const endEvent = await toolEventsService.create({
        messageId: message.id,
        sessionId,
        solutionId: testTenantId,
        toolUseId: 'toolu_456',
        toolName: 'Bash',
        phase: 'end',
        toolInput: { command: 'invalid-command' },
        toolOutput: 'Command not found: invalid-command',
        success: false,
        durationMs: 10,
      });

      expect(endEvent.phase).toBe('end');
      expect(endEvent.success).toBe(false);
    });
  });

  describe('Multi-Turn Conversation Flow', () => {
    it('should maintain conversation context across turns', async () => {
      const sessionId = `session-${Date.now()}`;

      // Turn 1: User asks a question
      await messagesService.create({
        sessionId,
        solutionId: testTenantId,
        role: 'user',
        content: 'What is TypeScript?',
      });

      const response1 = await messagesService.create({
        sessionId,
        solutionId: testTenantId,
        role: 'assistant',
        content: 'TypeScript is a typed superset of JavaScript...',
      });

      await tokenUsageService.recordUsage({
        messageId: response1.id,
        sessionId,
        solutionId: testTenantId,
        model: 'claude-sonnet-4-20250514',
        inputTokens: 500,
        outputTokens: 300,
      });

      // Turn 2: Follow-up question
      await messagesService.create({
        sessionId,
        solutionId: testTenantId,
        role: 'user',
        content: 'How do I install it?',
      });

      const response2 = await messagesService.create({
        sessionId,
        solutionId: testTenantId,
        role: 'assistant',
        content: 'You can install TypeScript using npm...',
      });

      await tokenUsageService.recordUsage({
        messageId: response2.id,
        sessionId,
        solutionId: testTenantId,
        model: 'claude-sonnet-4-20250514',
        inputTokens: 800, // Includes previous context
        outputTokens: 200,
        cachedInputTokens: 400, // Some context is cached
      });

      // Verify conversation
      const messages = await messagesService.findBySessionId(sessionId);
      expect(messages.length).toBe(4);

      // Verify token accumulation
      const summary = await tokenUsageService.getSessionSummary(sessionId);
      expect(summary.requestCount).toBe(2);
      expect(summary.totalInputTokens).toBe(1300);
      expect(summary.totalCachedTokens).toBe(400);
      expect(summary.cacheHitRate).toBeGreaterThan(0);
    });
  });

  describe('Session Cleanup', () => {
    it('should delete all session data', async () => {
      const sessionId = `session-cleanup-${Date.now()}`;

      // Create session data
      const message = await messagesService.create({
        sessionId,
        solutionId: testTenantId,
        role: 'assistant',
        content: 'Test message',
      });

      await tokenUsageService.recordUsage({
        messageId: message.id,
        sessionId,
        solutionId: testTenantId,
        model: 'claude-sonnet-4-20250514',
        inputTokens: 100,
        outputTokens: 50,
      });

      await thinkingBlocksService.startThinking({
        messageId: message.id,
        sessionId,
        solutionId: testTenantId,
        thinkingId: 'think_cleanup',
        content: 'Thinking content',
      });
      // End the thinking block so it's persisted
      await thinkingBlocksService.endThinking('think_cleanup');

      await toolEventsService.create({
        messageId: message.id,
        sessionId,
        solutionId: testTenantId,
        toolUseId: 'toolu_cleanup',
        toolName: 'Read',
        phase: 'end',
        toolInput: { file_path: '/test.txt' },
        success: true,
      });

      // Verify data exists
      let messages = await messagesService.findBySessionId(sessionId);
      expect(messages.length).toBe(1);

      // Delete session data
      await messagesService.deleteBySessionId(sessionId);
      await tokenUsageService.deleteBySessionId(sessionId);
      await thinkingBlocksService.deleteBySessionId(sessionId);
      await toolEventsService.deleteBySessionId(sessionId);

      // Verify deletion
      messages = await messagesService.findBySessionId(sessionId);
      expect(messages.length).toBe(0);

      const usage = await tokenUsageService.getBySessionId(sessionId);
      expect(usage.length).toBe(0);
    });
  });
});
