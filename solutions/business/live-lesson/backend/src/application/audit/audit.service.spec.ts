import { NotFoundException } from '@nestjs/common';

import {
  AuditService,
  extractRefIds,
  stripFenceWrapper,
} from './audit.service';
import { AuditPromptBuilder } from './audit-prompt-builder';
import { AUDIT_REPORT_PATH } from './audit.schema';

/**
 * Unit tests for AuditService. Hand-built service with mocked deps
 * — no Nest TestingModule because the audit-side dependency graph is
 * simple (one-way: AuditService → ProjectService/TeachingRequirements/
 * AiPromptBuilder/AuditPromptBuilder).
 */

function makeService(overrides?: {
  readFile?: jest.Mock;
  findOne?: jest.Mock;
  upsertArtifact?: jest.Mock;
  tryFindItemById?: jest.Mock;
  callLlm?: jest.Mock;
}) {
  const projects = {
    findOne: jest.fn(async () => ({ id: 'p1', title: 'Sample', status: 'draft' })),
    readFile: jest.fn(async (_pid: string, path: string) => {
      if (path === 'plan/lesson-plan.md') {
        return {
          content: '# plan with [link](req://r-1.2.3 "x")',
          fileType: 'md',
        };
      }
      if (path === 'execution/manifest.json') {
        return { content: '{"readingSteps":[]}', fileType: 'json' };
      }
      throw new NotFoundException(path);
    }),
    upsertArtifact: jest.fn(async () => ({
      path: AUDIT_REPORT_PATH,
      fileType: 'md',
    })),
    ...(overrides?.findOne ? { findOne: overrides.findOne } : {}),
    ...(overrides?.readFile ? { readFile: overrides.readFile } : {}),
    ...(overrides?.upsertArtifact
      ? { upsertArtifact: overrides.upsertArtifact }
      : {}),
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
    ...(overrides?.tryFindItemById
      ? { tryFindItemById: overrides.tryFindItemById }
      : {}),
  } as any;

  const ai = {
    callLlm: jest.fn(async () => '# 概述\n\n报告正文 ...'),
    ...(overrides?.callLlm ? { callLlm: overrides.callLlm } : {}),
  } as any;

  const promptBuilder = new AuditPromptBuilder();

  const svc = new AuditService(projects, teachingRequirements, ai, promptBuilder);
  return { svc, projects, teachingRequirements, ai };
}

/**
 * Wait for the fire-and-forget run promise to settle. AuditService.run
 * is sync-return (the controller responds 202 without waiting), so
 * tests need to flush microtasks to observe the eventual state.
 */
async function flushRun(): Promise<void> {
  // Several Promise.resolve() ticks cover the chain: loadContext →
  // readSafe → callLlm → upsertArtifact → state.set.
  for (let i = 0; i < 30; i++) {
    await Promise.resolve();
  }
}

