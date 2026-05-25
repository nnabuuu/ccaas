/**
 * SessionService — Pressure-Based Cleanup Tests
 *
 * Covers:
 * - cleanupIdleSessions(): normal / high / critical pressure TTL selection
 * - getOrCreateSession(): proactive cleanup triggered at ≥ 80% utilization
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SessionService } from './session.service';
import { EventMapperService } from './event-mapper.service';
import { CliProcessService } from './services/cli-process.service';
import { WorkspaceService } from './services/workspace.service';
import { BackgroundTaskMonitorService } from './services/background-task-monitor.service';
import { StreamRegistryService } from './services/stream-registry.service';
import { SessionAssetMaterializer } from './services/session-asset-materializer.service';
import { mockWorkspaceProvider } from './workspace/__mocks__/mock-provider';
import { Session as SessionEntity } from '../admin/entities/session.entity';
import type { ManagedSession } from '../common/interfaces/session.interface';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal ManagedSession stub — no filesystem side-effects needed */
function makeSession(
  id: string,
  overrides: Partial<ManagedSession> = {},
): ManagedSession {
  return {
    sessionId: id,
    clientId: `client-${id}`,
    cliProcess: null,
    stdin: null,
    socket: null,
    lastActivity: new Date(),
    status: 'idle',
    createdAt: new Date(),
    messageCount: 0,
    buffer: '',
    workspaceDir: `/tmp/test/${id}`,
    ...overrides,
  } as ManagedSession;
}

/** Inject sessions directly into the private map (no filesystem I/O) */
function injectSessions(service: SessionService, sessions: ManagedSession[]) {
  const map: Map<string, ManagedSession> = (service as any).sessions;
  for (const s of sessions) {
    map.set(s.sessionId, s);
  }
}

// ── shared setup ─────────────────────────────────────────────────────────────

