import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiAskService } from './ai-ask.service';
import { ObservationService } from '../observation/observation.service';
import { AiPromptBuilder } from '../ai-prompt-builder';
import { Student } from '../../entities/student.entity';
import { Submission } from '../../entities/submission.entity';
import { ClassroomSession } from '../../entities/classroom-session.entity';
import { AiQuestion } from '../../entities/ai-question.entity';
import { ObservationEvent } from '../../entities/observation-event.entity';
import { Lesson } from '../../entities/lesson.entity';
import { OBSERVER_ENGINE } from '@kedge-agentic/observer-engine';

const ASK_MANIFEST = {
  id: 'ask-lesson',
  title: 'Ask Lesson',
  readingSteps: [{
    idx: 1, label: 'Quiz Step', strategy: 'quiz',
    answerKey: {
      type: 'quiz',
      answers: [{ questionIdx: 0, correct: 1, questionText: 'Q1', options: ['A', 'B'] }],
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
  let observationService: ObservationService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Lesson, Student, Submission, ClassroomSession, AiQuestion, ObservationEvent],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([Lesson, Student, Submission, ClassroomSession, AiQuestion, ObservationEvent]),
      ],
      providers: [
        AiAskService, ObservationService, AiPromptBuilder,
        { provide: OBSERVER_ENGINE, useValue: mockObserverEngine },
      ],
    }).compile();

    service = module.get(AiAskService);
    studentRepo = module.get(getRepositoryToken(Student));
    lessonRepo = module.get(getRepositoryToken(Lesson));
    sessionRepo = module.get(getRepositoryToken(ClassroomSession));
    aiQuestionRepo = module.get(getRepositoryToken(AiQuestion));
    aiPromptBuilder = module.get(AiPromptBuilder);
    observationService = module.get(ObservationService);

    await lessonRepo.save(lessonRepo.create({
      id: 'ask-lesson', title: 'Ask Lesson', subject: 'English', gradeLevel: '7',
      manifestJson: JSON.stringify(ASK_MANIFEST),
    }));
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
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
      jest.spyOn(aiPromptBuilder, 'callGlm').mockResolvedValue('【理解】The answer is B because...');
      jest.spyOn(aiPromptBuilder, 'parseCategoryFromResponse').mockReturnValue({
        answer: 'The answer is B because...',
        category: '理解',
      });
      jest.spyOn(observationService, 'observeTurn').mockResolvedValue(undefined);

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
      jest.spyOn(aiPromptBuilder, 'callGlm').mockRejectedValue(new Error('API error'));
      jest.spyOn(aiPromptBuilder, 'parseCategoryFromResponse').mockReturnValue({
        answer: 'AI 助教暂时无法回答，请稍后再试。',
        category: '其他',
      });
      jest.spyOn(observationService, 'observeTurn').mockResolvedValue(undefined);

      const result = await service.aiAsk(session, student.id, 1, 'Hello');

      expect(result.answer).toContain('无法回答');
    });

    it('dispatches chat_turn observation event', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callGlm').mockResolvedValue('【其他】reply');
      jest.spyOn(aiPromptBuilder, 'parseCategoryFromResponse').mockReturnValue({
        answer: 'reply', category: '其他',
      });
      jest.spyOn(observationService, 'observeTurn').mockResolvedValue(undefined);

      await service.aiAsk(session, student.id, 1, 'test question');

      expect(mockObserverEngine.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'chat_turn', sessionId: session.id }),
      );
    });

    it('calls observeTurn with correct step context', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callGlm').mockResolvedValue('【理解】answer');
      jest.spyOn(aiPromptBuilder, 'parseCategoryFromResponse').mockReturnValue({
        answer: 'answer', category: '理解',
      });
      const observeSpy = jest.spyOn(observationService, 'observeTurn').mockResolvedValue(undefined);

      await service.aiAsk(session, student.id, 1, 'Why?');

      expect(observeSpy).toHaveBeenCalledWith(
        session.id, student.id, student.name,
        { student: 'Why?', ai: 'answer' },
        expect.objectContaining({ currentStep: 'step-1' }),
      );
    });

    it('throws NotFoundException for unknown student', async () => {
      const { session } = await createSessionAndStudent();
      await expect(
        service.aiAsk(session, 'nonexistent', 1, 'hello'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
