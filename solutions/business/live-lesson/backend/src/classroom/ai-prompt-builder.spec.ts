import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AiPromptBuilder } from './ai-prompt-builder';

describe('AiPromptBuilder', () => {
  let builder: AiPromptBuilder;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [AiPromptBuilder],
    }).compile();
    builder = module.get(AiPromptBuilder);
  });

  // ── parseDiscussResponse — probeReply (JSON mode) ──

  describe('parseDiscussResponse — probeReply', () => {
    const type = 'probeReply';

    it('should parse well-formed JSON with all three fields', () => {
      const raw = JSON.stringify({
        reply: 'Great observation about the metaphor in ¶2.',
        followUpQuestion: 'What do you think the author meant by "golden ratio"?',
        quality: 'pass',
      });

      const result = builder.parseDiscussResponse(raw, type);

      expect(result.reply).toBe('Great observation about the metaphor in ¶2.');
      expect(result.followUpQuestion).toBe('What do you think the author meant by "golden ratio"?');
      expect(result.quality).toBe('pass');
    });

    it('should parse retry quality', () => {
      const raw = JSON.stringify({
        reply: 'Could you elaborate a bit more?',
        followUpQuestion: 'Try looking at ¶3 again — what stands out?',
        quality: 'retry',
      });

      const result = builder.parseDiscussResponse(raw, type);

      expect(result.quality).toBe('retry');
      expect(result.reply).toBe('Could you elaborate a bit more?');
      expect(result.followUpQuestion).toBe('Try looking at ¶3 again — what stands out?');
    });

    it('should default to pass when quality key is missing', () => {
      const raw = JSON.stringify({
        reply: 'Nice work identifying the main idea.',
        followUpQuestion: 'How does this connect to ¶1?',
      });

      const result = builder.parseDiscussResponse(raw, type);

      expect(result.quality).toBe('pass');
      expect(result.reply).toBe('Nice work identifying the main idea.');
      expect(result.followUpQuestion).toBe('How does this connect to ¶1?');
    });

    it('should default to pass when quality value is garbage', () => {
      const raw = JSON.stringify({
        reply: 'Good thinking.',
        followUpQuestion: 'What else?',
        quality: 'maybe',
      });

      const result = builder.parseDiscussResponse(raw, type);

      expect(result.quality).toBe('pass');
    });

    it('should handle no followUpQuestion key → undefined', () => {
      const raw = JSON.stringify({ reply: 'Great answer.', quality: 'pass' });

      const result = builder.parseDiscussResponse(raw, type);

      expect(result.reply).toBe('Great answer.');
      expect(result.followUpQuestion).toBeUndefined();
      expect(result.quality).toBe('pass');
    });

    it('should handle empty followUpQuestion string → undefined', () => {
      const raw = JSON.stringify({ reply: 'Ok.', followUpQuestion: '', quality: 'pass' });

      const result = builder.parseDiscussResponse(raw, type);

      expect(result.followUpQuestion).toBeUndefined();
    });

    it('should handle extra keys (ignored)', () => {
      const raw = JSON.stringify({
        reply: 'Nice.',
        followUpQuestion: 'More?',
        quality: 'pass',
        reasoning: 'student engaged well',
      });

      const result = builder.parseDiscussResponse(raw, type);

      expect(result.reply).toBe('Nice.');
      expect(result.followUpQuestion).toBe('More?');
      expect(result.quality).toBe('pass');
    });

    it('should trim whitespace from reply and followUpQuestion', () => {
      const raw = JSON.stringify({
        reply: '  Good answer.  ',
        followUpQuestion: '  Tell me more.  ',
        quality: 'pass',
      });

      const result = builder.parseDiscussResponse(raw, type);

      expect(result.reply).toBe('Good answer.');
      expect(result.followUpQuestion).toBe('Tell me more.');
    });
  });

  // ── parseDiscussResponse — followUpReply (JSON mode) ──

  describe('parseDiscussResponse — followUpReply', () => {
    const type = 'followUpReply';

    it('should parse reply and quality, omit followUpQuestion', () => {
      const raw = JSON.stringify({ reply: 'Great synthesis of the ideas.', quality: 'pass' });

      const result = builder.parseDiscussResponse(raw, type);

      expect(result.reply).toBe('Great synthesis of the ideas.');
      expect(result.followUpQuestion).toBeUndefined();
      expect(result.quality).toBe('pass');
    });

    it('should handle retry quality', () => {
      const raw = JSON.stringify({ reply: 'You need to look more carefully at the text.', quality: 'retry' });

      const result = builder.parseDiscussResponse(raw, type);

      expect(result.reply).toBe('You need to look more carefully at the text.');
      expect(result.quality).toBe('retry');
    });

    it('should default to pass when quality key missing', () => {
      const raw = JSON.stringify({ reply: 'Good job wrapping up the discussion.' });

      const result = builder.parseDiscussResponse(raw, type);

      expect(result.reply).toBe('Good job wrapping up the discussion.');
      expect(result.quality).toBe('pass');
    });

    it('should strip followUpQuestion even if LLM includes it for followUpReply', () => {
      const raw = JSON.stringify({
        reply: 'Excellent work!',
        followUpQuestion: 'Should not appear',
        quality: 'pass',
      });

      const result = builder.parseDiscussResponse(raw, type);

      expect(result.reply).toBe('Excellent work!');
      expect(result.followUpQuestion).toBeUndefined();
      expect(result.quality).toBe('pass');
    });
  });

  // ── parseDiscussResponse — malformed / fallback cases ──

  describe('parseDiscussResponse — malformed JSON', () => {
    it('should handle code-fenced JSON (```json ... ```)', () => {
      const inner = JSON.stringify({ reply: 'Good answer.', followUpQuestion: 'More?', quality: 'pass' });
      const raw = '```json\n' + inner + '\n```';

      const result = builder.parseDiscussResponse(raw, 'probeReply');

      expect(result.reply).toBe('Good answer.');
      expect(result.followUpQuestion).toBe('More?');
      expect(result.quality).toBe('pass');
    });

    it('should handle code-fenced JSON without language tag', () => {
      const inner = JSON.stringify({ reply: 'Nice.', quality: 'retry' });
      const raw = '```\n' + inner + '\n```';

      const result = builder.parseDiscussResponse(raw, 'followUpReply');

      expect(result.reply).toBe('Nice.');
      expect(result.quality).toBe('retry');
    });

    it('should fallback to raw text when JSON.parse fails completely', () => {
      const raw = 'That is a really thoughtful answer. Keep going!';

      const result = builder.parseDiscussResponse(raw, 'probeReply');

      expect(result.reply).toBe('That is a really thoughtful answer. Keep going!');
      expect(result.followUpQuestion).toBeUndefined();
      expect(result.quality).toBe('pass');
    });

    it('should handle empty string', () => {
      const result = builder.parseDiscussResponse('', 'probeReply');

      expect(result.reply).toBe('');
      expect(result.quality).toBe('pass');
    });

    it('should handle whitespace-only input', () => {
      const result = builder.parseDiscussResponse('   \n\n  ', 'probeReply');

      expect(result.quality).toBe('pass');
    });

    it('should handle partial JSON (not valid)', () => {
      const raw = '{"reply": "Hello", "quality":';

      const result = builder.parseDiscussResponse(raw, 'probeReply');

      expect(result.reply).toBe(raw.trim());
      expect(result.quality).toBe('pass');
    });
  });

  // ── parseDiscussResponse — type mismatches ──

  describe('parseDiscussResponse — type safety', () => {
    it('should fallback to raw when reply is a number', () => {
      const raw = JSON.stringify({ reply: 123, quality: 'pass' });

      const result = builder.parseDiscussResponse(raw, 'probeReply');

      // reply is not a string → falls back to raw.trim()
      expect(result.reply).toBe(raw.trim());
      expect(result.quality).toBe('pass');
    });

    it('should default quality to pass when quality is boolean', () => {
      const raw = JSON.stringify({ reply: 'Ok.', quality: true });

      const result = builder.parseDiscussResponse(raw, 'probeReply');

      expect(result.quality).toBe('pass');
    });

    it('should handle followUpQuestion as number → undefined', () => {
      const raw = JSON.stringify({ reply: 'Good.', followUpQuestion: 42, quality: 'pass' });

      const result = builder.parseDiscussResponse(raw, 'probeReply');

      expect(result.followUpQuestion).toBeUndefined();
    });

    it('should handle null values gracefully', () => {
      const raw = JSON.stringify({ reply: null, followUpQuestion: null, quality: null });

      const result = builder.parseDiscussResponse(raw, 'probeReply');

      expect(result.reply).toBe(raw.trim());
      expect(result.followUpQuestion).toBeUndefined();
      expect(result.quality).toBe('pass');
    });
  });

  // ── Depth field parsing ──

  describe('parseDiscussResponse — depth field', () => {
    it('should parse valid depth from probeReply', () => {
      const raw = JSON.stringify({ reply: 'Good.', followUpQuestion: 'Why?', quality: 'pass', depth: 'partial' });
      const result = builder.parseDiscussResponse(raw, 'probeReply');
      expect(result.depth).toBe('partial');
    });

    it('should parse valid depth from followUpReply', () => {
      const raw = JSON.stringify({ reply: 'Well done.', quality: 'pass', depth: 'deep' });
      const result = builder.parseDiscussResponse(raw, 'followUpReply');
      expect(result.depth).toBe('deep');
    });

    it('should return undefined for invalid depth value', () => {
      const raw = JSON.stringify({ reply: 'Ok.', quality: 'pass', depth: 'bogus' });
      const result = builder.parseDiscussResponse(raw, 'probeReply');
      expect(result.depth).toBeUndefined();
    });

    it('should return undefined when depth key is missing', () => {
      const raw = JSON.stringify({ reply: 'Ok.', quality: 'pass' });
      const result = builder.parseDiscussResponse(raw, 'followUpReply');
      expect(result.depth).toBeUndefined();
    });

    it('should return undefined when depth is null', () => {
      const raw = JSON.stringify({ reply: 'Ok.', quality: 'pass', depth: null });
      const result = builder.parseDiscussResponse(raw, 'probeReply');
      expect(result.depth).toBeUndefined();
    });

    it('should parse depth=surface correctly', () => {
      const raw = JSON.stringify({ reply: 'Try again.', followUpQuestion: 'Think deeper.', quality: 'pass', depth: 'surface' });
      const result = builder.parseDiscussResponse(raw, 'probeReply');
      expect(result.depth).toBe('surface');
    });
  });

  // ── buildContinueChatPrompt (post-discuss, answer revealed) ──

  describe('buildContinueChatPrompt', () => {
    const manifest = {
      article: { title: 'Beauty in Math', paragraphs: [{ id: 'p1', text: 'The golden ratio...' }] },
      readingSteps: [{
        idx: 1, label: 'Quiz Step', strategy: 'quiz',
        answerKey: {
          type: 'quiz',
          answers: [{ questionIdx: 0, correct: 1, questionText: 'Q1', options: ['A', 'B'] }],
        },
        discuss: {
          fallbackMC: { explanation: 'B is correct because the golden ratio appears in nature.' },
          insight: 'Math connects to beauty in unexpected ways.',
        },
      }],
    };

    it('should contain post-discuss role (延伸讨论), not Socratic restriction', () => {
      const prompt = builder.buildContinueChatPrompt(manifest, 1);

      expect(prompt).toContain('延伸讨论');
      expect(prompt).toContain('自由引用答案');
      expect(prompt).not.toContain('严禁直接告诉学生');
      expect(prompt).not.toContain('苏格拉底');
    });

    it('should include the full answer key', () => {
      const prompt = builder.buildContinueChatPrompt(manifest, 1);

      expect(prompt).toContain('正确答案');
      expect(prompt).toContain('"correct": 1');
      expect(prompt).toContain('可以直接引用答案来帮助解释');
    });

    it('should include discuss explanation and insight', () => {
      const prompt = builder.buildContinueChatPrompt(manifest, 1);

      expect(prompt).toContain('B is correct because the golden ratio appears in nature.');
      expect(prompt).toContain('Math connects to beauty in unexpected ways.');
    });

    it('should include article text and step context', () => {
      const prompt = builder.buildContinueChatPrompt(manifest, 1);

      expect(prompt).toContain('课文全文');
      expect(prompt).toContain('The golden ratio...');
      expect(prompt).toContain('Beauty in Math');
      expect(prompt).toContain('当前步骤');
      expect(prompt).toContain('Quiz Step');
    });

    it('should include 200-char limit in response rules', () => {
      const prompt = builder.buildContinueChatPrompt(manifest, 1);

      expect(prompt).toContain('不超过 200 字');
      expect(prompt).toContain('用中文回答');
    });

    it('should handle step without answerKey', () => {
      const noAnswerManifest = {
        article: { title: 'T', paragraphs: [] },
        readingSteps: [{ idx: 2, label: 'Reading Step', strategy: 'reading' }],
      };

      const prompt = builder.buildContinueChatPrompt(noAnswerManifest, 2);

      expect(prompt).toContain('延伸讨论');
      expect(prompt).not.toContain('正确答案');
    });

    it('should handle step without discuss field', () => {
      const noDiscussManifest = {
        article: { title: 'T', paragraphs: [] },
        readingSteps: [{
          idx: 3, label: 'Practice', strategy: 'quiz',
          answerKey: { type: 'quiz', answers: [] },
        }],
      };

      const prompt = builder.buildContinueChatPrompt(noDiscussManifest, 3);

      expect(prompt).toContain('正确答案');
      expect(prompt).not.toContain('参考解析');
    });

    it('should handle unknown step index gracefully', () => {
      const prompt = builder.buildContinueChatPrompt(manifest, 99);

      expect(prompt).toContain('延伸讨论');
      expect(prompt).not.toContain('正确答案');
      expect(prompt).not.toContain('当前步骤');
    });

    it('should handle discuss with only explanation (no insight)', () => {
      const partialManifest = {
        article: { title: 'T', paragraphs: [] },
        readingSteps: [{
          idx: 1, label: 'S1', strategy: 'quiz',
          discuss: { fallbackMC: { explanation: 'Only explanation here.' } },
        }],
      };

      const prompt = builder.buildContinueChatPrompt(partialManifest, 1);

      expect(prompt).toContain('Only explanation here.');
      expect(prompt).toContain('参考解析');
    });

    it('should handle discuss with only insight (no explanation)', () => {
      const partialManifest = {
        article: { title: 'T', paragraphs: [] },
        readingSteps: [{
          idx: 1, label: 'S1', strategy: 'quiz',
          discuss: { insight: 'Only insight here.' },
        }],
      };

      const prompt = builder.buildContinueChatPrompt(partialManifest, 1);

      expect(prompt).toContain('Only insight here.');
      expect(prompt).toContain('参考解析');
    });
  });

  // ── Prompt content: verify JSON schema and quality rules ──

  describe('buildDiscussSystemPrompt — JSON format instructions', () => {
    const manifest = {
      article: { title: 'Test', paragraphs: [{ id: 'p1', text: 'Hello world.' }] },
      readingSteps: [{ idx: 1, label: 'Step 1', strategy: 'test' }],
    };
    const stepDef = manifest.readingSteps[0];

    it('should include JSON schema in probeReply prompt', () => {
      const prompt = builder.buildDiscussSystemPrompt(manifest, stepDef, null, 'probeReply');

      expect(prompt).toContain('"reply"');
      expect(prompt).toContain('"followUpQuestion"');
      expect(prompt).toContain('"quality"');
      expect(prompt).toContain('"depth"');
      expect(prompt).toContain('JSON');
    });

    it('should include JSON schema in followUpReply prompt', () => {
      const prompt = builder.buildDiscussSystemPrompt(manifest, stepDef, null, 'followUpReply');

      expect(prompt).toContain('"reply"');
      expect(prompt).toContain('"quality"');
      expect(prompt).toContain('"depth"');
      expect(prompt).toContain('JSON');
      expect(prompt).toContain('Do NOT include a followUpQuestion key');
    });

    it('should NOT contain delimiter markers', () => {
      const probePrompt = builder.buildDiscussSystemPrompt(manifest, stepDef, null, 'probeReply');
      const followUpPrompt = builder.buildDiscussSystemPrompt(manifest, stepDef, null, 'followUpReply');

      expect(probePrompt).not.toContain('---REPLY---');
      expect(probePrompt).not.toContain('---FOLLOWUP---');
      expect(probePrompt).not.toContain('---QUALITY---');
      expect(followUpPrompt).not.toContain('---REPLY---');
      expect(followUpPrompt).not.toContain('---FOLLOWUP---');
      expect(followUpPrompt).not.toContain('---QUALITY---');
    });

    it('should include quality judgment rules in L8', () => {
      const prompt = builder.buildDiscussSystemPrompt(manifest, stepDef, null, 'probeReply');

      expect(prompt).toContain('genuine engagement');
      expect(prompt).toContain('minimal');
      expect(prompt).toContain('When in doubt, give "pass"');
    });

    it('should include depth judgment rubric in L8', () => {
      const prompt = builder.buildDiscussSystemPrompt(manifest, stepDef, null, 'probeReply');

      expect(prompt).toContain('"surface"');
      expect(prompt).toContain('"partial"');
      expect(prompt).toContain('"deep"');
    });

    it('should include L4.5 prior observations when provided', () => {
      const prompt = builder.buildDiscussSystemPrompt(
        manifest, stepDef, null, 'probeReply',
        '- Student identified contrast in ¶1-2',
      );

      expect(prompt).toContain('L4.5');
      expect(prompt).toContain('Student identified contrast');
    });

    it('should not include L4.5 when no observations', () => {
      const prompt = builder.buildDiscussSystemPrompt(manifest, stepDef, null, 'probeReply', null);

      expect(prompt).not.toContain('L4.5');
    });
  });

  // ── Fallback prompt: JSON format ──

  describe('buildDiscussFallbackPrompt', () => {
    it('should include JSON format for probeReply', () => {
      const prompt = builder.buildDiscussFallbackPrompt('probeReply');

      expect(prompt).toContain('JSON');
      expect(prompt).toContain('"reply"');
      expect(prompt).toContain('"followUpQuestion"');
      expect(prompt).toContain('"depth"');
      expect(prompt).not.toContain('---REPLY---');
      expect(prompt).not.toContain('---FOLLOWUP---');
    });

    it('should include JSON format for followUpReply without followUpQuestion', () => {
      const prompt = builder.buildDiscussFallbackPrompt('followUpReply');

      expect(prompt).toContain('JSON');
      expect(prompt).toContain('"reply"');
      expect(prompt).toContain('"depth"');
      expect(prompt).not.toContain('"followUpQuestion"');
    });
  });

  // ── buildPersonalTouchPrompt ──

  describe('buildPersonalTouchPrompt', () => {
    it('should produce system and user strings with strategy data', () => {
      const strategies = [
        { task: 1, strategy: 'Predicting', score: 100, attempts: 1 },
        { task: 2, strategy: 'Skimming', score: 80, attempts: 2 },
        { task: 3, strategy: 'Scanning', score: 60, attempts: 3 },
        { task: 4, strategy: 'Evaluating', score: 75, attempts: 1 },
      ];

      const { system, user } = builder.buildPersonalTouchPrompt(strategies);

      expect(system).toContain('个性化反馈');
      expect(system).toContain('不超过 150 字');
      expect(user).toContain('Task 1 - Predicting: 得分 100%');
      expect(user).toContain('Task 3 - Scanning: 得分 60%');
      expect(user).toContain('尝试 3 次');
    });

    it('should handle empty strategies array', () => {
      const { system, user } = builder.buildPersonalTouchPrompt([]);

      expect(system).toBeTruthy();
      expect(user).toContain('个性化反馈');
    });

    it('should include encouragement instructions in system prompt', () => {
      const { system } = builder.buildPersonalTouchPrompt([
        { task: 1, strategy: 'Predicting', score: 50, attempts: 4 },
      ]);

      expect(system).toContain('鼓励语气');
      expect(system).toContain('先肯定优点');
    });
  });

  // ── parseOrRepairDiscussResponse (async with LLM repair) ──

  describe('parseOrRepairDiscussResponse', () => {
    it('should return sync result when JSON is valid (no repair needed)', async () => {
      const raw = JSON.stringify({ reply: 'Good.', followUpQuestion: 'More?', quality: 'pass' });

      const result = await builder.parseOrRepairDiscussResponse(raw, 'probeReply');

      expect(result.reply).toBe('Good.');
      expect(result.followUpQuestion).toBe('More?');
      expect(result.quality).toBe('pass');
    });

    it('should return sync result for code-fenced JSON (no repair needed)', async () => {
      const inner = JSON.stringify({ reply: 'Nice.', quality: 'retry' });
      const raw = '```json\n' + inner + '\n```';

      const result = await builder.parseOrRepairDiscussResponse(raw, 'followUpReply');

      expect(result.reply).toBe('Nice.');
      expect(result.quality).toBe('retry');
    });

    it('should call LLM to repair when JSON is broken, then parse repaired output', async () => {
      const brokenRaw = 'Here is my reply: great job! Quality: pass';
      const repairedJson = JSON.stringify({ reply: 'great job!', followUpQuestion: 'What else?', quality: 'pass' });

      jest.spyOn(builder, 'callGlm').mockResolvedValueOnce(repairedJson);

      const result = await builder.parseOrRepairDiscussResponse(brokenRaw, 'probeReply');

      expect(builder.callGlm).toHaveBeenCalledTimes(1);
      expect(result.reply).toBe('great job!');
      expect(result.followUpQuestion).toBe('What else?');
      expect(result.quality).toBe('pass');
    });

    it('should fall back to raw text when LLM repair also fails', async () => {
      const brokenRaw = 'Some broken output';

      jest.spyOn(builder, 'callGlm').mockRejectedValueOnce(new Error('API down'));

      const result = await builder.parseOrRepairDiscussResponse(brokenRaw, 'probeReply');

      expect(result.reply).toBe('Some broken output');
      expect(result.quality).toBe('pass');
    });

    it('should fall back to raw text when LLM repair returns non-JSON', async () => {
      const brokenRaw = 'Totally garbled';

      jest.spyOn(builder, 'callGlm').mockResolvedValueOnce('Still not JSON');

      const result = await builder.parseOrRepairDiscussResponse(brokenRaw, 'probeReply');

      // parseDiscussResponse on "Still not JSON" → raw fallback
      expect(result.reply).toBe('Still not JSON');
      expect(result.quality).toBe('pass');
    });

    it('should pass temperature=0 and json_object mode to repair call', async () => {
      const brokenRaw = 'not json';
      const spy = jest.spyOn(builder, 'callGlm').mockResolvedValueOnce(
        JSON.stringify({ reply: 'fixed', quality: 'pass' }),
      );

      await builder.parseOrRepairDiscussResponse(brokenRaw, 'followUpReply');

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('Convert the following text into valid JSON'),
        brokenRaw,
        expect.objectContaining({
          temperature: 0,
          responseFormat: { type: 'json_object' },
        }),
      );
    });
  });
});