describe('AuditService', () => {
  describe('getState', () => {
    it('returns idle when nothing has been cached', () => {
      const { svc } = makeService();
      const state = svc.getState('p1');
      expect(state.status).toBe('idle');
      expect(state.reportPath).toBe(AUDIT_REPORT_PATH);
    });
  });

  describe('run', () => {
    it('returns running state synchronously then transitions to done', async () => {
      const { svc, ai, projects } = makeService();
      const initial = svc.run('p1');
      // Synchronous return: status is already 'running'.
      expect(initial.status).toBe('running');
      expect(initial.reportPath).toBe(AUDIT_REPORT_PATH);

      // Flush the fire-and-forget compute.
      await flushRun();

      const done = svc.getState('p1');
      expect(done.status).toBe('done');
      expect(done.lastGeneratedAt).toBeDefined();
      // Report was written to the canonical path.
      expect(projects.upsertArtifact).toHaveBeenCalledWith(
        'p1',
        AUDIT_REPORT_PATH,
        expect.stringContaining('# 概述'),
        'md',
      );
      expect(ai.callLlm).toHaveBeenCalledTimes(1);
    });

    it('coalesces concurrent run() calls (in-flight guard)', async () => {
      // Manual button + agent calling at once must not double-spend tokens.
      let resolveLlm!: (s: string) => void;
      const { svc, ai } = makeService({
        callLlm: jest.fn(
          () => new Promise<string>((r) => (resolveLlm = r)),
        ),
      });
      svc.run('p1');
      svc.run('p1');
      svc.run('p1');
      // Three sync returns but only one LLM call kicked off — flush
      // microtasks to reach the actual callLlm.
      await flushRun();
      expect(ai.callLlm).toHaveBeenCalledTimes(1);
      resolveLlm('# 概述\n\nok');
      await flushRun();
      expect(svc.getState('p1').status).toBe('done');
    });

    it('persists status=error + errorMessage on LLM failure', async () => {
      const { svc } = makeService({
        callLlm: jest.fn().mockRejectedValue(new Error('429 rate limit')),
      });
      svc.run('p1');
      await flushRun();
      const state = svc.getState('p1');
      expect(state.status).toBe('error');
      expect(state.errorMessage).toContain('429 rate limit');
    });

    it('persists status=error when LLM returns empty content', async () => {
      // A blank response (or a response stripped down to nothing by the
      // fence-wrapper logic) shouldn't get persisted as a "done" report.
      const { svc, projects } = makeService({
        callLlm: jest.fn().mockResolvedValue('   '),
      });
      svc.run('p1');
      await flushRun();
      expect(svc.getState('p1').status).toBe('error');
      // Critical: we must NOT have called upsertArtifact with the empty
      // content — otherwise the teacher's last good report on disk
      // gets overwritten with whitespace.
      expect(projects.upsertArtifact).not.toHaveBeenCalled();
    });

    it('strips an outer ```markdown fence before writing', async () => {
      // Some LLMs wrap output in a fence despite the prompt; the
      // wrapper would render as literal fences in the markdown viewer.
      // Make sure compute() strips before persisting.
      const { svc, projects } = makeService({
        callLlm: jest
          .fn()
          .mockResolvedValue('```markdown\n# 概述\n\n报告内容\n```'),
      });
      svc.run('p1');
      await flushRun();
      const writeCall = projects.upsertArtifact.mock.calls[0];
      // Persisted form = REPORT_BANNER + stripped content. Assert on
      // both: the fence is gone AND the banner is present (anti-injection
      // marker for downstream agent readers).
      expect(writeCall[2]).toContain('# 概述\n\n报告内容');
      expect(writeCall[2]).not.toContain('```markdown');
      expect(writeCall[2]).toContain('AI-generated audit report');
    });

    it('preserves lastGeneratedAt across errors (last-known-good)', async () => {
      const { svc } = makeService();
      svc.run('p1');
      await flushRun();
      const firstDone = svc.getState('p1');
      const firstStamp = firstDone.lastGeneratedAt;
      expect(firstStamp).toBeDefined();

      // Second run fails — but the teacher's most recent good timestamp
      // should still be reflected so the UI can show "last successful
      // audit was at X".
      const svc2 = svc as any;
      // Mutate the LLM mock to fail next call.
      const aiFromSvc = svc2['ai'];
      aiFromSvc.callLlm.mockRejectedValueOnce(new Error('boom'));

      svc.run('p1');
      await flushRun();
      const afterFail = svc.getState('p1');
      expect(afterFail.status).toBe('error');
      expect(afterFail.lastGeneratedAt).toBe(firstStamp);
    });

    it('returns running state for a second call while first is in flight', async () => {
      let resolveLlm: ((s: string) => void) | undefined;
      const { svc } = makeService({
        callLlm: jest.fn(
          () => new Promise<string>((r) => (resolveLlm = r)),
        ),
      });
      const first = svc.run('p1');
      const second = svc.run('p1');
      expect(first.status).toBe('running');
      expect(second.status).toBe('running');
      // Flush microtasks until the LLM call has been entered, so we can
      // resolve it cleanly (the LLM mock isn't invoked synchronously —
      // loadContext awaits readFile first).
      for (let i = 0; i < 20 && !resolveLlm; i++) {
        await Promise.resolve();
      }
      resolveLlm!('# 概述');
      await flushRun();
      expect(svc.getState('p1').status).toBe('done');
    });
  });

  describe('invalidate', () => {
    it('drops the cached state', async () => {
      const { svc } = makeService();
      svc.run('p1');
      await flushRun();
      svc.invalidate('p1');
      expect(svc.getState('p1').status).toBe('idle');
    });

    it('does NOT abort an in-flight run; it completes + caches', async () => {
      // Documents the contract from audit.service.ts:124-126: invalidate
      // is purely a cache-drop, the running promise is allowed to
      // complete + repopulate the cache. A teacher who clicks
      // "invalidate" (future admin tool) during a run gets the run's
      // result anyway — not a dangling in-flight promise.
      let resolveLlm: ((s: string) => void) | undefined;
      const { svc } = makeService({
        callLlm: jest.fn(
          () => new Promise<string>((r) => (resolveLlm = r)),
        ),
      });
      svc.run('p1');
      // Wait for LLM call to be entered, then invalidate cache.
      for (let i = 0; i < 20 && !resolveLlm; i++) {
        await Promise.resolve();
      }
      svc.invalidate('p1');
      expect(svc.getState('p1').status).toBe('idle');
      // Finish the run; cache should re-populate with 'done'.
      resolveLlm!('# 概述');
      await flushRun();
      expect(svc.getState('p1').status).toBe('done');
    });
  });

  describe('lastGeneratedAt timestamp', () => {
    it('updates on every successful run (not stale-cached)', async () => {
      const { svc } = makeService();
      svc.run('p1');
      await flushRun();
      const t1 = svc.getState('p1').lastGeneratedAt;
      expect(t1).toBeDefined();

      // Wait a tick to guarantee a different ISO ms value, then re-run.
      await new Promise((r) => setTimeout(r, 5));
      svc.run('p1');
      await flushRun();
      const t2 = svc.getState('p1').lastGeneratedAt;
      expect(t2).toBeDefined();
      expect(t2).not.toBe(t1);
    });
  });

  describe('AUDIT_REPORT_PATH contract', () => {
    it('does not collide with the _lib/ reserved prefix', () => {
      // upsertArtifact rejects writes under _lib/ — if AUDIT_REPORT_PATH
      // ever moves there by a typo, every audit run would 500. Pin it.
      expect(AUDIT_REPORT_PATH.startsWith('_lib')).toBe(false);
      expect(AUDIT_REPORT_PATH).toMatch(/^[a-z]/);
    });
  });
});

