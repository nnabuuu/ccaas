import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiAskService } from '../../application/ai/ai-ask.service';
import { AiPromptBuilder } from '../../application/ai/ai-prompt-builder';
import { ManifestCacheService } from '../../application/classroom/manifest-cache.service';
import { StateCacheService } from '../state-cache.service';
import { Student } from '../../entities/student.entity';
import { Submission } from '../../entities/submission.entity';
import { ClassroomSession } from '../../entities/classroom-session.entity';
import { AiQuestion } from '../../entities/ai-question.entity';
import { ChatMessage } from '../../entities/chat-message.entity';
import { ClassroomSnapshot } from '../../entities/classroom-snapshot.entity';
import { Lesson } from '../../entities/lesson.entity';
import { OBSERVER_ENGINE } from '@kedge-agentic/observer-engine';

const ASK_MANIFEST = {
  id: 'ask-lesson',
  title: 'Ask Lesson',
  article: { title: 'Test Article', paragraphs: [{ id: 'p1', text: 'Paragraph one.' }] },
  readingSteps: [{
    idx: 1, label: 'Quiz Step', strategy: 'quiz',
    answerKey: {
      type: 'quiz',
      answers: [{ questionIdx: 0, correct: 1, questionText: 'Q1', options: ['A', 'B'] }],
    },
    discuss: {
      fallbackMC: { explanation: 'The answer is B because of reason X.' },
      insight: 'Key insight about the topic.',
    },
  }],
};

const mockObserverEngine = {
  dispatch: jest.fn().mockResolvedValue(undefined),
  setSessionMeta: jest.fn(),
  clearSessionMeta: jest.fn(),
  register: jest.fn(),
};

