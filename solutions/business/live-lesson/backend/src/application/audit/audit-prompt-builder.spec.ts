import { AuditPromptBuilder } from './audit-prompt-builder';

describe('AuditPromptBuilder', () => {
  const builder = new AuditPromptBuilder();

  describe('build', () => {
    it('produces a system + user prompt pair', () => {
      const { systemPrompt, userMessage } = builder.build({
        projectTitle: 'Sample Lesson',
        plan: '# Plan',
        manifest: '{}',
        libItems: [],
      });
      // System prompt encodes the 4-chapter contract — assert each
      // chapter heading appears so a future edit to the prompt that
      // accidentally drops one fails loudly.
      expect(systemPrompt).toContain('一、结构与时间');
      expect(systemPrompt).toContain('二、教学要求覆盖');
      expect(systemPrompt).toContain('三、AI 不确定性');
      expect(systemPrompt).toContain('四、配置健康度');
    });

    it('encodes the four callout severities in the directive examples', () => {
      const { systemPrompt } = builder.build({
        projectTitle: '',
        plan: '',
        manifest: '',
        libItems: [],
      });
      // Frontend renderer keys off these directive prefixes — if the
      // prompt stops emitting any of them, callout severity colors
      // won't render. Lock the contract.
      expect(systemPrompt).toContain(':::pass');
      expect(systemPrompt).toContain(':::warn');
      expect(systemPrompt).toContain(':::guess');
      expect(systemPrompt).toContain(':::error');
    });

    it('embeds project title + plan + manifest in the user message', () => {
      const { userMessage } = builder.build({
        projectTitle: 'Ideal Beauty',
        plan: '# My Plan',
        manifest: '{"readingSteps":[]}',
        libItems: [],
      });
      expect(userMessage).toContain('[项目名] Ideal Beauty');
      expect(userMessage).toContain('[PLAN markdown]');
      expect(userMessage).toContain('# My Plan');
      expect(userMessage).toContain('[EXECUTION manifest JSON]');
      expect(userMessage).toContain('"readingSteps":[]');
    });

    it('lists lib items in a deterministic bullet form', () => {
      const { userMessage } = builder.build({
        projectTitle: 'x',
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
      expect(userMessage).toContain(
        '- r-1.2.3: 推断生词含义 (subject: english · category: 语言能力)',
      );
    });

    it('marks the empty lib-items case (LLM signal)', () => {
      const { userMessage } = builder.build({
        projectTitle: 'x',
        plan: '',
        manifest: '',
        libItems: [],
      });
      expect(userMessage).toContain('plan 未引用任何教学要求');
    });

    it('falls back to placeholder when project title is empty', () => {
      const { userMessage } = builder.build({
        projectTitle: '',
        plan: '',
        manifest: '',
        libItems: [],
      });
      expect(userMessage).toContain('[项目名] (未命名)');
    });

    it('truncates oversized plan with marker', () => {
      const plan = '一'.repeat(20_000); // 60 KB UTF-8
      const { userMessage } = builder.build({
        projectTitle: 'x',
        plan,
        manifest: '',
        libItems: [],
      });
      expect(userMessage).toContain('[TRUNCATED]');
      // Truncation must not split a multi-byte char — re-encoding
      // a corrupted slice would surface as � replacement chars.
      const planSection = userMessage
        .split('[EXECUTION manifest JSON]')[0]
        .replace(/^[\s\S]*\[PLAN markdown\]\n/, '');
      expect(planSection).not.toContain('�');
    });
  });
});
