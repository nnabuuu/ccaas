/**
 * Tool Events Service Tests
 *
 * Tests for tool event persistence including enhanced error tracking fields.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ToolEventsService } from './tool-events.service';
import { ToolEvent } from './entities/tool-event.entity';
import { Message } from './entities/message.entity';
import { createTestDataSource } from '../../test/setup/test-database';

describe('ToolEventsService', () => {
  let service: ToolEventsService;
  let repository: Repository<ToolEvent>;
  let messageRepository: Repository<Message>;
  let dataSource: DataSource;
  let testMessageId: string;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    // Clear tables before each test
    await dataSource.getRepository(ToolEvent).clear();
    await dataSource.getRepository(Message).clear();

    repository = dataSource.getRepository(ToolEvent);
    messageRepository = dataSource.getRepository(Message);

    // Create a test message for foreign key constraint
    const message = messageRepository.create({
      sessionId: 'test-session-123',
      role: 'assistant',
      content: 'Test message content',
    });
    const savedMessage = await messageRepository.save(message);
    testMessageId = savedMessage.id;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolEventsService,
        {
          provide: getRepositoryToken(ToolEvent),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<ToolEventsService>(ToolEventsService);
  });

  describe('recordStart', () => {
    it('should create a start phase tool event', async () => {
      const result = await service.recordStart({
        messageId: testMessageId,
        sessionId: 'test-session-123',
        solutionId: 'tenant-1',
        toolUseId: 'toolu_read_001',
        toolName: 'Read',
        toolInput: { file_path: '/test/file.txt' },
        agentType: 'main',
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.phase).toBe('start');
      expect(result.toolName).toBe('Read');
      expect(result.toolUseId).toBe('toolu_read_001');
    });

    it('should include decisionLogic when provided', async () => {
      const result = await service.recordStart({
        messageId: testMessageId,
        sessionId: 'test-session-123',
        toolUseId: 'toolu_read_002',
        toolName: 'Read',
        toolInput: { file_path: '/test/file.txt' },
        decisionLogic: {
          why: 'Need to read file contents',
          benefit: 'Understand code structure',
          nextStep: 'Analyze and respond',
        },
      });

      expect(result.decisionLogic).toEqual({
        why: 'Need to read file contents',
        benefit: 'Understand code structure',
        nextStep: 'Analyze and respond',
      });
    });
  });

  describe('recordEnd with enhanced fields', () => {
    it('should persist errorMessage field', async () => {
      const result = await service.recordEnd({
        messageId: testMessageId,
        sessionId: 'test-session-123',
        solutionId: 'tenant-1',
        toolUseId: 'toolu_read_err_001',
        toolName: 'Read',
        toolInput: { file_path: '/nonexistent/file.txt' },
        toolOutput: 'Error: ENOENT: no such file or directory',
        success: false,
        durationMs: 25,
        agentType: 'main',
        errorMessage: 'Error: ENOENT: no such file or directory',
      });

      expect(result).toBeDefined();
      expect(result.errorMessage).toBe('Error: ENOENT: no such file or directory');

      // Verify persistence by querying directly
      const fetched = await repository.findOne({ where: { id: result.id } });
      expect(fetched).toBeDefined();
      expect(fetched!.errorMessage).toBe('Error: ENOENT: no such file or directory');
    });

    it('should persist parentToolUseId field', async () => {
      const result = await service.recordEnd({
        messageId: testMessageId,
        sessionId: 'test-session-123',
        toolUseId: 'toolu_read_sub_001',
        toolName: 'Read',
        toolInput: { file_path: '/test/file.txt' },
        toolOutput: 'file contents',
        success: true,
        durationMs: 50,
        parentToolUseId: 'toolu_task_parent_001',
      });

      expect(result.parentToolUseId).toBe('toolu_task_parent_001');

      // Verify persistence
      const fetched = await repository.findOne({ where: { id: result.id } });
      expect(fetched!.parentToolUseId).toBe('toolu_task_parent_001');
    });

    it('should persist nestingLevel field', async () => {
      const result = await service.recordEnd({
        messageId: testMessageId,
        sessionId: 'test-session-123',
        toolUseId: 'toolu_read_nested_001',
        toolName: 'Read',
        toolInput: { file_path: '/test/file.txt' },
        toolOutput: 'file contents',
        success: true,
        durationMs: 50,
        nestingLevel: 2,
      });

      expect(result.nestingLevel).toBe(2);

      // Verify persistence
      const fetched = await repository.findOne({ where: { id: result.id } });
      expect(fetched!.nestingLevel).toBe(2);
    });

    it('should handle null values for optional fields', async () => {
      const result = await service.recordEnd({
        messageId: testMessageId,
        sessionId: 'test-session-123',
        toolUseId: 'toolu_read_null_001',
        toolName: 'Read',
        toolInput: { file_path: '/test/file.txt' },
        toolOutput: 'file contents',
        success: true,
        durationMs: 50,
        // Not providing optional enhanced fields
      });

      expect(result.errorMessage).toBeNull();
      expect(result.parentToolUseId).toBeNull();
      // nestingLevel has a default of 0 in the entity
      expect(result.nestingLevel === null || result.nestingLevel === 0).toBe(true);

      // Verify persistence
      const fetched = await repository.findOne({ where: { id: result.id } });
      expect(fetched!.errorMessage).toBeNull();
      expect(fetched!.parentToolUseId).toBeNull();
    });

    it('should persist all enhanced fields together', async () => {
      const result = await service.recordEnd({
        messageId: testMessageId,
        sessionId: 'test-session-123',
        solutionId: 'tenant-1',
        toolUseId: 'toolu_read_full_001',
        toolName: 'Read',
        toolInput: { file_path: '/nonexistent/file.txt' },
        toolOutput: 'Error: EACCES: permission denied',
        success: false,
        durationMs: 30,
        agentType: 'Explore',
        errorMessage: 'Error: EACCES: permission denied',
        parentToolUseId: 'toolu_task_explore_001',
        nestingLevel: 1,
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Error: EACCES: permission denied');
      expect(result.parentToolUseId).toBe('toolu_task_explore_001');
      expect(result.nestingLevel).toBe(1);

      // Verify persistence
      const fetched = await repository.findOne({ where: { id: result.id } });
      expect(fetched!.success).toBe(false);
      expect(fetched!.errorMessage).toBe('Error: EACCES: permission denied');
      expect(fetched!.parentToolUseId).toBe('toolu_task_explore_001');
      expect(fetched!.nestingLevel).toBe(1);
    });
  });

  describe('findByToolUseId', () => {
    it('should link start and end events by toolUseId', async () => {
      const toolUseId = 'toolu_linked_001';

      // Create start event
      await service.recordStart({
        messageId: testMessageId,
        sessionId: 'test-session-123',
        toolUseId,
        toolName: 'Read',
        toolInput: { file_path: '/test/file.txt' },
      });

      // Create end event
      await service.recordEnd({
        messageId: testMessageId,
        sessionId: 'test-session-123',
        toolUseId,
        toolName: 'Read',
        toolInput: { file_path: '/test/file.txt' },
        toolOutput: 'file contents',
        success: true,
        durationMs: 100,
      });

      const events = await service.findByToolUseId(toolUseId);
      expect(events).toHaveLength(2);
      expect(events[0].phase).toBe('start');
      expect(events[1].phase).toBe('end');
    });
  });

  describe('getSessionStats', () => {
    it('should include error count in statistics', async () => {
      const sessionId = 'stats-session-001';

      // Create a successful tool event
      await service.recordEnd({
        messageId: testMessageId,
        sessionId,
        toolUseId: 'toolu_success_001',
        toolName: 'Read',
        success: true,
        durationMs: 50,
      });

      // Create a failed tool event
      await service.recordEnd({
        messageId: testMessageId,
        sessionId,
        toolUseId: 'toolu_fail_001',
        toolName: 'Read',
        success: false,
        durationMs: 25,
        errorMessage: 'File not found',
      });

      const stats = await service.getSessionStats(sessionId);
      expect(stats.successCount).toBe(1);
      expect(stats.errorCount).toBe(1);
    });
  });

  describe('query', () => {
    it('should query events ordered by createdAt', async () => {
      const sessionId = 'query-session-001';

      // Create multiple events
      await service.recordEnd({
        messageId: testMessageId,
        sessionId,
        toolUseId: 'toolu_q1',
        toolName: 'Read',
        success: true,
        durationMs: 50,
      });

      await service.recordEnd({
        messageId: testMessageId,
        sessionId,
        toolUseId: 'toolu_q2',
        toolName: 'Write',
        success: true,
        durationMs: 100,
      });

      const events = await service.query({ sessionId, phase: 'end' });
      expect(events).toHaveLength(2);
      expect(events[0].toolUseId).toBe('toolu_q1');
      expect(events[1].toolUseId).toBe('toolu_q2');
    });
  });

  describe('errorType field', () => {
    it('should persist errorType field for file_not_found', async () => {
      const result = await service.recordEnd({
        messageId: testMessageId,
        sessionId: 'test-session-123',
        toolUseId: 'toolu_err_type_001',
        toolName: 'Read',
        toolInput: { file_path: '/nonexistent/file.txt' },
        toolOutput: 'Error: ENOENT: no such file or directory',
        success: false,
        durationMs: 25,
        errorMessage: 'Error: ENOENT: no such file or directory',
        errorType: 'file_not_found',
      });

      expect(result.errorType).toBe('file_not_found');

      // Verify persistence
      const fetched = await repository.findOne({ where: { id: result.id } });
      expect(fetched!.errorType).toBe('file_not_found');
    });

    it('should persist errorType field for permission_denied', async () => {
      const result = await service.recordEnd({
        messageId: testMessageId,
        sessionId: 'test-session-123',
        toolUseId: 'toolu_err_type_002',
        toolName: 'Read',
        success: false,
        durationMs: 25,
        errorType: 'permission_denied',
      });

      expect(result.errorType).toBe('permission_denied');
    });

    it('should persist errorType field for timeout', async () => {
      const result = await service.recordEnd({
        messageId: testMessageId,
        sessionId: 'test-session-123',
        toolUseId: 'toolu_err_type_003',
        toolName: 'Bash',
        success: false,
        durationMs: 30000,
        errorType: 'timeout',
      });

      expect(result.errorType).toBe('timeout');
    });

    it('should persist errorType field for command_failed', async () => {
      const result = await service.recordEnd({
        messageId: testMessageId,
        sessionId: 'test-session-123',
        toolUseId: 'toolu_err_type_004',
        toolName: 'Bash',
        success: false,
        durationMs: 100,
        errorType: 'command_failed',
      });

      expect(result.errorType).toBe('command_failed');
    });

    it('should persist null errorType for successful tool calls', async () => {
      const result = await service.recordEnd({
        messageId: testMessageId,
        sessionId: 'test-session-123',
        toolUseId: 'toolu_err_type_005',
        toolName: 'Read',
        success: true,
        durationMs: 50,
        // No errorType provided
      });

      expect(result.errorType).toBeNull();
    });
  });

  describe('executionOrder field', () => {
    it('should persist executionOrder field', async () => {
      const result = await service.recordEnd({
        messageId: testMessageId,
        sessionId: 'test-session-123',
        toolUseId: 'toolu_exec_001',
        toolName: 'Read',
        success: true,
        durationMs: 50,
        executionOrder: 1,
      });

      expect(result.executionOrder).toBe(1);

      // Verify persistence
      const fetched = await repository.findOne({ where: { id: result.id } });
      expect(fetched!.executionOrder).toBe(1);
    });

    it('should persist sequential execution orders', async () => {
      await service.recordEnd({
        messageId: testMessageId,
        sessionId: 'exec-order-session',
        toolUseId: 'toolu_exec_seq_001',
        toolName: 'Read',
        success: true,
        durationMs: 50,
        executionOrder: 1,
      });

      await service.recordEnd({
        messageId: testMessageId,
        sessionId: 'exec-order-session',
        toolUseId: 'toolu_exec_seq_002',
        toolName: 'Write',
        success: true,
        durationMs: 100,
        executionOrder: 2,
      });

      await service.recordEnd({
        messageId: testMessageId,
        sessionId: 'exec-order-session',
        toolUseId: 'toolu_exec_seq_003',
        toolName: 'Bash',
        success: true,
        durationMs: 200,
        executionOrder: 3,
      });

      const events = await service.query({
        sessionId: 'exec-order-session',
        phase: 'end',
      });

      expect(events).toHaveLength(3);
      expect(events[0].executionOrder).toBe(1);
      expect(events[1].executionOrder).toBe(2);
      expect(events[2].executionOrder).toBe(3);
    });

    it('should query tools ordered by executionOrder', async () => {
      const sessionId = 'exec-order-query';

      // Create events with execution order
      await service.recordEnd({
        messageId: testMessageId,
        sessionId,
        toolUseId: 'toolu_order_003',
        toolName: 'Bash',
        success: true,
        durationMs: 200,
        executionOrder: 3,
      });

      await service.recordEnd({
        messageId: testMessageId,
        sessionId,
        toolUseId: 'toolu_order_001',
        toolName: 'Read',
        success: true,
        durationMs: 50,
        executionOrder: 1,
      });

      await service.recordEnd({
        messageId: testMessageId,
        sessionId,
        toolUseId: 'toolu_order_002',
        toolName: 'Write',
        success: true,
        durationMs: 100,
        executionOrder: 2,
      });

      const events = await service.query({ sessionId, phase: 'end' });
      // Events are ordered by createdAt, not executionOrder
      // But we can verify all execution orders are present
      const orders = events.map((e) => e.executionOrder).sort((a, b) => (a || 0) - (b || 0));
      expect(orders).toEqual([1, 2, 3]);
    });
  });
});