describe('AiAskService', () => {
  let module: TestingModule;
  let service: AiAskService;
  let studentRepo: Repository<Student>;
  let lessonRepo: Repository<Lesson>;
  let sessionRepo: Repository<ClassroomSession>;
  let aiQuestionRepo: Repository<AiQuestion>;
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
        AiAskService, AiPromptBuilder, ManifestCacheService, StateCacheService,
        { provide: OBSERVER_ENGINE, useValue: mockObserverEngine },
      ],
    }).compile();

    service = module.get(AiAskService);
    studentRepo = module.get(getRepositoryToken(Student));
    lessonRepo = module.get(getRepositoryToken(Lesson));
    sessionRepo = module.get(getRepositoryToken(ClassroomSession));
    aiQuestionRepo = module.get(getRepositoryToken(AiQuestion));
    aiPromptBuilder = module.get(AiPromptBuilder);

    await lessonRepo.save(lessonRepo.create({
      id: 'ask-lesson', title: 'Ask Lesson', subject: 'English', gradeLevel: '7',
      manifestJson: JSON.stringify(ASK_MANIFEST),
    }));
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    mockObserverEngine.dispatch.mockClear();
  });

  let chatMessageRepo: Repository<ChatMessage>;

  beforeAll(async () => {
    chatMessageRepo = module.get(getRepositoryToken(ChatMessage));
  });

  async function createSessionAndStudent() {
    const session = await sessionRepo.save(sessionRepo.create({
      lessonId: 'ask-lesson', code: Math.random().toString(36).slice(2, 8).toUpperCase(),
      status: 'active', currentStep: 0,
    }));
    const student = await studentRepo.save(studentRepo.create({
      sessionId: session.id, lessonId: session.lessonId,
      name: `Bob-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      currentTask: 1, currentPhase: 'practice',
    }));
    return { session, student };
  }

  describe('aiAsk', () => {
    it('returns parsed answer + category, saves AiQuestion', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlm').mockResolvedValue('【理解】The answer is B because...');
      jest.spyOn(aiPromptBuilder, 'parseCategoryFromResponse').mockReturnValue({
        answer: 'The answer is B because...',
        category: '理解',
      });

      const result = await service.aiAsk(session, student.id, 1, 'What is the answer?');

      expect(result.answer).toBe('The answer is B because...');
      expect(result.category).toBe('理解');

      const saved = await aiQuestionRepo.findOne({
        where: { sessionId: session.id, studentId: student.id },
      });
      expect(saved).not.toBeNull();
      expect(saved!.question).toBe('What is the answer?');
      expect(saved!.category).toBe('理解');
    });

    it('returns fallback answer on LLM failure', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlm').mockRejectedValue(new Error('API error'));
      jest.spyOn(aiPromptBuilder, 'parseCategoryFromResponse').mockReturnValue({
        answer: 'AI 助教暂时无法回答，请稍后再试。',
        category: '其他',
      });

      const result = await service.aiAsk(session, student.id, 1, 'Hello');

      expect(result.answer).toContain('无法回答');
    });

    it('dispatches chat_turn observation event', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlm').mockResolvedValue('【其他】reply');
      jest.spyOn(aiPromptBuilder, 'parseCategoryFromResponse').mockReturnValue({
        answer: 'reply', category: '其他',
      });

      await service.aiAsk(session, student.id, 1, 'test question');

      expect(mockObserverEngine.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'chat_turn', sessionId: session.id }),
      );
    });

    it('dispatches chat_turn event with correct payload', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlm').mockResolvedValue('【理解】answer');
      jest.spyOn(aiPromptBuilder, 'parseCategoryFromResponse').mockReturnValue({
        answer: 'answer', category: '理解',
      });

      await service.aiAsk(session, student.id, 1, 'Why?');

      expect(mockObserverEngine.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'chat_turn',
          sessionId: session.id,
          entityId: student.id,
          payload: expect.objectContaining({ student: 'Why?', ai: 'answer' }),
        }),
      );
    });

    it('throws NotFoundException for unknown student', async () => {
      const { session } = await createSessionAndStudent();
      await expect(
        service.aiAsk(session, 'nonexistent', 1, 'hello'),
      ).rejects.toThrow(NotFoundException);
    });

    it('uses callLlmConversation when messages are provided (multi-turn)', async () => {
      const { session, student } = await createSessionAndStudent();
      const convSpy = jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue('答案是 B，因为文中提到...');
      jest.spyOn(aiPromptBuilder, 'parseCategoryFromResponse').mockReturnValue({
        answer: '答案是 B，因为文中提到...',
        category: '其他',
      });

      const messages = [
        { role: 'student', text: 'Why is the answer B?' },
        { role: 'ai', text: 'Because the article says...' },
        { role: 'student', text: 'Can you explain more?' },
      ];

      const result = await service.aiAsk(session, student.id, 1, 'Can you explain more?', messages);

      expect(result.answer).toBe('答案是 B，因为文中提到...');
      expect(convSpy).toHaveBeenCalledWith(
        expect.stringContaining('延伸讨论'),
        expect.arrayContaining([
          { role: 'user', content: 'Why is the answer B?' },
          { role: 'assistant', content: 'Because the article says...' },
          { role: 'user', content: 'Can you explain more?' },
        ]),
      );
    });

    it('falls back to callLlm when messages is empty', async () => {
      const { session, student } = await createSessionAndStudent();
      const glmSpy = jest.spyOn(aiPromptBuilder, 'callLlm').mockResolvedValue('【理解】single-turn reply');
      jest.spyOn(aiPromptBuilder, 'parseCategoryFromResponse').mockReturnValue({
        answer: 'single-turn reply', category: '理解',
      });

      await service.aiAsk(session, student.id, 1, 'Hello?', []);

      expect(glmSpy).toHaveBeenCalled();
    });

    it('persists ChatMessages only when messages are provided (multi-turn)', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue('多轮回复');
      jest.spyOn(aiPromptBuilder, 'parseCategoryFromResponse').mockReturnValue({
        answer: '多轮回复', category: '其他',
      });

      const messages = [
        { role: 'student', text: 'First question' },
        { role: 'ai', text: 'First reply' },
        { role: 'student', text: 'Second question' },
      ];

      await service.aiAsk(session, student.id, 1, 'Second question', messages);

      const saved = await chatMessageRepo.find({
        where: { sessionId: session.id, studentId: student.id, threadId: 'continue:1' },
        order: { seq: 'ASC' },
      });
      expect(saved).toHaveLength(2);
      expect(saved[0].role).toBe('student');
      expect(saved[0].content).toBe('Second question');
      expect(saved[1].role).toBe('ai');
      expect(saved[1].content).toBe('多轮回复');
    });

    it('does NOT persist ChatMessages for single-turn (no messages)', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlm').mockResolvedValue('【其他】single reply');
      jest.spyOn(aiPromptBuilder, 'parseCategoryFromResponse').mockReturnValue({
        answer: 'single reply', category: '其他',
      });

      await service.aiAsk(session, student.id, 1, 'solo question');

      const saved = await chatMessageRepo.find({
        where: { sessionId: session.id, studentId: student.id, threadId: 'continue:1' },
      });
      expect(saved).toHaveLength(0);
    });

    it('returns fallback on callLlmConversation failure (multi-turn)', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockRejectedValue(new Error('timeout'));

      const result = await service.aiAsk(
        session, student.id, 1, 'test',
        [{ role: 'student', text: 'test' }],
      );

      expect(result.answer).toContain('无法回答');
      expect(result.category).toBe('其他');
    });

    it('maps role correctly: student→user, ai→assistant', async () => {
      const { session, student } = await createSessionAndStudent();
      const convSpy = jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue('ok');
      jest.spyOn(aiPromptBuilder, 'parseCategoryFromResponse').mockReturnValue({
        answer: 'ok', category: '其他',
      });

      await service.aiAsk(session, student.id, 1, 'q', [
        { role: 'student', text: 'hello' },
        { role: 'ai', text: 'hi' },
      ]);

      const llmMessages = convSpy.mock.calls[0][1];
      expect(llmMessages[0]).toEqual({ role: 'user', content: 'hello' });
      expect(llmMessages[1]).toEqual({ role: 'assistant', content: 'hi' });
    });

    it('fires continue_chat_turn system event for multi-turn', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue('reply');
      jest.spyOn(aiPromptBuilder, 'parseCategoryFromResponse').mockReturnValue({
        answer: 'reply', category: '其他',
      });

      await service.aiAsk(session, student.id, 1, 'follow-up', [
        { role: 'student', text: 'follow-up' },
      ]);

      expect(mockObserverEngine.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'continue_chat_turn',
          sessionId: session.id,
          entityId: student.id,
          payload: expect.objectContaining({ step: 1, messageCount: 1 }),
        }),
      );
    });

    it('does NOT fire continue_chat_turn for single-turn (no messages)', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlm').mockResolvedValue('【其他】reply');
      jest.spyOn(aiPromptBuilder, 'parseCategoryFromResponse').mockReturnValue({
        answer: 'reply', category: '其他',
      });

      await service.aiAsk(session, student.id, 1, 'solo question');

      expect(mockObserverEngine.dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'continue_chat_turn' }),
      );
    });

    it('uses continue-chat prompt (not ask prompt) for multi-turn', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue('reply');
      jest.spyOn(aiPromptBuilder, 'parseCategoryFromResponse').mockReturnValue({
        answer: 'reply', category: '其他',
      });

      await service.aiAsk(session, student.id, 1, 'q', [
        { role: 'student', text: 'hi' },
      ]);

      const systemPrompt = jest.mocked(aiPromptBuilder.callLlmConversation).mock.calls[0][0];
      expect(systemPrompt).toContain('延伸讨论');
      expect(systemPrompt).not.toContain('严禁直接告诉学生');
      expect(systemPrompt).toContain('正确答案');
    });

    it('increments seq correctly across multiple multi-turn calls', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue('reply');
      jest.spyOn(aiPromptBuilder, 'parseCategoryFromResponse').mockReturnValue({
        answer: 'reply', category: '其他',
      });

      // First round
      await service.aiAsk(session, student.id, 1, 'q1', [
        { role: 'student', text: 'q1' },
      ]);
      // Second round
      await service.aiAsk(session, student.id, 1, 'q2', [
        { role: 'student', text: 'q1' },
        { role: 'ai', text: 'reply' },
        { role: 'student', text: 'q2' },
      ]);

      const saved = await chatMessageRepo.find({
        where: { sessionId: session.id, studentId: student.id, threadId: 'continue:1' },
        order: { seq: 'ASC' },
      });
      expect(saved).toHaveLength(4);
      expect(saved.map(m => m.seq)).toEqual([0, 1, 2, 3]);
      expect(saved.map(m => m.role)).toEqual(['student', 'ai', 'student', 'ai']);
    });
  });
});
