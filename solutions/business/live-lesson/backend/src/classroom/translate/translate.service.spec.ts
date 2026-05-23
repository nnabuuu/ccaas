import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TranslateService, TranslateResponse } from '../../application/ai/translate.service';
import { AiPromptBuilder } from '../../application/ai/ai-prompt-builder';
import { ManifestCacheService } from '../../application/classroom/manifest-cache.service';
import { Student } from '../../entities/student.entity';
import { Submission } from '../../entities/submission.entity';
import { ClassroomSession } from '../../entities/classroom-session.entity';
import { AiQuestion } from '../../entities/ai-question.entity';
import { ChatMessage } from '../../entities/chat-message.entity';
import { ClassroomSnapshot } from '../../entities/classroom-snapshot.entity';
import { Lesson } from '../../entities/lesson.entity';
import { OBSERVER_ENGINE } from '@kedge-agentic/observer-engine';

const TRANSLATE_MANIFEST = {
  id: 'translate-lesson',
  title: 'Translate Lesson',
  article: {
    title: 'Ideal Beauty',
    paragraphs: [
      { id: 'p1', text: 'Symmetry is a key concept in mathematics.' },
      { id: 'p2', text: 'Beauty can be found in patterns and proportions.' },
    ],
  },
  readingSteps: [
    { idx: 1, label: 'Reading Step', strategy: 'skim', focusParagraphs: [1, 2] },
    { idx: 2, label: 'Quiz Step', strategy: 'quiz' },
  ],
};

const mockObserverEngine = {
  dispatch: jest.fn().mockResolvedValue(undefined),
  setSessionMeta: jest.fn(),
  clearSessionMeta: jest.fn(),
  register: jest.fn(),
};