async function buildModule(): Promise<SessionService> {
  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        'workspace.dir': '.agent-workspace',
        'workspace.sessionTtlMs': 300_000,  // 5 min
        'workspace.maxSessions': 10,         // small pool for predictable percentages
        'workspace.cleanupIntervalMs': 300_000,
        'workspace.maxProcessingMs': 1_800_000,
        'workspace.cleanupPressureHighThreshold': 80,
        'workspace.cleanupPressureCriticalThreshold': 90,
      };
      return config[key] ?? defaultValue;
    }),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      SessionService,
      { provide: ConfigService, useValue: mockConfigService },
      {
        provide: EventMapperService,
        useValue: {
          clearSessionState: jest.fn(),
          registerBackgroundTaskCallback: jest.fn(),
        },
      },
      { provide: CliProcessService, useValue: {} },
      { provide: WorkspaceService, useValue: {} },
      {
        provide: BackgroundTaskMonitorService,
        useValue: { stopAllMonitors: jest.fn(), stopAllMonitorsForSession: jest.fn() },
      },
      {
        provide: StreamRegistryService,
        useValue: { cleanupSession: jest.fn() },
      },
      {
        provide: SessionAssetMaterializer,
        useValue: { materialize: jest.fn().mockResolvedValue(null) },
      },
      {
        provide: getRepositoryToken(SessionEntity),
        useValue: { save: jest.fn(), update: jest.fn() },
      },
      mockWorkspaceProvider(),
    ],
  }).compile();

  return module.get<SessionService>(SessionService);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('SessionService — Pressure-Based Cleanup', () => {
  let service: SessionService;

  beforeEach(async () => {
    service = await buildModule();
    // Patch maxSessions on the instance so it matches config mock
    (service as any).maxSessions = 10;
    (service as any).sessionTtlMs = 300_000;
    (service as any).cleanupPressureHighThreshold = 80;
    (service as any).cleanupPressureCriticalThreshold = 90;
    (service as any).maxProcessingMs = 1_800_000;
  });

  afterEach(async () => {
    await service.shutdown();
    jest.clearAllMocks();
  });

  // ── cleanupIdleSessions() ───────────────────────────────────────────────────

  describe('cleanupIdleSessions()', () => {
    it('normal pressure (<80%): keeps idle session that has not exceeded full TTL', () => {
      // 3/10 = 30% utilization — below high threshold
      const recent = makeSession('s-recent', {
        status: 'idle',
        lastActivity: new Date(Date.now() - 10_000), // idle 10 s < 5 min TTL
      });
      injectSessions(service, [
        recent,
        makeSession('pad1'),
        makeSession('pad2'),
      ]);

      (service as any).cleanupIdleSessions();

      expect(service.getSession('s-recent')).toBeDefined();
    });

    it('normal pressure (<80%): evicts idle session that exceeded full TTL', () => {
      const expired = makeSession('s-expired', {
        status: 'idle',
        lastActivity: new Date(Date.now() - 310_000), // idle 310 s > 300 s TTL
      });
      injectSessions(service, [expired, makeSession('pad1'), makeSession('pad2')]);

      (service as any).cleanupIdleSessions();

      expect(service.getSession('s-expired')).toBeUndefined();
    });

    it('high pressure (80–89%): evicts idle session idle > 60 s (shortened TTL)', () => {
      // 8/10 = 80% utilization — at high threshold
      const sessions = [
        makeSession('s-high-target', {
          status: 'idle',
          lastActivity: new Date(Date.now() - 65_000), // idle 65 s > capped 60 s
        }),
        ...Array.from({ length: 7 }, (_, i) => makeSession(`pad${i}`)),
      ];
      injectSessions(service, sessions);

      (service as any).cleanupIdleSessions();

      expect(service.getSession('s-high-target')).toBeUndefined();
    });

    it('high pressure (80–89%): keeps session idle < 60 s (would survive full TTL wait)', () => {
      const sessions = [
        makeSession('s-high-keep', {
          status: 'idle',
          lastActivity: new Date(Date.now() - 30_000), // idle 30 s < capped 60 s
        }),
        ...Array.from({ length: 7 }, (_, i) => makeSession(`pad${i}`)),
      ];
      injectSessions(service, sessions);

      (service as any).cleanupIdleSessions();

      expect(service.getSession('s-high-keep')).toBeDefined();
    });

    it('critical pressure (>=90%): evicts idle session with TTL=0 (any idle age)', () => {
      // 9/10 = 90% utilization — at critical threshold
      const sessions = [
        makeSession('s-critical-target', {
          status: 'idle',
          lastActivity: new Date(Date.now() - 1_000), // only 1 s idle — still evicted
        }),
        ...Array.from({ length: 8 }, (_, i) => makeSession(`pad${i}`)),
      ];
      injectSessions(service, sessions);

      (service as any).cleanupIdleSessions();

      expect(service.getSession('s-critical-target')).toBeUndefined();
    });

    it('critical pressure: does NOT evict session in processing status', () => {
      const sessions = [
        makeSession('s-processing', {
          status: 'processing',
          lastActivity: new Date(Date.now() - 1_000),
          processingStartedAt: new Date(Date.now() - 1_000),
        }),
        ...Array.from({ length: 8 }, (_, i) => makeSession(`pad${i}`)),
      ];
      injectSessions(service, sessions);

      (service as any).cleanupIdleSessions();

      // Still present — only force-closed if stuck past maxProcessingMs
      expect(service.getSession('s-processing')).toBeDefined();
    });

    it('force-closes stuck-processing session regardless of pressure level', () => {
      const stuck = makeSession('s-stuck', {
        status: 'processing',
        lastActivity: new Date(Date.now() - 2_000_000),
        processingStartedAt: new Date(Date.now() - 2_000_000), // 33 min > 30 min cap
      });
      injectSessions(service, [stuck]);

      (service as any).cleanupIdleSessions();

      expect(service.getSession('s-stuck')).toBeUndefined();
    });

    it('respects per-session sessionTtlMs at high pressure (caps to min)', () => {
      // Per-session TTL of 10 min; at high pressure, effective = min(600_000, 60_000) = 60_000
      const sessions = [
        makeSession('s-per-tenant', {
          status: 'idle',
          sessionTtlMs: 600_000,               // 10 min per-session override
          lastActivity: new Date(Date.now() - 90_000), // 90 s idle > capped 60 s
        }),
        ...Array.from({ length: 7 }, (_, i) => makeSession(`pad${i}`)),
      ];
      injectSessions(service, sessions);

      (service as any).cleanupIdleSessions();

      expect(service.getSession('s-per-tenant')).toBeUndefined();
    });
  });

  // ── getOrCreateSession() — proactive cleanup trigger ───────────────────────

  describe('getOrCreateSession() — proactive cleanup', () => {
    beforeEach(() => {
      // Mock filesystem ops so getOrCreateSession() won't fail in test env
      jest.spyOn(require('node:fs'), 'mkdirSync').mockReturnValue(undefined);
      jest.spyOn(require('node:fs'), 'writeFileSync').mockReturnValue(undefined);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('triggers cleanupIdleSessions when utilization reaches >= 80%', async () => {
      // Pre-fill 8/10 sessions (80% utilization)
      injectSessions(
        service,
        Array.from({ length: 8 }, (_, i) => makeSession(`pre${i}`)),
      );
      const cleanupSpy = jest.spyOn(service as any, 'cleanupIdleSessions');

      await service.getOrCreateSession('new-session', 'client-new', null);

      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });

    it('does NOT trigger proactive cleanup below 80% utilization', async () => {
      // Pre-fill 5/10 sessions (50% utilization)
      injectSessions(
        service,
        Array.from({ length: 5 }, (_, i) => makeSession(`pre${i}`)),
      );
      const cleanupSpy = jest.spyOn(service as any, 'cleanupIdleSessions');

      await service.getOrCreateSession('new-session', 'client-new', null);

      expect(cleanupSpy).not.toHaveBeenCalled();
    });

    it('proactive cleanup at 90% (critical) still runs before hard-limit check', async () => {
      // Pre-fill 9/10 (90%)
      injectSessions(
        service,
        Array.from({ length: 9 }, (_, i) => makeSession(`pre${i}`)),
      );
      const cleanupSpy = jest.spyOn(service as any, 'cleanupIdleSessions');

      await service.getOrCreateSession('new-session', 'client-new', null);

      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });
  });
});