describe('extractRefIds', () => {
  it('finds all req:// ids in the plan markdown', () => {
    const md = `
- [foo](req://r-1.2.3 "x")
- [bar](req://m-1.1.1)
mention req://r-7.7.7 in sentence.
`;
    expect(extractRefIds(md)).toEqual(['r-1.2.3', 'm-1.1.1', 'r-7.7.7']);
  });

  it('trims trailing dot from sentence-end ids', () => {
    expect(extractRefIds('see req://r-1.2.3.')).toEqual(['r-1.2.3']);
  });

  it('returns empty array when no refs present', () => {
    expect(extractRefIds('# just markdown\nno refs here.')).toEqual([]);
  });
});

describe('stripFenceWrapper', () => {
  it('removes a ```markdown fence', () => {
    expect(stripFenceWrapper('```markdown\n# title\n```')).toBe('# title');
  });

  it('removes a ```md fence', () => {
    expect(stripFenceWrapper('```md\n# title\n```')).toBe('# title');
  });

  it('removes a bare ``` fence', () => {
    expect(stripFenceWrapper('```\n# title\n```')).toBe('# title');
  });

  it('is a no-op when no fence is present', () => {
    expect(stripFenceWrapper('# title\n\nbody')).toBe('# title\n\nbody');
  });

  it('preserves a trailing fenced code block when no outer fence wraps the whole document', () => {
    // Regression guard for the over-eager regex: a report that
    // legitimately ends with a fenced code sample (in a callout
    // example, say) must NOT have its trailing ``` eaten.
    const md = '# title\n\nbody\n\n```js\nconsole.log(1);\n```';
    expect(stripFenceWrapper(md)).toBe(md);
  });
});
