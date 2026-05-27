import { LintPromptBuilder } from './lint-prompt-builder';

describe('LintPromptBuilder', () => {
  const builder = new LintPromptBuilder();

  describe('build', () => {
    it('produces a system + user prompt pair', () => {
      const { systemPrompt, userMessage } = builder.build({
        plan: '# Plan',
        manifest: '{}',
        libItems: [],
      });
      expect(systemPrompt).toContain('教研员');
      expect(systemPrompt).toContain('req-coverage');
      expect(userMessage).toContain('[PLAN markdown]');
      expect(userMessage).toContain('# Plan');
      expect(userMessage).toContain('[EXECUTION manifest JSON]');
      expect(userMessage).toContain('{}');
    });

    it('embeds lib items in a deterministic bullet form', () => {
      const { userMessage } = builder.build({
        plan: '',
        manifest: '',
        libItems: [
          {
            id: 'r-1.2.3',
            text: '推断生词含义',
            subject: 'english',
            categoryLabel: '语言能力',
          },
        ],
      });
      // The exact format matters because the LLM is anchored to it
      // — change the format and tune the prompt downstream too.
      expect(userMessage).toContain(
        '- r-1.2.3: 推断生词含义 (subject: english · category: 语言能力)',
      );
    });

    it('strips newlines from lib item text (one item one line contract)', () => {
      const { userMessage } = builder.build({
        plan: '',
        manifest: '',
        libItems: [
          {
            id: 'r-1.2.3',
            text: 'line one\nline two',
            subject: 'english',
            categoryLabel: 'x',
          },
        ],
      });
      const libLine = userMessage
        .split('\n')
        .find((l) => l.startsWith('- r-1.2.3:'));
      expect(libLine).toBeDefined();
      expect(libLine).not.toMatch(/\n/);
      expect(libLine).toContain('line one line two');
    });

    it('marks the empty lib-items case explicitly (LLM signal)', () => {
      const { userMessage } = builder.build({
        plan: '',
        manifest: '',
        libItems: [],
      });
      expect(userMessage).toContain('plan 未引用任何教学要求');
    });

    it('truncates oversized plan + appends marker', () => {
      // PLAN_MAX_BYTES is 16,000. Build a string clearly past that.
      const plan = '一'.repeat(20_000); // 60 KB in UTF-8 (3 bytes/char)
      const { userMessage } = builder.build({
        plan,
        manifest: '',
        libItems: [],
      });
      expect(userMessage).toContain('[TRUNCATED]');
      // Truncation must NOT split a multi-byte char (would corrupt
      // the encoding); verify the marker sits on a valid boundary
      // by re-encoding round-trip.
      const planSection = userMessage
        .split('[EXECUTION manifest JSON]')[0]
        .replace('[PLAN markdown]', '')
        .trim();
      // Should be valid UTF-8 — no replacement chars from broken codepoints.
      expect(planSection).not.toContain('�');
    });

    it('truncates oversized manifest', () => {
      const manifest = JSON.stringify({
        readingSteps: Array.from({ length: 500 }, (_, i) => ({
          id: `step-${i}`,
          idx: i,
          label: 'x'.repeat(200),
        })),
      });
      const { userMessage } = builder.build({
        plan: '',
        manifest,
        libItems: [],
      });
      expect(Buffer.byteLength(manifest, 'utf8')).toBeGreaterThan(32_000);
      expect(userMessage).toContain('[TRUNCATED]');
    });

    it('does not truncate inputs within the cap', () => {
      const { userMessage } = builder.build({
        plan: '# small plan',
        manifest: '{"a": 1}',
        libItems: [],
      });
      expect(userMessage).not.toContain('[TRUNCATED]');
    });
  });
});
