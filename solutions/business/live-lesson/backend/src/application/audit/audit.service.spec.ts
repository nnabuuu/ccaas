import { NotFoundException } from '@nestjs/common';

import {
  AuditService,
  extractRefIds,
  stripFenceWrapper,
} from './audit.service';
import { AuditPromptBuilder } from './audit-prompt-builder';
import { auditReportPath } from './audit.schema';

// Regex matching the generator's output: `audit/<ISO with : and . swapped for ->.md`.
const AUDIT_PATH_RE = /^audit\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.md$/;

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
    upsertArtifact: jest.fn(async (_pid: string, path: string) => ({
      path,
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
      // Idle has no reportPath — there's no run to point at yet.
      expect(state.reportPath).toBeUndefined();
    });
  });

  describe('run', () => {
    it('returns running state synchronously then transitions to done', async () => {
      const { svc, ai, projects } = makeService();
      const initial = svc.run('p1');
      // Synchronous return: status is already 'running'.
      expect(initial.status).toBe('running');
      // First run: no previous report, running state has no reportPath.
      expect(initial.reportPath).toBeUndefined();

      // Flush the fire-and-forget compute.
      await flushRun();

      const done = svc.getState('p1');
      expect(done.status).toBe('done');
      expect(done.lastGeneratedAt).toBeDefined();
      // Report written to a fresh timestamped path; state.reportPath
      // tracks where it landed.
      expect(done.reportPath).toMatch(AUDIT_PATH_RE);
      expect(projects.upsertArtifact).toHaveBeenCalledWith(
        'p1',
        expect.stringMatching(AUDIT_PATH_RE),
        expect.stringContaining('# 概述'),
        'md',
      );
      expect(ai.callLlm).toHaveBeenCalledTimes(1);
    });

    it('writes a fresh timestamped path on each run (history kept)', async () => {
      // Two runs back-to-back should produce two distinct file paths so
      // each ends up as its own historical artifact. The frontend opens
      // each as a separate dynamic tab — losing history would collapse
      // them into the same view.
      const { svc, projects } = makeService();
      svc.run('p1');
      await flushRun();
      const first = svc.getState('p1').reportPath;
      // Tick the clock by mocking Date — easiest: wait a real ms so
      // the new auditReportPath() landing on a different ISO timestamp.
      await new Promise((r) => setTimeout(r, 5));
      svc.run('p1');
      await flushRun();
      const second = svc.getState('p1').reportPath;
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      expect(second).not.toBe(first);
      // Both writes happened (history accumulates, not overwrites).
      const writtenPaths = projects.upsertArtifact.mock.calls.map(
        (c: any[]) => c[1],
      );
      expect(writtenPaths).toContain(first);
      expect(writtenPaths).toContain(second);
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

  describe('auditReportPath contract', () => {
    it('produces a path under audit/, never under the _lib/ reserved prefix', () => {
      // upsertArtifact rejects writes under _lib/. If the path generator
      // ever moved there by a typo, every audit run would 500. Pin it.
      const path = auditReportPath(new Date());
      expect(path.startsWith('audit/')).toBe(true);
      expect(path.startsWith('_lib')).toBe(false);
    });

    it('is lexically sortable (chronological = alphabetical)', () => {
      // Lexical sort = chronological is a useful invariant for the
      // file browser to show "newest audit last" without extra metadata.
      const earlier = auditReportPath(new Date('2026-05-27T08:00:00.000Z'));
      const later = auditReportPath(new Date('2026-05-27T08:30:00.000Z'));
      expect([later, earlier].sort()[1]).toBe(later);
    });

    it('uses filesystem-safe separators (no : or .)', () => {
      // Some filesystems reject `:` and `.` in odd positions; encode
      // both as `-` so the path is portable.
      const path = auditReportPath(new Date('2026-05-27T08:28:34.123Z'));
      expect(path).toBe('audit/2026-05-27T08-28-34-123Z.md');
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
