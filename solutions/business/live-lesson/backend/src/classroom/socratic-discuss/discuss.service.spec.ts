import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DiscussService } from './discuss.service';
import { ObservationService } from '../observation/observation.service';
import { AiPromptBuilder } from '../ai-prompt-builder';
import { Student } from '../../entities/student.entity';
import { Submission } from '../../entities/submission.entity';
import { ClassroomSession } from '../../entities/classroom-session.entity';
import { AiQuestion } from '../../entities/ai-question.entity';
import { ChatMessage } from '../../entities/chat-message.entity';
import { ObservationEvent } from '../../entities/observation-event.entity';
import { ClassroomSnapshot } from '../../entities/classroom-snapshot.entity';
import { Lesson } from '../../entities/lesson.entity';
import { OBSERVER_ENGINE } from '@kedge-agentic/observer-engine';
import { ClusterClassifier } from './cluster-classifier';
import { ClusterAggregator } from './cluster-aggregator';

const DISCUSS_MANIFEST = {
  id: 'discuss-lesson',
  title: 'Discuss Lesson',
  readingSteps: [
    {
      idx: 1, label: 'Task 1', strategy: 'quiz', type: 'task',
      answerKey: { type: 'quiz', answers: [{ questionIdx: 0, correct: 1, questionText: 'Q1', options: ['A', 'B'] }] },
      discuss: { fallbackMC: { correctIndex: 2, options: ['A', 'B', 'C'] } },
    },
  ],
};

const mockObserverEngine = {
  dispatch: jest.fn().mockResolvedValue(undefined),
  setSessionMeta: jest.fn(),
  clearSessionMeta: jest.fn(),
  register: jest.fn(),
};

