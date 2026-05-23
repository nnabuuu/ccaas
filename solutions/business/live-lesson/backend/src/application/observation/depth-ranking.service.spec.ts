import { LLM_PORT } from '../../domain/ports/llm.port';
import { DISCUSS_HIGHLIGHT_REPO_PORT } from '../../domain/ports/discuss-highlight-repo.port';
/**
 * DepthRankingService unit tests.
 *
 * Was 35.71% covered. Exercises the throttle/warmup gates, computeScores
 * merge logic, summary-cache reuse, cleanup, and the malformed-LLM fallback.
 */
import { DISCUSS_TARGET_HIT_REPO_PORT } from "../../domain/ports/discuss-target-hit-repo.port";
import { TypeOrmDiscussTargetHitRepository } from "../../adapters/persistence/repositories/discuss-target-hit.repository";
import { CLASSROOM_SESSION_REPO_PORT } from "../../domain/ports/classroom-session-repo.port";
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DepthRankingService } from '../observation/depth-ranking.service';
import { AiPromptBuilder } from '../ai/ai-prompt-builder';
import { DiscussHighlight } from '../../adapters/persistence/entities/discuss-highlight.entity';
import { DiscussTargetHit } from '../../adapters/persistence/entities/discuss-target-hit.entity';
import { ChatMessage } from '../../adapters/persistence/entities/chat-message.entity';
import { ClassroomSession } from '../../adapters/persistence/entities/classroom-session.entity';