describe('TranslateService', () => {
  let module: TestingModule;
  let service: TranslateService;
  let studentRepo: Repository<Student>;
  let lessonRepo: Repository<Lesson>;
  let sessionRepo: Repository<ClassroomSession>;
  let chatMessageRepo: Repository<ChatMessage>;
  let aiPromptBuilder: AiPromptBuilder;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Lesson, Student, Submission, ClassroomSession, AiQuestion, ChatMessage, ClassroomSnapshot],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([Lesson, Student, Submission, ClassroomSession, AiQuestion, ChatMessage, ClassroomSnapshot]),
      ],
      providers: [
        TranslateService, AiPromptBuilder, ManifestCacheService,
        { provide: OBSERVER_ENGINE, useValue: mockObserverEngine },
      ],
    }).compile();

    service = module.get(TranslateService);
    studentRepo = module.get(getRepositoryToken(Student));
    lessonRepo = module.get(getRepositoryToken(Lesson));
    sessionRepo = module.get(getRepositoryToken(ClassroomSession));
    chatMessageRepo = module.get(getRepositoryToken(ChatMessage));
    aiPromptBuilder = module.get(AiPromptBuilder);

    await lessonRepo.save(lessonRepo.create({
      id: 'translate-lesson', title: 'Translate Lesson', subject: 'English', gradeLevel: '7',
      manifestJson: JSON.stringify(TRANSLATE_MANIFEST),
    }));
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    mockObserverEngine.dispatch.mockClear();
  });

  async function createSessionAndStudent(lessonId = 'translate-lesson') {
    const session = await sessionRepo.save(sessionRepo.create({
      lessonId,
      code: Math.random().toString(36).slice(2, 8).toUpperCase(),
      status: 'active',
      currentStep: 0,
    }));
    const student = await studentRepo.save(studentRepo.create({
      sessionId: session.id,
      lessonId,
      name: `Student-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      currentTask: 1,
      currentPhase: 'reading',
    }));
    return { session, student };
  }

  // ── parseTranslateResponse (tested indirectly via translate()) ──

  describe('translate() — response parsing', () => {
    it('parses valid JSON response', async () => {
      const { session, student } = await createSessionAndStudent();
      const llmJson = JSON.stringify({
        definition: '对称',
        contextAnalysis: '对称是数学中的核心概念',
        suggestedQuestions: ['对称有哪些类型？', '对称在自然界中如何体现？'],
      });
      jest.spyOn(aiPromptBuilder, 'callLlm').mockResolvedValue(llmJson);

      const result = await service.translate(session, student.id, 'symmetry', 1, 'text-panel');
      expect(result.definition).toBe('对称');
      expect(result.contextAnalysis).toBe('对称是数学中的核心概念');
      expect(result.suggestedQuestions).toEqual(['对称有哪些类型？', '对称在自然界中如何体现？']);
    });

    it('parses code-fenced JSON', async () => {
      const { session, student } = await createSessionAndStudent();
      const fenced = '```json\n{"definition":"比例","contextAnalysis":"分析","suggestedQuestions":["Q1"]}\n```';
      jest.spyOn(aiPromptBuilder, 'callLlm').mockResolvedValue(fenced);

      const result = await service.translate(session, student.id, 'proportion', 1, 'text-panel');
      expect(result.definition).toBe('比例');
      expect(result.suggestedQuestions).toEqual(['Q1']);
    });

    it('falls back to raw text when JSON is malformed', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlm').mockResolvedValue('这是一段非JSON文本');

      const result = await service.translate(session, student.id, 'beauty', 1, 'text-panel');
      expect(result.definition).toBe('这是一段非JSON文本');
      expect(result.contextAnalysis).toBe('');
      expect(result.suggestedQuestions).toEqual([]);
    });

    it('handles partial JSON — missing fields get defaults', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlm').mockResolvedValue('{"definition":"美"}');

      const result = await service.translate(session, student.id, 'beauty', 1, 'text-panel');
      expect(result.definition).toBe('美');
      expect(result.contextAnalysis).toBe('');
      expect(result.suggestedQuestions).toEqual([]);
    });

    it('repairs truncated JSON via jsonrepair (mid-string)', async () => {
      const { session, student } = await createSessionAndStudent();
      // Simulate LLM hitting token limit mid-question string
      const truncated = '{"definition":"被...轰炸；充斥着","contextAnalysis":"在杂志和媒体中","suggestedQuestions":["Q1完整","Q2完整","你认为';
      jest.spyOn(aiPromptBuilder, 'callLlm').mockResolvedValue(truncated);

      const result = await service.translate(session, student.id, 'bombarded', 1, 'text-panel');
      expect(result.definition).toBe('被...轰炸；充斥着');
      expect(result.contextAnalysis).toBe('在杂志和媒体中');
      expect(result.suggestedQuestions).toContain('Q1完整');
      expect(result.suggestedQuestions).toContain('Q2完整');
      // The truncated third question should be recovered (partial content)
      expect(result.suggestedQuestions.length).toBeGreaterThanOrEqual(2);
    });

    it('repairs truncated JSON via jsonrepair (mid-array)', async () => {
      const { session, student } = await createSessionAndStudent();
      // Truncated right after second question, before closing bracket
      const truncated = '{"definition":"测试","contextAnalysis":"分析","suggestedQuestions":["问题一","问题二"';
      jest.spyOn(aiPromptBuilder, 'callLlm').mockResolvedValue(truncated);

      const result = await service.translate(session, student.id, 'test', 1, 'text-panel');
      expect(result.definition).toBe('测试');
      expect(result.suggestedQuestions).toEqual(['问题一', '问题二']);
    });

    it('filters non-string items in suggestedQuestions', async () => {
      const { session, student } = await createSessionAndStudent();
      const json = JSON.stringify({
        definition: '测试',
        contextAnalysis: '分析',
        suggestedQuestions: ['有效问题', 123, null, '另一个问题'],
      });
      jest.spyOn(aiPromptBuilder, 'callLlm').mockResolvedValue(json);

      const result = await service.translate(session, student.id, 'test', 1, 'text-panel');
      expect(result.suggestedQuestions).toEqual(['有效问题', '另一个问题']);
    });
  });

  // ── Cache behavior ──

  describe('translate() — caching', () => {
    it('returns cached result on second call with same text', async () => {
      const { session, student } = await createSessionAndStudent();
      const spy = jest.spyOn(aiPromptBuilder, 'callLlm').mockResolvedValue(
        JSON.stringify({ definition: '模式', contextAnalysis: '分析', suggestedQuestions: [] }),
      );

      const r1 = await service.translate(session, student.id, 'pattern', 1, 'text-panel');
      const r2 = await service.translate(session, student.id, 'pattern', 1, 'text-panel');

      expect(spy).toHaveBeenCalledTimes(1);
      expect(r1).toEqual(r2);
    });

    it('normalizes text for cache key (trim + lowercase)', async () => {
      const { session, student } = await createSessionAndStudent();
      const spy = jest.spyOn(aiPromptBuilder, 'callLlm').mockResolvedValue(
        JSON.stringify({ definition: '你好', contextAnalysis: '', suggestedQuestions: [] }),
      );

      await service.translate(session, student.id, '  Hello  ', 1, 'text-panel');
      await service.translate(session, student.id, 'hello', 1, 'text-panel');

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('clearSession removes cache for that session', async () => {
      const { session, student } = await createSessionAndStudent();
      const spy = jest.spyOn(aiPromptBuilder, 'callLlm').mockResolvedValue(
        JSON.stringify({ definition: '词', contextAnalysis: '', suggestedQuestions: [] }),
      );

      await service.translate(session, student.id, 'word', 1, 'text-panel');
      service.clearSession(session.id);
      await service.translate(session, student.id, 'word', 1, 'text-panel');

      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  // ── Student validation ──

  describe('translate() — student validation', () => {
    it('throws NotFoundException for non-existent student', async () => {
      const { session } = await createSessionAndStudent();
      await expect(
        service.translate(session, '00000000-0000-0000-0000-000000000000', 'hello', 1, 'text-panel'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Manifest-aware prompts ──

  describe('translate() — manifest integration', () => {
    it('uses buildTranslatePrompt when manifest is available', async () => {
      const { session, student } = await createSessionAndStudent();
      const promptSpy = jest.spyOn(aiPromptBuilder, 'buildTranslatePrompt').mockReturnValue('system prompt');
      jest.spyOn(aiPromptBuilder, 'callLlm').mockResolvedValue(
        JSON.stringify({ definition: '对称', contextAnalysis: '分析', suggestedQuestions: [] }),
      );

      await service.translate(session, student.id, 'symmetry', 1, 'text-panel');

      expect(promptSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'translate-lesson' }),
        expect.objectContaining({ idx: 1 }),
      );
    });

    it('includes sourceContext in user message', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'buildTranslatePrompt').mockReturnValue('system');
      const callSpy = jest.spyOn(aiPromptBuilder, 'callLlm').mockResolvedValue(
        JSON.stringify({ definition: '测试', contextAnalysis: '', suggestedQuestions: [] }),
      );

      await service.translate(session, student.id, 'test word', 1, 'task-panel');

      const userMsg = callSpy.mock.calls[0][1];
      expect(userMsg).toContain('任务面板');
      expect(userMsg).toContain('Task 1');
      expect(userMsg).toContain('test word');
    });

    it('uses fallback prompt when manifest is unavailable', async () => {
      const session = await sessionRepo.save(sessionRepo.create({
        lessonId: 'nonexistent-lesson',
        code: Math.random().toString(36).slice(2, 8).toUpperCase(),
        status: 'active',
        currentStep: 0,
      }));
      const student = await studentRepo.save(studentRepo.create({
        sessionId: session.id,
        lessonId: 'nonexistent-lesson',
        name: `NoManifest-${Date.now()}`,
        currentTask: 1,
        currentPhase: 'reading',
      }));
      const promptSpy = jest.spyOn(aiPromptBuilder, 'buildTranslatePrompt');
      jest.spyOn(aiPromptBuilder, 'callLlm').mockResolvedValue(
        JSON.stringify({ definition: '词', contextAnalysis: '', suggestedQuestions: [] }),
      );

      await service.translate(session, student.id, 'word', 1, 'text-panel');

      expect(promptSpy).not.toHaveBeenCalled();
    });
  });

  // ── LLM error handling ──

  describe('translate() — error handling', () => {
    it('returns graceful fallback when LLM fails', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlm').mockRejectedValue(new Error('API timeout'));

      const result = await service.translate(session, student.id, 'hello', 1, 'text-panel');
      expect(result.definition).toBe('翻译服务暂时不可用，请稍后再试。');
      expect(result.contextAnalysis).toBe('');
      expect(result.suggestedQuestions).toEqual([]);
    });

    it('does not cache LLM error fallback', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlm')
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(JSON.stringify({ definition: '成功', contextAnalysis: '', suggestedQuestions: [] }));

      const r1 = await service.translate(session, student.id, 'retry-word', 1, 'text-panel');
      expect(r1.definition).toContain('不可用');

      const r2 = await service.translate(session, student.id, 'retry-word', 1, 'text-panel');
      expect(r2.definition).toBe('成功');
    });
  });

  // ── Observer dispatch ──

  describe('translate() — observer', () => {
    it('dispatches translate_request event with correct payload', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlm').mockResolvedValue(
        JSON.stringify({ definition: '词', contextAnalysis: '', suggestedQuestions: [] }),
      );

      await service.translate(session, student.id, 'hello', 1, 'text-panel', 'exercise');

      expect(mockObserverEngine.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'translate_request',
          sessionId: session.id,
          entityId: student.id,
          payload: expect.objectContaining({
            step: 1,
            sourceContext: 'text-panel',
            phase: 'exercise',
            text: 'hello',
            definition: '词',
            contextAnalysis: '',
          }),
        }),
      );
    });

    it('does not dispatch observer event when LLM fails', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlm').mockRejectedValue(new Error('fail'));

      await service.translate(session, student.id, 'fail-word', 1, 'text-panel');

      expect(mockObserverEngine.dispatch).not.toHaveBeenCalled();
    });
  });

  // ── translateChat ──

  describe('translateChat()', () => {
    it('throws NotFoundException for non-existent student', async () => {
      const { session } = await createSessionAndStudent();
      await expect(
        service.translateChat(session, '00000000-0000-0000-0000-000000000000', 1, 'word', 'question', 'text-panel'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns reply from LLM', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue('这个词表示对称性。');

      const result = await service.translateChat(session, student.id, 1, 'symmetry', '什么意思？', 'text-panel');
      expect(result.reply).toBe('这个词表示对称性。');
    });

    it('returns graceful fallback when LLM fails', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockRejectedValue(new Error('timeout'));

      const result = await service.translateChat(session, student.id, 1, 'word', 'question', 'text-panel');
      expect(result.reply).toBe('AI 助教暂时无法回答，请稍后再试。');
    });

    it('persists messages with role student/ai', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue('AI reply');

      await service.translateChat(session, student.id, 1, 'hello', '这个词什么意思？', 'text-panel');

      const saved = await chatMessageRepo.find({
        where: { sessionId: session.id, studentId: student.id },
        order: { seq: 'ASC' },
      });
      expect(saved).toHaveLength(2);
      expect(saved[0].role).toBe('student');
      expect(saved[0].content).toBe('这个词什么意思？');
      expect(saved[1].role).toBe('ai');
      expect(saved[1].content).toBe('AI reply');
    });

    it('does not persist messages when LLM fails', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockRejectedValue(new Error('fail'));

      await service.translateChat(session, student.id, 1, 'fail-chat', 'q', 'text-panel');

      const saved = await chatMessageRepo.find({
        where: { sessionId: session.id, studentId: student.id },
      });
      // Should have no messages for this specific thread
      const threadMessages = saved.filter(m => m.threadId.startsWith('translate:1:'));
      expect(threadMessages).toHaveLength(0);
    });

    it('maps history roles correctly: student→user, ai→assistant', async () => {
      const { session, student } = await createSessionAndStudent();
      const convSpy = jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue('second reply');

      // First turn
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValueOnce('first reply');
      await service.translateChat(session, student.id, 1, 'word', 'first question', 'text-panel');

      // Second turn — should include history
      convSpy.mockResolvedValueOnce('second reply');
      await service.translateChat(session, student.id, 1, 'word', 'follow up', 'text-panel');

      const lastCall = convSpy.mock.calls[convSpy.mock.calls.length - 1];
      const messages = lastCall[1] as Array<{ role: string; content: string }>;

      // History: student→user, ai→assistant; then new question as user
      expect(messages[0]).toEqual({ role: 'user', content: 'first question' });
      expect(messages[1]).toEqual({ role: 'assistant', content: 'first reply' });
      expect(messages[messages.length - 1]).toEqual({ role: 'user', content: 'follow up' });
    });

    it('generates deterministic threadId from step + text hash', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue('reply');

      await service.translateChat(session, student.id, 1, 'symmetry', 'q1', 'text-panel');
      await service.translateChat(session, student.id, 1, 'symmetry', 'q2', 'text-panel');

      const saved = await chatMessageRepo.find({
        where: { sessionId: session.id, studentId: student.id },
        order: { seq: 'ASC' },
      });
      const threadIds = [...new Set(saved.map(m => m.threadId))];
      // Same word → same thread
      expect(threadIds.filter(t => t.startsWith('translate:1:'))).toHaveLength(1);
    });

    it('increments seq correctly across multiple turns', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue('reply');

      await service.translateChat(session, student.id, 2, 'beauty', 'q1', 'text-panel');
      await service.translateChat(session, student.id, 2, 'beauty', 'q2', 'text-panel');

      const saved = await chatMessageRepo.find({
        where: { sessionId: session.id, studentId: student.id },
        order: { seq: 'ASC' },
      });
      const threadMessages = saved.filter(m => m.threadId.startsWith('translate:2:'));
      expect(threadMessages.map(m => m.seq)).toEqual([0, 1, 2, 3]);
    });

    it('dispatches translate_chat_turn event', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue('reply');

      await service.translateChat(session, student.id, 1, 'word', 'question', 'task-panel');

      expect(mockObserverEngine.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'translate_chat_turn',
          sessionId: session.id,
          entityId: student.id,
          payload: expect.objectContaining({
            step: 1,
            sourceContext: 'task-panel',
            questionLength: 8,
          }),
        }),
      );
    });

    it('uses cached definition in chat system prompt', async () => {
      const { session, student } = await createSessionAndStudent();

      // Pre-populate cache via translate()
      jest.spyOn(aiPromptBuilder, 'callLlm').mockResolvedValue(
        JSON.stringify({ definition: '对称', contextAnalysis: '分析', suggestedQuestions: [] }),
      );
      await service.translate(session, student.id, 'symmetry', 1, 'text-panel');

      // Now call translateChat — should use cached definition
      const chatPromptSpy = jest.spyOn(aiPromptBuilder, 'buildTranslateChatPrompt').mockReturnValue('chat prompt');
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue('reply');

      await service.translateChat(session, student.id, 1, 'symmetry', 'explain more', 'text-panel');

      expect(chatPromptSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'symmetry',
        '对称', // cached definition, not raw text fallback
      );
    });

    it('falls back to originalText when no cached definition exists', async () => {
      const { session, student } = await createSessionAndStudent();
      const chatPromptSpy = jest.spyOn(aiPromptBuilder, 'buildTranslateChatPrompt').mockReturnValue('prompt');
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue('reply');

      await service.translateChat(session, student.id, 1, 'uncached-word', 'what?', 'text-panel');

      expect(chatPromptSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'uncached-word',
        'uncached-word', // falls back to originalText
      );
    });
  });
});