describe('DiscussService', () => {
  let module: TestingModule;
  let service: DiscussService;
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
          entities: [Lesson, Student, Submission, ClassroomSession, AiQuestion, ChatMessage, ObservationEvent, ClassroomSnapshot],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([Lesson, Student, Submission, ClassroomSession, AiQuestion, ChatMessage, ObservationEvent, ClassroomSnapshot]),
      ],
      providers: [
        DiscussService, ObservationService, AiPromptBuilder, ClusterClassifier, ClusterAggregator,
        { provide: OBSERVER_ENGINE, useValue: mockObserverEngine },
      ],
    }).compile();

    service = module.get(DiscussService);
    studentRepo = module.get(getRepositoryToken(Student));
    lessonRepo = module.get(getRepositoryToken(Lesson));
    sessionRepo = module.get(getRepositoryToken(ClassroomSession));
    aiQuestionRepo = module.get(getRepositoryToken(AiQuestion));
    aiPromptBuilder = module.get(AiPromptBuilder);
    observationService = module.get(ObservationService);

    await lessonRepo.save(lessonRepo.create({
      id: 'discuss-lesson', title: 'Discuss Lesson', subject: 'English', gradeLevel: '7',
      manifestJson: JSON.stringify(DISCUSS_MANIFEST),
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
      lessonId: 'discuss-lesson', code: Math.random().toString(36).slice(2, 8).toUpperCase(),
      status: 'active', currentStep: 0,
    }));
    const student = await studentRepo.save(studentRepo.create({
      sessionId: session.id, lessonId: session.lessonId,
      name: `Alice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      currentTask: 1, currentPhase: 'discuss',
    }));
    return { session, student };
  }

  // ── aiDiscuss ──

  describe('aiDiscuss', () => {
    it('returns reply from LLM and saves AiQuestion record', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue('Good observation!');
      jest.spyOn(aiPromptBuilder, 'buildSocraticPrompt').mockReturnValue('system prompt');
      jest.spyOn(observationService, 'observeTurn').mockResolvedValue(undefined);
      jest.spyOn(observationService, 'getStudentLog').mockReturnValue(null);

      const result = await service.aiDiscuss(
        session, student.id, 1,
        [{ role: 'student', text: 'I think the answer is B' }],
        1, 30,
      );

      expect(result.reply).toBe('Good observation!');
      expect(result.goalReached).toBe(false);

      const saved = await aiQuestionRepo.findOne({
        where: { sessionId: session.id, studentId: student.id },
      });
      expect(saved).not.toBeNull();
      expect(saved!.category).toBe('discuss');
    });

    it('detects [GOAL_REACHED] tag, strips it, returns goalReached: true', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue(
        'You got it! [GOAL_REACHED]',
      );
      jest.spyOn(aiPromptBuilder, 'buildSocraticPrompt').mockReturnValue('prompt');
      jest.spyOn(observationService, 'observeTurn').mockResolvedValue(undefined);
      jest.spyOn(observationService, 'addSystemEvent').mockResolvedValue(undefined);
      jest.spyOn(observationService, 'getStudentLog').mockReturnValue(null);

      const result = await service.aiDiscuss(
        session, student.id, 1,
        [{ role: 'student', text: 'The cause is rain' }],
        3, 60,
      );

      expect(result.goalReached).toBe(true);
      expect(result.reply).not.toContain('[GOAL_REACHED]');
      expect(result.reply).toContain('You got it!');
    });

    it('fires addSystemEvent on goal_reached', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue('Done [GOAL_REACHED]');
      jest.spyOn(aiPromptBuilder, 'buildSocraticPrompt').mockReturnValue('prompt');
      jest.spyOn(observationService, 'observeTurn').mockResolvedValue(undefined);
      jest.spyOn(observationService, 'getStudentLog').mockReturnValue(null);
      const addSysEvt = jest.spyOn(observationService, 'addSystemEvent').mockResolvedValue(undefined);

      await service.aiDiscuss(
        session, student.id, 1,
        [{ role: 'student', text: 'answer' }],
        2, 45,
      );

      expect(addSysEvt).toHaveBeenCalledWith(
        session.id, student.id, student.name, 'discuss_complete',
        expect.objectContaining({ completionType: 'goal_reached', method: 'socratic', goalReached: true, roundsUsed: 2 }),
        expect.stringContaining('目标达成'),
      );
    });

    it('dispatches chat_turn observation event', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue('Reply');
      jest.spyOn(aiPromptBuilder, 'buildSocraticPrompt').mockReturnValue('prompt');
      jest.spyOn(observationService, 'observeTurn').mockResolvedValue(undefined);
      jest.spyOn(observationService, 'getStudentLog').mockReturnValue(null);

      await service.aiDiscuss(
        session, student.id, 1,
        [{ role: 'student', text: 'my answer' }],
        1, 10,
      );

      expect(mockObserverEngine.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'chat_turn', sessionId: session.id }),
      );
    });

    it('returns fallback on LLM failure', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockRejectedValue(new Error('LLM down'));
      jest.spyOn(aiPromptBuilder, 'buildSocraticPrompt').mockReturnValue('prompt');
      jest.spyOn(observationService, 'getStudentLog').mockReturnValue(null);

      const result = await service.aiDiscuss(
        session, student.id, 1,
        [{ role: 'student', text: 'hello' }],
        1, 5,
      );

      expect(result.goalReached).toBe(false);
      expect(result.reply).toContain('rephrase');
    });

    it('throws NotFoundException for unknown student', async () => {
      const { session } = await createSessionAndStudent();
      await expect(
        service.aiDiscuss(session, 'nonexistent', 1, [{ role: 'student', text: 'hi' }], 1, 0),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── discussComplete ──

  describe('discussComplete', () => {
    it('saves observation event with correct completionType', async () => {
      const { session, student } = await createSessionAndStudent();
      const addSysEvt = jest.spyOn(observationService, 'addSystemEvent').mockResolvedValue(undefined);

      const result = await service.discussComplete(
        session, student.id, 1, 'fallback_rounds', 5, 120,
      );

      expect(result.ok).toBe(true);
      expect(addSysEvt).toHaveBeenCalledWith(
        session.id, student.id, student.name, 'discuss_complete',
        expect.objectContaining({ completionType: 'fallback_rounds', method: 'fallback_mc', goalReached: false, roundsUsed: 5 }),
        expect.any(String),
      );
    });

    it('checks MC correctIndex when mcSelectedIndex provided', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(observationService, 'addSystemEvent').mockResolvedValue(undefined);

      const result = await service.discussComplete(
        session, student.id, 1, 'fallback_rounds', 5, 120, 2,
      );

      expect(result.mcCorrect).toBe(true);
    });

    it('returns mcCorrect false for wrong MC answer', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(observationService, 'addSystemEvent').mockResolvedValue(undefined);

      const result = await service.discussComplete(
        session, student.id, 1, 'fallback_time', 3, 90, 0,
      );

      expect(result.mcCorrect).toBe(false);
    });

    it('throws NotFoundException for unknown student', async () => {
      const { session } = await createSessionAndStudent();
      jest.spyOn(observationService, 'addSystemEvent').mockResolvedValue(undefined);
      await expect(
        service.discussComplete(session, 'nonexistent', 1, 'goal_reached', 2, 30),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
