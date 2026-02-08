/**
 * SessionService - Skill Tracking Tests
 *
 * TDD: Writing tests FIRST for session-skill tracking
 *
 * Week 3 Goals:
 * - Track which skills are synced to each session
 * - Track userId for each session
 * - Only restart sessions that use modified skills (precise restart)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SessionService } from './session.service';
import { EventMapperService } from './event-mapper.service';
import type { ManagedSession } from '../common/interfaces/session.interface';

describe('SessionService - Skill Tracking (Week 3)', () => {
  let service: SessionService;
  let configService: jest.Mocked<ConfigService>;
  let eventMapperService: jest.Mocked<EventMapperService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          'workspace.dir': '.agent-workspace',
          'workspace.sessionTtlMs': 1800000,
          'workspace.maxSessions': 100,
          'workspace.cleanupIntervalMs': 300000,
          'CLAUDE_CLI_PATH': 'claude',
        };
        return config[key] ?? defaultValue;
      }),
    };

    const mockEventMapperService = {
      clearSessionState: jest.fn(),
      markBackgroundTaskComplete: jest.fn(),
      registerBackgroundTaskCallback: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EventMapperService,
          useValue: mockEventMapperService,
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    configService = module.get(ConfigService);
    eventMapperService = module.get(EventMapperService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Session Creation with userId', () => {
    it('should set userId when creating a session', () => {
      const sessionId = 'test-session-1';
      const clientId = 'client-1';
      const userId = 'user-123';
      const mockSocket: any = { id: 'socket-1', emit: jest.fn() };

      const session = service.getOrCreateSession(sessionId, clientId, mockSocket, userId);

      expect(session.userId).toBe(userId);
      expect(session.sessionId).toBe(sessionId);
    });

    it('should allow creating session without userId (anonymous)', () => {
      const sessionId = 'test-session-2';
      const clientId = 'client-2';
      const mockSocket: any = { id: 'socket-2', emit: jest.fn() };

      const session = service.getOrCreateSession(sessionId, clientId, mockSocket);

      expect(session.userId).toBeUndefined();
      expect(session.sessionId).toBe(sessionId);
    });

    it('should preserve userId on subsequent calls for same session', () => {
      const sessionId = 'test-session-3';
      const clientId = 'client-3';
      const userId = 'user-456';
      const mockSocket: any = { id: 'socket-3', emit: jest.fn() };

      const session1 = service.getOrCreateSession(sessionId, clientId, mockSocket, userId);
      const session2 = service.getOrCreateSession(sessionId, clientId, mockSocket);

      expect(session1.userId).toBe(userId);
      expect(session2.userId).toBe(userId); // Should preserve original userId
    });
  });

  describe('Skill Tracking', () => {
    it('should initialize syncedSkillIds as empty set', () => {
      const sessionId = 'test-session-4';
      const clientId = 'client-4';
      const mockSocket: any = { id: 'socket-4', emit: jest.fn() };

      const session = service.getOrCreateSession(sessionId, clientId, mockSocket);

      expect(session.syncedSkillIds).toBeDefined();
      expect(session.syncedSkillIds).toBeInstanceOf(Set);
      expect(session.syncedSkillIds?.size).toBe(0);
    });

    it('should track synced skills when skills are added', () => {
      const sessionId = 'test-session-5';
      const clientId = 'client-5';
      const mockSocket: any = { id: 'socket-5', emit: jest.fn() };

      const session = service.getOrCreateSession(sessionId, clientId, mockSocket);

      // Simulate syncing skills
      const skillIds = ['skill-1', 'skill-2', 'skill-3'];
      service.trackSyncedSkills(sessionId, skillIds);

      expect(session.syncedSkillIds?.size).toBe(3);
      expect(session.syncedSkillIds?.has('skill-1')).toBe(true);
      expect(session.syncedSkillIds?.has('skill-2')).toBe(true);
      expect(session.syncedSkillIds?.has('skill-3')).toBe(true);
    });

    it('should update synced skills when re-syncing', () => {
      const sessionId = 'test-session-6';
      const clientId = 'client-6';
      const mockSocket: any = { id: 'socket-6', emit: jest.fn() };

      const session = service.getOrCreateSession(sessionId, clientId, mockSocket);

      // First sync
      service.trackSyncedSkills(sessionId, ['skill-1', 'skill-2']);
      expect(session.syncedSkillIds?.size).toBe(2);

      // Second sync with different skills
      service.trackSyncedSkills(sessionId, ['skill-2', 'skill-3']);
      expect(session.syncedSkillIds?.size).toBe(2);
      expect(session.syncedSkillIds?.has('skill-1')).toBe(false);
      expect(session.syncedSkillIds?.has('skill-2')).toBe(true);
      expect(session.syncedSkillIds?.has('skill-3')).toBe(true);
    });

    it('should handle empty skill list', () => {
      const sessionId = 'test-session-7';
      const clientId = 'client-7';
      const mockSocket: any = { id: 'socket-7', emit: jest.fn() };

      const session = service.getOrCreateSession(sessionId, clientId, mockSocket);

      service.trackSyncedSkills(sessionId, []);

      expect(session.syncedSkillIds?.size).toBe(0);
    });
  });

  describe('getAffectedSessions', () => {
    beforeEach(() => {
      // Create multiple sessions with different skills
      const mockSocket: any = { id: 'socket-test', emit: jest.fn() };
      const tenantId = 'tenant-123';

      // Session 1: Uses skill-1 and skill-2
      const session1 = service.getOrCreateSession('session-1', 'client-1', mockSocket, 'user-1');
      session1.tenantId = tenantId;
      service.trackSyncedSkills('session-1', ['skill-1', 'skill-2']);

      // Session 2: Uses skill-2 and skill-3
      const session2 = service.getOrCreateSession('session-2', 'client-2', mockSocket, 'user-2');
      session2.tenantId = tenantId;
      service.trackSyncedSkills('session-2', ['skill-2', 'skill-3']);

      // Session 3: Uses skill-3 only
      const session3 = service.getOrCreateSession('session-3', 'client-3', mockSocket, 'user-3');
      session3.tenantId = tenantId;
      service.trackSyncedSkills('session-3', ['skill-3']);

      // Session 4: Different tenant
      const session4 = service.getOrCreateSession('session-4', 'client-4', mockSocket, 'user-4');
      session4.tenantId = 'tenant-456';
      service.trackSyncedSkills('session-4', ['skill-1']);
    });

    it('should return only sessions that use the modified skill', () => {
      const affected = service.getAffectedSessions('tenant-123', 'skill-1');

      expect(affected).toHaveLength(1);
      expect(affected[0].sessionId).toBe('session-1');
    });

    it('should return multiple sessions if they all use the skill', () => {
      const affected = service.getAffectedSessions('tenant-123', 'skill-2');

      expect(affected).toHaveLength(2);
      const sessionIds = affected.map((s) => s.sessionId).sort();
      expect(sessionIds).toEqual(['session-1', 'session-2']);
    });

    it('should return empty array if no sessions use the skill', () => {
      const affected = service.getAffectedSessions('tenant-123', 'skill-999');

      expect(affected).toHaveLength(0);
    });

    it('should only return sessions for the specified tenant', () => {
      const affected = service.getAffectedSessions('tenant-123', 'skill-1');

      expect(affected).toHaveLength(1);
      expect(affected[0].sessionId).toBe('session-1');
      // session-4 has skill-1 but different tenant
    });

    it('should handle sessions with no synced skills', () => {
      const mockSocket: any = { id: 'socket-empty', emit: jest.fn() };
      const session = service.getOrCreateSession('session-empty', 'client-empty', mockSocket);
      session.tenantId = 'tenant-123';
      // Don't track any skills

      const affected = service.getAffectedSessions('tenant-123', 'skill-1');

      expect(affected).toHaveLength(1); // Only session-1, not session-empty
    });
  });

  describe('markSessionsForRestart - Precise Restart', () => {
    beforeEach(() => {
      // Create sessions with different skills
      const mockSocket: any = { id: 'socket-test', emit: jest.fn() };
      const tenantId = 'tenant-123';

      const session1 = service.getOrCreateSession('session-1', 'client-1', mockSocket);
      session1.tenantId = tenantId;
      service.trackSyncedSkills('session-1', ['skill-1', 'skill-2']);

      const session2 = service.getOrCreateSession('session-2', 'client-2', mockSocket);
      session2.tenantId = tenantId;
      service.trackSyncedSkills('session-2', ['skill-2', 'skill-3']);

      const session3 = service.getOrCreateSession('session-3', 'client-3', mockSocket);
      session3.tenantId = tenantId;
      service.trackSyncedSkills('session-3', ['skill-3']);
    });

    it('should only mark sessions that use the modified skill', () => {
      const marked = service.markSessionsForRestart('tenant-123', 'skill-1');

      expect(marked).toHaveLength(1);
      expect(marked).toContain('session-1');
      expect(marked).not.toContain('session-2');
      expect(marked).not.toContain('session-3');
    });

    it('should mark multiple sessions if they all use the skill', () => {
      const marked = service.markSessionsForRestart('tenant-123', 'skill-2');

      expect(marked).toHaveLength(2);
      expect(marked.sort()).toEqual(['session-1', 'session-2']);
    });

    it('should set needsRestart flag on affected sessions only', () => {
      service.markSessionsForRestart('tenant-123', 'skill-1');

      const session1 = service.getSession('session-1');
      const session2 = service.getSession('session-2');
      const session3 = service.getSession('session-3');

      expect(session1?.needsRestart).toBe(true);
      expect(session2?.needsRestart).toBeUndefined(); // or false
      expect(session3?.needsRestart).toBeUndefined(); // or false
    });

    it('should return empty array if no sessions use the skill', () => {
      const marked = service.markSessionsForRestart('tenant-123', 'skill-999');

      expect(marked).toHaveLength(0);
    });

    it('should not affect sessions in other tenants', () => {
      const mockSocket: any = { id: 'socket-other', emit: jest.fn() };
      const session4 = service.getOrCreateSession('session-4', 'client-4', mockSocket);
      session4.tenantId = 'tenant-456';
      service.trackSyncedSkills('session-4', ['skill-1']);

      const marked = service.markSessionsForRestart('tenant-123', 'skill-1');

      expect(marked).toHaveLength(1);
      expect(marked).toContain('session-1');
      expect(marked).not.toContain('session-4');

      const session4After = service.getSession('session-4');
      expect(session4After?.needsRestart).toBeUndefined();
    });
  });

  describe('Backward Compatibility', () => {
    it('should support old markSessionsForRestart without skillId (mark all tenant sessions)', () => {
      const mockSocket: any = { id: 'socket-test', emit: jest.fn() };
      const tenantId = 'tenant-123';

      service.getOrCreateSession('session-1', 'client-1', mockSocket).tenantId = tenantId;
      service.getOrCreateSession('session-2', 'client-2', mockSocket).tenantId = tenantId;
      service.getOrCreateSession('session-3', 'client-3', mockSocket).tenantId = tenantId;

      // Call without skillId should mark all tenant sessions
      const marked = service.markSessionsForRestart(tenantId);

      expect(marked).toHaveLength(3);
      expect(marked.sort()).toEqual(['session-1', 'session-2', 'session-3']);
    });
  });

  describe('Session Cleanup', () => {
    it('should clear syncedSkillIds when session is terminated', async () => {
      const mockSocket: any = { id: 'socket-cleanup', emit: jest.fn() };
      const session = service.getOrCreateSession('session-cleanup', 'client-cleanup', mockSocket);

      service.trackSyncedSkills('session-cleanup', ['skill-1', 'skill-2']);
      expect(session.syncedSkillIds?.size).toBe(2);

      await service.terminateSession('session-cleanup');

      const sessionAfter = service.getSession('session-cleanup');
      expect(sessionAfter).toBeUndefined();
    });
  });
});