/** Minimal query-builder stub returning the rows we hand it. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function qbWithRows(rows: any[]) {
  const qb = {
    select: () => qb,
    addSelect: () => qb,
    where: () => qb,
    andWhere: () => qb,
    groupBy: () => qb,
    addGroupBy: () => qb,
    getRawMany: () => Promise.resolve(rows),
  };
  return qb;
}

function makeRepoMock<T>() {
  return {
    createQueryBuilder: jest.fn(() => qbWithRows([])),
    findOne: jest.fn(async () => null as T | null),
    find: jest.fn(async () => [] as T[]),
  };
}

async function buildService(over: {
  highlights?: Array<{ studentId: string; studentName: string; cnt: string }>
  tpHits?: Array<{ studentId: string; studentName: string; cnt: string }>
  msgs?: Array<{ studentId: string; cnt: string }>
  session?: { startedAt?: Date | string | number | null } | null
  highlightDetail?: Array<{ gist: string }>
  tpHitDetail?: Array<{ targetPointId: string }>
  llmResponse?: string
} = {}) {
  const chatMessageRepo = makeRepoMock<ChatMessage>();

  // Port-shaped session repo
  const sessionRepo = {
    findStartedAtById: jest.fn(async () => (over.session ?? null) as { startedAt: Date | null } | null),
  };

  // Port-shaped mocks (replace Repository<X> after Phase 2b)
  const targetHitRepo = {
    findBySession: jest.fn(async () => []),
    findTargetPointIdsBySessionAndStudent: jest.fn(async () => over.tpHitDetail ?? []),
    upsertHit: jest.fn(async () => undefined),
    countBySessionGroupByStudent: jest.fn(async () => over.tpHits ?? []),
  };
  const highlightRepo = {
    findBySession: jest.fn(async () => []),
    findTopGistsBySessionAndStudent: jest.fn(async () => over.highlightDetail ?? []),
    upsertHighlight: jest.fn(async () => undefined),
    countBySessionGroupByStudent: jest.fn(async () => over.highlights ?? []),
  };

  chatMessageRepo.createQueryBuilder.mockReturnValue(qbWithRows(over.msgs ?? []) as never);

  const ai = {
    callLlm: jest.fn(async () => over.llmResponse ?? '{}'),
    callVisionLlm: jest.fn(),
  } as unknown as AiPromptBuilder;

  const module = await Test.createTestingModule({
    providers: [
      DepthRankingService,
      { provide: AiPromptBuilder, useValue: ai },
      { provide: LLM_PORT, useValue: ai },
      { provide: DISCUSS_HIGHLIGHT_REPO_PORT, useValue: highlightRepo },
      { provide: DISCUSS_TARGET_HIT_REPO_PORT, useValue: targetHitRepo },
      { provide: getRepositoryToken(ChatMessage), useValue: chatMessageRepo },
      { provide: CLASSROOM_SESSION_REPO_PORT, useValue: sessionRepo },
    ],
  }).compile();

  return { service: module.get(DepthRankingService), ai, sessionRepo };
}

describe('DepthRankingService', () => {
  describe('warmup', () => {
    it('skips refresh during the 5-minute warmup window', async () => {
      const startedAt = Date.now() - 60_000; // 1 minute ago
      const { service, ai } = await buildService({
        session: { startedAt: new Date(startedAt) },
      });
      await service.maybeRefresh('s1');
      expect(ai.callLlm).not.toHaveBeenCalled();
      expect(service.getCached('s1')).toBeNull();
    });

    it('proceeds past warmup when session has been running >5min', async () => {
      const startedAt = Date.now() - 6 * 60_000;
      const { service } = await buildService({
        session: { startedAt: new Date(startedAt) },
        highlights: [{ studentId: 'st1', studentName: 'Alice', cnt: '3' }],
        tpHits: [{ studentId: 'st1', studentName: 'Alice', cnt: '2' }],
        msgs: [{ studentId: 'st1', cnt: '5' }],
        llmResponse: JSON.stringify({ summaries: { st1: 'Great thinking' } }),
      });
      await service.maybeRefresh('s1');
      const board = service.getCached('s1');
      expect(board).not.toBeNull();
      expect(board!.rankings).toHaveLength(1);
      expect(board!.rankings[0].studentId).toBe('st1');
      expect(board!.rankings[0].score).toBe(3 * 3 + 2 * 2); // 13
      expect(board!.rankings[0].aiSummary).toBe('Great thinking');
    });
  });

  describe('throttle', () => {
    it('skips when called within THROTTLE_MS of the last refresh', async () => {
      const startedAt = Date.now() - 6 * 60_000;
      const { service, ai } = await buildService({
        session: { startedAt: new Date(startedAt) },
        highlights: [{ studentId: 'st1', studentName: 'A', cnt: '1' }],
        msgs: [{ studentId: 'st1', cnt: '1' }],
        llmResponse: JSON.stringify({ summaries: { st1: 'ok' } }),
      });
      await service.maybeRefresh('s1');
      const callsAfterFirst = (ai.callLlm as jest.Mock).mock.calls.length;
      // Immediately attempt another refresh — should be throttled
      await service.maybeRefresh('s1');
      expect((ai.callLlm as jest.Mock).mock.calls.length).toBe(callsAfterFirst);
    });
  });

  describe('computeScores merging', () => {
    it('returns top-5 sorted by score, ignoring students with score==0', async () => {
      const startedAt = Date.now() - 6 * 60_000;
      // 6 students; the 6th (no highlights, no tpHits) must be filtered out.
      const { service } = await buildService({
        session: { startedAt: new Date(startedAt) },
        highlights: [
          { studentId: 'a', studentName: 'A', cnt: '5' },
          { studentId: 'b', studentName: 'B', cnt: '2' },
          { studentId: 'c', studentName: 'C', cnt: '1' },
          { studentId: 'd', studentName: 'D', cnt: '4' },
          { studentId: 'e', studentName: 'E', cnt: '0' },
        ],
        tpHits: [
          { studentId: 'a', studentName: 'A', cnt: '3' },
          { studentId: 'd', studentName: 'D', cnt: '1' },
          { studentId: 'f', studentName: 'F', cnt: '5' },
        ],
        msgs: [
          { studentId: 'a', cnt: '10' },
          { studentId: 'f', cnt: '3' },
        ],
        llmResponse: JSON.stringify({
          summaries: { a: 'A++', b: 'B+', c: 'C', d: 'D++', f: 'F!!' },
        }),
      });
      await service.maybeRefresh('s2');
      const board = service.getCached('s2');
      expect(board).not.toBeNull();
      const rankings = board!.rankings;
      // Scores: a = 5*3 + 3*2 = 21; d = 4*3 + 1*2 = 14; f = 0*3 + 5*2 = 10;
      // b = 2*3 = 6; c = 1*3 = 3; e = 0 → filtered.
      expect(rankings.map((r) => r.studentId)).toEqual(['a', 'd', 'f', 'b', 'c']);
      expect(rankings[0].score).toBe(21);
    });

    it('no-ops the leaderboard when nobody scored', async () => {
      const startedAt = Date.now() - 6 * 60_000;
      const { service } = await buildService({
        session: { startedAt: new Date(startedAt) },
        // Nobody has highlights or tpHits → all scores 0 → filtered out.
        msgs: [{ studentId: 'a', cnt: '5' }],
      });
      await service.maybeRefresh('s3');
      expect(service.getCached('s3')).toBeNull();
    });
  });

  describe('summary cache', () => {
    it('reuses cached summary on a 2nd refresh when messageCount unchanged', async () => {
      jest.useFakeTimers();
      try {
        const startedAt = Date.now() - 6 * 60_000;
        const { service, ai } = await buildService({
          session: { startedAt: new Date(startedAt) },
          highlights: [{ studentId: 'a', studentName: 'A', cnt: '1' }],
          msgs: [{ studentId: 'a', cnt: '3' }],
          llmResponse: JSON.stringify({ summaries: { a: 'Bright' } }),
        });
        await service.maybeRefresh('s4');
        expect((ai.callLlm as jest.Mock).mock.calls.length).toBe(1);

        // Advance past the throttle window
        jest.advanceTimersByTime(31_000);
        await service.maybeRefresh('s4');
        // Same messageCount → no new LLM call (summary cache hit)
        expect((ai.callLlm as jest.Mock).mock.calls.length).toBe(1);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('error handling', () => {
    it('falls back to no summaries when LLM returns malformed JSON', async () => {
      const startedAt = Date.now() - 6 * 60_000;
      const { service } = await buildService({
        session: { startedAt: new Date(startedAt) },
        highlights: [{ studentId: 'a', studentName: 'A', cnt: '1' }],
        llmResponse: 'not json {{',
      });
      await service.maybeRefresh('s5');
      const board = service.getCached('s5');
      expect(board).not.toBeNull();
      expect(board!.rankings[0].aiSummary).toBeNull();
    });
  });

  describe('cleanupSession', () => {
    it('clears all per-session caches', async () => {
      const startedAt = Date.now() - 6 * 60_000;
      const { service } = await buildService({
        session: { startedAt: new Date(startedAt) },
        highlights: [{ studentId: 'a', studentName: 'A', cnt: '1' }],
        llmResponse: JSON.stringify({ summaries: { a: 'ok' } }),
      });
      await service.maybeRefresh('s6');
      expect(service.getCached('s6')).not.toBeNull();
      service.cleanupSession('s6');
      expect(service.getCached('s6')).toBeNull();
    });
  });
});
