import { CoachingService } from './coaching.service';
import { AiPromptBuilder } from './ai-prompt-builder';
import type { DiscussionHighlight, CoachingStateInput, CoachingInsight } from '../schemas/classroom/coaching';

function makeMockAiPromptBuilder(response = '{"insights":[]}') {
  return { callLlm: jest.fn().mockResolvedValue(response) } as unknown as AiPromptBuilder;
}

describe('CoachingService', () => {
  let service: CoachingService;
  let ai: AiPromptBuilder;

  beforeEach(() => {
    ai = makeMockAiPromptBuilder();
    service = new CoachingService(ai);
  });

  // ── Highlight management ──

  describe('addHighlight / getHighlights', () => {
    it('stores and retrieves highlights', () => {
      service.addHighlight('s1', {
        studentId: 'stu1', studentName: 'Alice', taskNum: 1, clusterId: 'c1',
        message: 'I think...', gist: 'Interesting point', evidenceSpan: 'evidence',
      });
      const highlights: DiscussionHighlight[] = service.getHighlights('s1');
      expect(highlights).toHaveLength(1);
      expect(highlights[0]).toMatchObject({
        studentId: 'stu1', studentName: 'Alice', gist: 'Interesting point', clusterId: 'c1',
      });
      expect(highlights[0].detectedAt).toBeGreaterThan(0);
    });

    it('returns empty array for unknown session', () => {
      expect(service.getHighlights('unknown')).toEqual([]);
    });

    it('caps highlights at 100 per session', () => {
      for (let i = 0; i < 110; i++) {
        service.addHighlight('s1', {
          studentId: `stu${i}`, studentName: `S${i}`, taskNum: 1, clusterId: 'c1',
          message: 'm', gist: `g${i}`, evidenceSpan: 'e',
        });
      }
      expect(service.getHighlights('s1')).toHaveLength(100);
      expect(service.getHighlights('s1')[0].gist).toBe('g10'); // oldest 10 dropped
    });
  });

  // ── Cache management ──

  describe('getCached', () => {
    it('returns null when no cache exists', () => {
      expect(service.getCached('s1')).toBeNull();
    });
  });

  // ── maybeRefresh + generateInsight ──

  describe('maybeRefresh', () => {
    const stateInput: CoachingStateInput = {
      stepMetrics: {
        1: {
          alertTag: 'Q1 错误偏高',
          issues: ['7 人Q1 选了 C'],
          byDimension: { Q1: { good: 3, partial: 2, wrong: 5 } },
        },
      },
      healthCards: { stuck: { count: 3 }, median: { step: 2 } },
    };

    it('calls LLM and caches insight on first refresh', async () => {
      const llmResponse = JSON.stringify({
        insights: [{ title: '关注Q1', detail: '多人出错', suggestedAction: '讲解Q1' }],
      });
      ai = makeMockAiPromptBuilder(llmResponse);
      service = new CoachingService(ai);

      await service.maybeRefresh('s1', stateInput);
      const cached: CoachingInsight | null = service.getCached('s1');
      expect(cached).not.toBeNull();
      expect(cached!.insights).toHaveLength(1);
      expect(cached!.insights[0].title).toBe('关注Q1');
      expect(cached!.generatedAt).toBeGreaterThan(0);
    });

    it('throttles within THROTTLE_MS window', async () => {
      const llmResponse = JSON.stringify({ insights: [{ title: 'T', detail: 'D', suggestedAction: 'A' }] });
      ai = makeMockAiPromptBuilder(llmResponse);
      service = new CoachingService(ai);

      await service.maybeRefresh('s1', stateInput);
      await service.maybeRefresh('s1', stateInput);
      expect(ai.callLlm).toHaveBeenCalledTimes(1);
    });

    it('returns null insight when contextParts is empty', async () => {
      await service.maybeRefresh('s1', {});
      expect(service.getCached('s1')).toBeNull();
      expect(ai.callLlm).not.toHaveBeenCalled();
    });

    it('caps insights array at 3 items', async () => {
      const llmResponse = JSON.stringify({
        insights: [
          { title: 'T1', detail: 'D1', suggestedAction: 'A1' },
          { title: 'T2', detail: 'D2', suggestedAction: 'A2' },
          { title: 'T3', detail: 'D3', suggestedAction: 'A3' },
          { title: 'T4', detail: 'D4', suggestedAction: 'A4' },
        ],
      });
      ai = makeMockAiPromptBuilder(llmResponse);
      service = new CoachingService(ai);

      await service.maybeRefresh('s1', stateInput);
      expect(service.getCached('s1')!.insights).toHaveLength(3);
    });

    it('handles LLM returning invalid JSON gracefully', async () => {
      ai = makeMockAiPromptBuilder('not json');
      service = new CoachingService(ai);

      await service.maybeRefresh('s1', stateInput);
      expect(service.getCached('s1')).toBeNull();
    });

    it('handles LLM returning non-array insights', async () => {
      ai = makeMockAiPromptBuilder('{"insights": "not an array"}');
      service = new CoachingService(ai);

      await service.maybeRefresh('s1', stateInput);
      expect(service.getCached('s1')).toBeNull();
    });
  });

  // ── cleanupSession ──

  describe('cleanupSession', () => {
    it('removes highlights and cache for session', async () => {
      service.addHighlight('s1', {
        studentId: 'stu1', studentName: 'A', taskNum: 1, clusterId: 'c1',
        message: 'm', gist: 'g', evidenceSpan: 'e',
      });
      const llmResponse = JSON.stringify({ insights: [{ title: 'T', detail: 'D', suggestedAction: 'A' }] });
      ai = makeMockAiPromptBuilder(llmResponse);
      service = new CoachingService(ai);
      service.addHighlight('s1', {
        studentId: 'stu1', studentName: 'A', taskNum: 1, clusterId: 'c1',
        message: 'm', gist: 'g', evidenceSpan: 'e',
      });
      await service.maybeRefresh('s1', {
        healthCards: { stuck: { count: 5 } },
      });

      service.cleanupSession('s1');
      expect(service.getHighlights('s1')).toEqual([]);
      expect(service.getCached('s1')).toBeNull();
    });
  });
});
