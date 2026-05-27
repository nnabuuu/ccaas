import { NotFoundException } from '@nestjs/common';

import {
  LintService,
  extractRefIds,
  hashContent,
  parseLintResponse,
} from './lint.service';
import { LintPromptBuilder } from './lint-prompt-builder';
import { LintIssue } from './lint.schema';

/**
 * Unit tests for LintService. We hand-build the service with mocked
 * deps rather than spinning up the Nest TestingModule — the forwardRef
 * cycle is real wiring noise that doesn't add coverage. Each test
 * exercises one decision (cache hit / debounce / parse failure / etc.).
 */

function makeService(overrides?: Partial<{ readFile: jest.Mock; tryFindItemById: jest.Mock; callLlm: jest.Mock }>) {
  const projects = {
    readFile: jest.fn(async (_p: string, path: string) => {
      if (path === 'plan/lesson-plan.md') {
        return { content: '# plan with [link](req://r-1.2.3 "x")', fileType: 'md' };
      }
      if (path === 'execution/manifest.json') {
        return { content: '{"readingSteps":[]}', fileType: 'json' };
      }
      throw new NotFoundException(path);
    }),
    ...(overrides?.readFile ? { readFile: overrides.readFile } : {}),
  } as any;

  const teachingRequirements = {
    tryFindItemById: jest.fn((id: string) =>
      id === 'r-1.2.3'
        ? {
            id: 'r-1.2.3',
            code: '课标 2.1.3',
            text: '推断生词',
            subject: 'english',
            categoryId: 'lang',
            categoryLabel: '语言能力',
            categoryColor: 'teal',
          }
        : undefined,
    ),
    ...(overrides?.tryFindItemById ? { tryFindItemById: overrides.tryFindItemById } : {}),
  } as any;

  const ai = {
    callLlm: jest.fn().mockResolvedValue('{"issues":[]}'),
    ...(overrides?.callLlm ? { callLlm: overrides.callLlm } : {}),
  } as any;

  const promptBuilder = new LintPromptBuilder();

  const svc = new LintService(projects, teachingRequirements, ai, promptBuilder);
  return { svc, projects, teachingRequirements, ai };
}

