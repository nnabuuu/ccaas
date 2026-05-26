/**
 * Conversation Lifecycle Integration Tests
 *
 * Tests the full conversation persistence lifecycle:
 * - Session creation with metadata
 * - ConversationMetadataService (auto-title, metadata retrieval)
 * - Turn tracking
 * - Solution isolation
 * - Soft delete behavior
 *
 * Uses a minimal module setup (TypeORM + ConversationMetadataService only)
 * to avoid circular dependency issues from the full SessionsModule.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Session } from '../../src/admin/entities/session.entity';
import { Turn } from '../../src/admin/entities/turn.entity';
import { ConversationMetadataService } from '../../src/sessions/services/conversation-metadata.service';

import {
  getTestDatabaseOptions,
} from '../setup/test-database';

describe('Conversation Lifecycle Integration Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let sessionRepository: Repository<Session>;
  let turnRepository: Repository<Turn>;
  let conversationMetadataService: ConversationMetadataService;
  let testTenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(getTestDatabaseOptions()),
        TypeOrmModule.forFeature([Session, Turn]),
      ],
      providers: [ConversationMetadataService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    sessionRepository = dataSource.getRepository(Session);
    turnRepository = dataSource.getRepository(Turn);
    conversationMetadataService = moduleFixture.get(ConversationMetadataService);

    // Use a fixed tenant ID for testing
    testTenantId = 'test-tenant-conversation';
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clear sessions and turns before each test
    await turnRepository.clear();
    await sessionRepository.clear();
  });

  /**
   * Helper: create a session in the database
   */
  async function createTestSession(overrides: Partial<Session> = {}): Promise<Session> {
    const session = sessionRepository.create({
      sessionId: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      solutionId: testTenantId,
      clientId: 'test-client',
      status: 'idle',
      messageCount: 0,
      totalTokens: 0,
      estimatedCost: 0,
      lastActivity: new Date(),
      ...overrides,
    });
    return sessionRepository.save(session);
  }

  // =========================================================================
  // Session Persistence
  // =========================================================================

  describe('Session Persistence', () => {
    it('should create a session with default metadata', async () => {
      const session = await createTestSession();

      expect(session.id).toBeDefined();
      expect(session.title).toBeNull();
      expect(session.isPinned).toBe(false);
      expect(session.closedAt).toBeNull();
    });

    it('should create a session with custom title', async () => {
      const session = await createTestSession({
        title: 'My first conversation',
      });

      expect(session.title).toBe('My first conversation');
    });

    it('should persist and retrieve session from database', async () => {
      const session = await createTestSession({
        title: 'Persistence test',
        isPinned: true,
      });

      // Retrieve from DB
      const retrieved = await sessionRepository.findOne({
        where: { id: session.id },
      });

      expect(retrieved).toBeDefined();
      expect(retrieved!.title).toBe('Persistence test');
      expect(retrieved!.isPinned).toBe(true);
      expect(retrieved!.sessionId).toBe(session.sessionId);
    });

    it('should update session metadata', async () => {
      const session = await createTestSession();

      session.title = 'Updated title';
      session.isPinned = true;
      await sessionRepository.save(session);

      const updated = await sessionRepository.findOne({
        where: { id: session.id },
      });

      expect(updated!.title).toBe('Updated title');
      expect(updated!.isPinned).toBe(true);
    });
  });

  // =========================================================================
  // ConversationMetadataService
  // =========================================================================

  describe('ConversationMetadataService', () => {
    it('should return metadata for existing session', async () => {
      const session = await createTestSession({
        title: 'Test conversation',
        isPinned: true,
      });

      const metadata = await conversationMetadataService.getConversationMetadata(
        session.sessionId,
      );

      expect(metadata.title).toBe('Test conversation');
      expect(metadata.isPinned).toBe(true);
    });

    it('should return defaults for non-existent session', async () => {
      const metadata = await conversationMetadataService.getConversationMetadata(
        'non-existent-session',
      );

      expect(metadata.title).toBeNull();
      expect(metadata.isPinned).toBe(false);
    });

    it('should auto-generate title from first user message', async () => {
      const session = await createTestSession();

      await conversationMetadataService.autoGenerateTitle(
        session.sessionId,
        'What is TypeScript and how do I use it?',
      );

      const updated = await sessionRepository.findOne({
        where: { sessionId: session.sessionId },
      });

      expect(updated!.title).toBe('What is TypeScript and how do I use it?');
    });

    it('should truncate long messages to 100 chars with ellipsis', async () => {
      const session = await createTestSession();

      const longMessage = 'A'.repeat(150);
      await conversationMetadataService.autoGenerateTitle(
        session.sessionId,
        longMessage,
      );

      const updated = await sessionRepository.findOne({
        where: { sessionId: session.sessionId },
      });

      expect(updated!.title!.length).toBe(103); // 100 chars + '...'
      expect(updated!.title!.endsWith('...')).toBe(true);
    });

    it('should not overwrite existing title', async () => {
      const session = await createTestSession({
        title: 'Original title',
      });

      await conversationMetadataService.autoGenerateTitle(
        session.sessionId,
        'This should not replace the original title',
      );

      const updated = await sessionRepository.findOne({
        where: { sessionId: session.sessionId },
      });

      expect(updated!.title).toBe('Original title');
    });

    it('should trim whitespace from message before generating title', async () => {
      const session = await createTestSession();

      await conversationMetadataService.autoGenerateTitle(
        session.sessionId,
        '  Hello world  ',
      );

      const updated = await sessionRepository.findOne({
        where: { sessionId: session.sessionId },
      });

      expect(updated!.title).toBe('Hello world');
    });

    it('should handle auto-title for non-existent session gracefully', async () => {
      // Should not throw
      await expect(
        conversationMetadataService.autoGenerateTitle(
          'non-existent-session',
          'Hello',
        ),
      ).resolves.toBeUndefined();
    });
  });

  // =========================================================================
  // Turn Tracking
  // =========================================================================

  describe('Turn Tracking', () => {
    it('should create a turn with correct fields', async () => {
      const session = await createTestSession();

      const turn = turnRepository.create({
        sessionId: session.sessionId,
        turnNumber: 0,
        userMessageId: 'msg-user-1',
        assistantMessageId: null,
        totalTokens: 0,
        durationMs: 0,
      });
      const saved = await turnRepository.save(turn);

      expect(saved.id).toBeDefined();
      expect(saved.sessionId).toBe(session.sessionId);
      expect(saved.turnNumber).toBe(0);
      expect(saved.userMessageId).toBe('msg-user-1');
      expect(saved.assistantMessageId).toBeNull();
    });

    it('should track multiple turns with incrementing turnNumber', async () => {
      const session = await createTestSession();

      // Create 3 turns
      for (let i = 0; i < 3; i++) {
        const turn = turnRepository.create({
          sessionId: session.sessionId,
          turnNumber: i,
          userMessageId: `msg-user-${i}`,
          assistantMessageId: `msg-assistant-${i}`,
          totalTokens: 100 * (i + 1),
          durationMs: 500 * (i + 1),
        });
        await turnRepository.save(turn);
      }

      const turns = await turnRepository.find({
        where: { sessionId: session.sessionId },
        order: { turnNumber: 'ASC' },
      });

      expect(turns.length).toBe(3);
      expect(turns[0].turnNumber).toBe(0);
      expect(turns[1].turnNumber).toBe(1);
      expect(turns[2].turnNumber).toBe(2);
      expect(turns[0].totalTokens).toBe(100);
      expect(turns[2].totalTokens).toBe(300);
    });

    it('should update turn with completion data', async () => {
      const session = await createTestSession();

      const turn = turnRepository.create({
        sessionId: session.sessionId,
        turnNumber: 0,
        userMessageId: 'msg-user-1',
      });
      const saved = await turnRepository.save(turn);

      // Update with completion data
      saved.assistantMessageId = 'msg-assistant-1';
      saved.totalTokens = 1500;
      saved.durationMs = 3200;
      saved.completedAt = new Date();
      await turnRepository.save(saved);

      const updated = await turnRepository.findOne({
        where: { id: saved.id },
      });

      expect(updated!.assistantMessageId).toBe('msg-assistant-1');
      expect(updated!.totalTokens).toBe(1500);
      expect(updated!.durationMs).toBe(3200);
      expect(updated!.completedAt).toBeDefined();
    });

    it('should aggregate token usage across turns', async () => {
      const session = await createTestSession();

      // Create turns with different token counts
      const tokenCounts = [500, 800, 1200];
      for (let i = 0; i < tokenCounts.length; i++) {
        await turnRepository.save(
          turnRepository.create({
            sessionId: session.sessionId,
            turnNumber: i,
            userMessageId: `msg-user-${i}`,
            assistantMessageId: `msg-assistant-${i}`,
            totalTokens: tokenCounts[i],
            durationMs: 1000,
            completedAt: new Date(),
          }),
        );
      }

      // Query aggregate
      const result = await turnRepository
        .createQueryBuilder('turn')
        .select('SUM(turn.totalTokens)', 'totalTokens')
        .addSelect('COUNT(*)', 'turnCount')
        .where('turn.sessionId = :sessionId', {
          sessionId: session.sessionId,
        })
        .getRawOne();

      expect(parseInt(result.totalTokens)).toBe(2500);
      expect(parseInt(result.turnCount)).toBe(3);
    });
  });

  // =========================================================================
  // Solution Isolation
  // =========================================================================

  describe('Solution Isolation', () => {
    it('should isolate sessions by solutionId', async () => {
      const tenantA = 'tenant-isolation-a';
      const tenantB = 'tenant-isolation-b';

      await createTestSession({ solutionId: tenantA, title: 'Solution A session' });
      await createTestSession({ solutionId: tenantA, title: 'Solution A session 2' });
      await createTestSession({ solutionId: tenantB, title: 'Solution B session' });

      const tenantASessions = await sessionRepository.find({
        where: { solutionId: tenantA },
      });
      const tenantBSessions = await sessionRepository.find({
        where: { solutionId: tenantB },
      });

      expect(tenantASessions.length).toBe(2);
      expect(tenantBSessions.length).toBe(1);
      expect(tenantASessions.every((s) => s.solutionId === tenantA)).toBe(true);
      expect(tenantBSessions[0].title).toBe('Solution B session');
    });

    it('should not return sessions from other tenants in queries', async () => {
      const tenantA = 'tenant-query-a';
      const tenantB = 'tenant-query-b';

      await createTestSession({ solutionId: tenantA, title: 'Secret session' });
      await createTestSession({ solutionId: tenantB, title: 'Other session' });

      // Query with tenant filter (simulating ConversationsController)
      const results = await sessionRepository
        .createQueryBuilder('session')
        .where('session.solutionId = :solutionId', { solutionId: tenantA })
        .getMany();

      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Secret session');
    });
  });

  // =========================================================================
  // Soft Delete
  // =========================================================================

  describe('Soft Delete', () => {
    it('should soft delete by setting closedAt and status', async () => {
      const session = await createTestSession({
        title: 'Session to delete',
      });

      // Soft delete
      session.closedAt = new Date();
      session.status = 'closed';
      await sessionRepository.save(session);

      const deleted = await sessionRepository.findOne({
        where: { id: session.id },
      });

      expect(deleted).toBeDefined();
      expect(deleted!.closedAt).toBeDefined();
      expect(deleted!.status).toBe('closed');
      expect(deleted!.title).toBe('Session to delete'); // Data preserved
    });

    it('should exclude closed sessions from active queries', async () => {
      await createTestSession({ title: 'Active session', status: 'idle' });
      const closedSession = await createTestSession({
        title: 'Closed session',
        status: 'idle',
      });

      // Close it
      closedSession.closedAt = new Date();
      closedSession.status = 'closed';
      await sessionRepository.save(closedSession);

      // Query only active sessions
      const activeSessions = await sessionRepository
        .createQueryBuilder('session')
        .where('session.solutionId = :solutionId', { solutionId: testTenantId })
        .andWhere('session.status != :closed', { closed: 'closed' })
        .getMany();

      expect(activeSessions.length).toBe(1);
      expect(activeSessions[0].title).toBe('Active session');
    });
  });

  // =========================================================================
  // Conversation List & Search (DB-level)
  // =========================================================================

  describe('Conversation List & Search', () => {
    it('should paginate conversations', async () => {
      // Create 5 sessions
      for (let i = 0; i < 5; i++) {
        await createTestSession({
          title: `Session ${i}`,
          lastActivity: new Date(Date.now() - i * 1000), // Ordered by recency
        });
      }

      // Page 1: limit 2
      const page1 = await sessionRepository
        .createQueryBuilder('session')
        .where('session.solutionId = :solutionId', { solutionId: testTenantId })
        .orderBy('session.lastActivity', 'DESC')
        .skip(0)
        .take(2)
        .getMany();

      expect(page1.length).toBe(2);
      expect(page1[0].title).toBe('Session 0'); // Most recent

      // Page 2
      const page2 = await sessionRepository
        .createQueryBuilder('session')
        .where('session.solutionId = :solutionId', { solutionId: testTenantId })
        .orderBy('session.lastActivity', 'DESC')
        .skip(2)
        .take(2)
        .getMany();

      expect(page2.length).toBe(2);
    });

    it('should search conversations by title', async () => {
      await createTestSession({ title: 'TypeScript tutorial' });
      await createTestSession({ title: 'React hooks guide' });
      await createTestSession({ title: 'Advanced TypeScript patterns' });

      const results = await sessionRepository
        .createQueryBuilder('session')
        .where('session.solutionId = :solutionId', { solutionId: testTenantId })
        .andWhere('session.title LIKE :query', { query: '%TypeScript%' })
        .getMany();

      expect(results.length).toBe(2);
      expect(results.every((s) => s.title!.includes('TypeScript'))).toBe(true);
    });

    it('should filter pinned conversations', async () => {
      await createTestSession({ title: 'Pinned', isPinned: true });
      await createTestSession({ title: 'Not pinned', isPinned: false });
      await createTestSession({ title: 'Also pinned', isPinned: true });

      const pinned = await sessionRepository.find({
        where: { solutionId: testTenantId, isPinned: true },
      });

      expect(pinned.length).toBe(2);
      expect(pinned.every((s) => s.isPinned)).toBe(true);
    });
  });

  // =========================================================================
  // Full Conversation Lifecycle (end-to-end scenario)
  // =========================================================================

  describe('Full Conversation Lifecycle', () => {
    it('should support create → auto-title → turns → pin → soft-delete', async () => {
      // 1. Create session (simulating what SessionManagerService does)
      const session = await createTestSession();
      expect(session.title).toBeNull();
      expect(session.isPinned).toBe(false);

      // 2. Auto-generate title from first message
      await conversationMetadataService.autoGenerateTitle(
        session.sessionId,
        'Help me build a REST API with NestJS',
      );

      let updated = await sessionRepository.findOne({
        where: { sessionId: session.sessionId },
      });
      expect(updated!.title).toBe('Help me build a REST API with NestJS');

      // 3. Create turns
      for (let i = 0; i < 3; i++) {
        await turnRepository.save(
          turnRepository.create({
            sessionId: session.sessionId,
            turnNumber: i,
            userMessageId: `msg-user-${i}`,
            assistantMessageId: `msg-assistant-${i}`,
            totalTokens: 500 * (i + 1),
            durationMs: 1000 * (i + 1),
            completedAt: new Date(),
          }),
        );
      }

      const turns = await turnRepository.find({
        where: { sessionId: session.sessionId },
      });
      expect(turns.length).toBe(3);

      // 4. Pin the conversation
      updated = await sessionRepository.findOne({
        where: { sessionId: session.sessionId },
      });
      updated!.isPinned = true;
      await sessionRepository.save(updated!);

      // 5. Verify metadata retrieval
      const metadata = await conversationMetadataService.getConversationMetadata(
        session.sessionId,
      );
      expect(metadata.title).toBe('Help me build a REST API with NestJS');
      expect(metadata.isPinned).toBe(true);

      // 6. Soft delete
      updated = await sessionRepository.findOne({
        where: { sessionId: session.sessionId },
      });
      updated!.closedAt = new Date();
      updated!.status = 'closed';
      await sessionRepository.save(updated!);

      // 7. Verify data preserved after soft delete
      const deleted = await sessionRepository.findOne({
        where: { sessionId: session.sessionId },
      });
      expect(deleted!.status).toBe('closed');
      expect(deleted!.closedAt).toBeDefined();
      expect(deleted!.title).toBe('Help me build a REST API with NestJS');
      expect(deleted!.isPinned).toBe(true);

      // Turns still exist
      const deletedTurns = await turnRepository.find({
        where: { sessionId: session.sessionId },
      });
      expect(deletedTurns.length).toBe(3);
    });
  });
});