describe('LintService', () => {
  describe('getOrInit', () => {
    it('returns idle when nothing has been cached', async () => {
      const { svc } = makeService();
      const result = await svc.getOrInit('p1');
      expect(result.status).toBe('idle');
      expect(result.issues).toEqual([]);
    });

    it('returns fresh when cache matches current content hash', async () => {
      const { svc, ai } = makeService();
      await svc.run('p1');
      // Same files → second getOrInit should be 'fresh', not 'stale'.
      const result = await svc.getOrInit('p1');
      expect(result.status).toBe('fresh');
      // Only one LLM call (cache hit on the read-side hash check).
      expect(ai.callLlm).toHaveBeenCalledTimes(1);
    });

    it('flips to stale when underlying files changed', async () => {
      const { svc, projects } = makeService();
      await svc.run('p1');
      // Mutate the mock so the next read returns different content.
      projects.readFile.mockImplementationOnce(async () => ({
        content: '# different plan',
        fileType: 'md',
      }));
      // Second call to readFile (manifest) returns the original.
      const result = await svc.getOrInit('p1');
      expect(result.status).toBe('stale');
    });
  });

  describe('run', () => {
    it('writes a fresh result on a successful LLM call', async () => {
      const issuesPayload = {
        issues: [
          {
            severity: 'warning',
            category: 'goal-alignment',
            message: '目标 X 没有对应的 step',
          },
        ],
      };
      const { svc, ai } = makeService({
        callLlm: jest.fn().mockResolvedValue(JSON.stringify(issuesPayload)),
      });
      const result = await svc.run('p1');
      expect(result.status).toBe('fresh');
      expect(result.issues).toEqual([
        {
          severity: 'warning',
          category: 'goal-alignment',
          message: '目标 X 没有对应的 step',
        },
      ]);
      expect(ai.callLlm).toHaveBeenCalledTimes(1);
    });

    it('persists status=error on LLM failure with the message', async () => {
      const { svc } = makeService({
        callLlm: jest.fn().mockRejectedValue(new Error('429 rate limit')),
      });
      const result = await svc.run('p1');
      expect(result.status).toBe('error');
      expect(result.errorMessage).toContain('429 rate limit');
      // Subsequent getOrInit returns the error result (not 'idle').
      const after = await svc.getOrInit('p1');
      expect(after.status).toBe('error');
    });

    it('persists status=error on malformed LLM response', async () => {
      const { svc } = makeService({
        callLlm: jest.fn().mockResolvedValue('not json at all {{{'),
      });
      const result = await svc.run('p1');
      expect(result.status).toBe('error');
      expect(result.errorMessage).toMatch(/解析|parse/i);
    });

    it('coalesces concurrent runs into one LLM call (in-flight guard)', async () => {
      // Without the guard, two simultaneous Run-button clicks would
      // double-spend tokens. With it, both promises resolve to the
      // same result from a single LLM invocation.
      const { svc, ai } = makeService({
        callLlm: jest.fn(
          () => new Promise<string>((r) => setTimeout(() => r('{"issues":[]}'), 30)),
        ),
      });
      const [a, b, c] = await Promise.all([svc.run('p1'), svc.run('p1'), svc.run('p1')]);
      expect(ai.callLlm).toHaveBeenCalledTimes(1);
      expect(a).toBe(b);
      expect(b).toBe(c);
    });

    it('re-enqueues when a save happens during an in-flight run', async () => {
      // Real scenario: lint kicks off at T+0, user saves at T+50ms, lint
      // finishes at T+100ms with the OLD content's analysis. Without the
      // dirty-during-run flag, that stale result locks the cache and the
      // post-save content is never analyzed. The fix: after compute()
      // finishes, if `enqueue` was called during the run, immediately
      // enqueue again so the post-save content gets its own pass.
      //
      // Fake timers from the start so the re-enqueue's default 5s
      // debounce doesn't slow the test.
      jest.useFakeTimers();
      try {
        let resolveLlm!: (s: string) => void;
        const { svc, ai } = makeService({
          callLlm: jest.fn(() => new Promise<string>((r) => (resolveLlm = r))),
        });

        // Kick off the first run; let microtasks flush so the LLM call
        // actually starts.
        const firstRun = svc.run('p1');
        for (let i = 0; i < 20 && ai.callLlm.mock.calls.length === 0; i++) {
          await Promise.resolve();
        }
        expect(ai.callLlm).toHaveBeenCalledTimes(1);

        // Simulate a save mid-flight. In-flight guard → dirty flag set;
        // no parallel LLM call.
        svc.enqueue('p1');
        expect(ai.callLlm).toHaveBeenCalledTimes(1);

        // Resolve the LLM; finally runs and re-enqueues.
        resolveLlm('{"issues":[]}');
        await firstRun;

        // Advance past the default debounce so the second run starts.
        await jest.advanceTimersByTimeAsync(6_000);
        // Flush microtasks so the second compute reaches callLlm.
        for (let i = 0; i < 20 && ai.callLlm.mock.calls.length < 2; i++) {
          await Promise.resolve();
        }
        expect(ai.callLlm).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('enqueue (debounce)', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('runs once after the debounce window even when called multiple times', async () => {
      const { svc, ai } = makeService();
      svc.enqueue('p1', 100);
      svc.enqueue('p1', 100);
      svc.enqueue('p1', 100);
      expect(ai.callLlm).not.toHaveBeenCalled();
      // Advance + flush the fire-and-forget chain.
      await jest.advanceTimersByTimeAsync(150);
      expect(ai.callLlm).toHaveBeenCalledTimes(1);
    });

    it('different projects do not collide', async () => {
      const { svc, ai } = makeService();
      svc.enqueue('p1', 100);
      svc.enqueue('p2', 100);
      await jest.advanceTimersByTimeAsync(150);
      expect(ai.callLlm).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidate', () => {
    it('drops the cache + clears pending timers', async () => {
      const { svc } = makeService();
      await svc.run('p1');
      svc.invalidate('p1');
      const result = await svc.getOrInit('p1');
      expect(result.status).toBe('idle');
    });
  });
});

describe('hashContent', () => {
  it('is stable across calls', () => {
    expect(hashContent('a', 'b')).toBe(hashContent('a', 'b'));
  });

  it('changes when plan changes', () => {
    expect(hashContent('a', 'b')).not.toBe(hashContent('aa', 'b'));
  });

  it('changes when manifest changes', () => {
    expect(hashContent('a', 'b')).not.toBe(hashContent('a', 'bb'));
  });

  it('disambiguates the boundary (`a|b` vs `ab|`) via null separator', () => {
    // Without the \0 separator, hash('ab', '') would collide with
    // hash('a', 'b'). The separator prevents that.
    expect(hashContent('a', 'b')).not.toBe(hashContent('ab', ''));
  });
});

describe('extractRefIds', () => {
  it('finds all req:// ids in the plan markdown', () => {
    const md = `
- [foo](req://r-1.2.3 "x")
- [bar](req://m-1.1.1)
some prose mentioning req://r-7.7.7 in line.
`;
    expect(extractRefIds(md)).toEqual(['r-1.2.3', 'm-1.1.1', 'r-7.7.7']);
  });

  it('returns empty array when no refs present', () => {
    expect(extractRefIds('# just markdown\nno refs here.')).toEqual([]);
  });
});

describe('parseLintResponse', () => {
  it('parses a clean response', () => {
    const issues = parseLintResponse(
      JSON.stringify({
        issues: [
          {
            severity: 'error',
            category: 'req-coverage',
            message: '没覆盖 r-1.2.3',
            location: { file: 'plan', refId: 'r-1.2.3' },
            suggestion: '加一个 step',
          },
        ],
      }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].location).toEqual({ file: 'plan', refId: 'r-1.2.3' });
  });

  it('strips a markdown fence wrapper if present', () => {
    const issues = parseLintResponse('```json\n{"issues":[]}\n```');
    expect(issues).toEqual([]);
  });

  it('falls back to jsonrepair for slightly-broken JSON', () => {
    // Trailing comma + missing quote — common LLM slip
    const issues = parseLintResponse(
      `{"issues":[{"severity":"info","category":"step-grounding","message":"x",}]}`,
    );
    expect(issues).toHaveLength(1);
  });

  it('drops items with invalid severity', () => {
    const issues = parseLintResponse(
      JSON.stringify({
        issues: [
          { severity: 'fatal', category: 'req-coverage', message: 'bad' },
          { severity: 'error', category: 'req-coverage', message: 'good' },
        ],
      }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe('good');
  });

  it('drops items with invalid category', () => {
    const issues = parseLintResponse(
      JSON.stringify({
        issues: [{ severity: 'info', category: 'made-up', message: 'x' }],
      }),
    );
    expect(issues).toHaveLength(0);
  });

  it('drops items with missing/empty message', () => {
    const issues = parseLintResponse(
      JSON.stringify({
        issues: [
          { severity: 'info', category: 'req-coverage' },
          { severity: 'info', category: 'req-coverage', message: '   ' },
        ],
      }),
    );
    expect(issues).toHaveLength(0);
  });

  it('throws on a non-object response', () => {
    expect(() => parseLintResponse('"a string"')).toThrow(/missing issues/);
  });

  it('throws on empty input', () => {
    expect(() => parseLintResponse('   ')).toThrow(/empty/);
  });

  it('preserves location.stepIdx when numeric', () => {
    const issues = parseLintResponse(
      JSON.stringify({
        issues: [
          {
            severity: 'warning',
            category: 'step-grounding',
            message: 'x',
            location: { file: 'manifest', stepIdx: 2 },
          },
        ],
      }),
    );
    expect(issues[0].location).toEqual({ file: 'manifest', stepIdx: 2 });
  });

  it('drops location.file that is neither plan nor manifest', () => {
    const issues = parseLintResponse(
      JSON.stringify({
        issues: [
          {
            severity: 'warning',
            category: 'step-grounding',
            message: 'x',
            location: { file: 'somewhere-else' },
          },
        ],
      }),
    );
    expect(issues[0].location).toBeUndefined();
  });
});
