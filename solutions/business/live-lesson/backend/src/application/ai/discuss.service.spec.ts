import { LLM_PORT } from '../../domain/ports/llm.port';
import { DISCUSS_HIGHLIGHT_REPO_PORT } from "../../domain/ports/discuss-highlight-repo.port";
import { TypeOrmDiscussHighlightRepository } from "../../adapters/persistence/repositories/discuss-highlight.repository";
import { AI_QUESTION_REPO_PORT } from "../../domain/ports/ai-question-repo.port";
import { TypeOrmAiQuestionRepository } from "../../adapters/persistence/repositories/ai-question.repository";
import { SUBMISSION_REPO_PORT } from "../../domain/ports/submission-repo.port";
import { TypeOrmSubmissionRepository } from "../../adapters/persistence/repositories/submission.repository";
import { CHAT_MESSAGE_REPO_PORT } from "../../domain/ports/chat-message-repo.port";
import { TypeOrmChatMessageRepository } from "../../adapters/persistence/repositories/chat-message.repository";
import { STUDENT_REPO_PORT } from "../../domain/ports/student-repo.port";
import { TypeOrmStudentRepository } from "../../adapters/persistence/repositories/student.repository";
import { LESSON_REPO_PORT } from "../../domain/ports/lesson-repo.port";
import { TypeOrmLessonRepository } from "../../adapters/persistence/repositories/lesson.repository";
import { DISCUSS_TARGET_HIT_REPO_PORT } from "../../domain/ports/discuss-target-hit-repo.port";
import { TypeOrmDiscussTargetHitRepository } from "../../adapters/persistence/repositories/discuss-target-hit.repository";
import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryModule } from '@nestjs/core';
import { PLUGIN_PROVIDERS } from '../exercise/test-utils';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DiscussService } from './discuss.service';
import { OBSERVATION_RECORD_REPO_PORT } from '../../domain/ports/observation-record-repo.port';
import { TypeOrmObservationRecordRepository } from '../../adapters/persistence/repositories/observation-record.repository';
import { ObservationQueryService } from '../observation/observation-query.service';
import { AiPromptBuilder } from '../ai/ai-prompt-builder';
import { ManifestCacheService } from '../classroom/manifest-cache.service';
import { Student } from '../../adapters/persistence/entities/student.entity';
import { Submission } from '../../adapters/persistence/entities/submission.entity';
import { ClassroomSession } from '../../adapters/persistence/entities/classroom-session.entity';
import { AiQuestion } from '../../adapters/persistence/entities/ai-question.entity';
import { ChatMessage } from '../../adapters/persistence/entities/chat-message.entity';
import { ClassroomSnapshot } from '../../adapters/persistence/entities/classroom-snapshot.entity';
import { Lesson } from '../../adapters/persistence/entities/lesson.entity';
import { DiscussHighlight } from '../../adapters/persistence/entities/discuss-highlight.entity';
import { DiscussTargetHit } from '../../adapters/persistence/entities/discuss-target-hit.entity';
import { OBSERVER_ENGINE, ObservationRecord } from '@kedge-agentic/observer-engine';
import { ClusterClassifier } from '../../domain/classroom/cluster-classifier';
import { ClusterAggregator } from '../../application/discussion/cluster-aggregator';
import { CoachingService } from '../observation/coaching.service';
import { StudentSubmissionService } from '../classroom/student-submission.service';
import { GradingService } from '../exercise/grading.service';
import { StateCacheService } from '../../adapters/transport/state-cache.service';

const DISCUSS_MANIFEST = {
  id: 'discuss-lesson',
  title: 'Discuss Lesson',
  readingSteps: [
    {
      idx: 1, label: 'Task 1', strategy: 'quiz', type: 'task',
      answerKey: { type: 'quiz', answers: [{ questionIdx: 0, correct: 1, questionText: 'Q1', options: ['A', 'B'] }] },
      discuss: {
        fallbackMC: { correctIndex: 2, options: ['A', 'B', 'C'] },
        clusters: [
          { id: 'c1', label: 'Theme' },
          { id: 'c2', label: 'Evidence' },
        ],
        targetPoints: [
          { id: 'tp1', label: 'Identify metaphor' },
          { id: 'tp2', label: 'Author intent' },
        ],
      },
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
  let observationQuery: ObservationQueryService;
  let studentSubmissionService: StudentSubmissionService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        DiscoveryModule,
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Lesson, Student, Submission, ClassroomSession, AiQuestion, ChatMessage, ObservationRecord, ClassroomSnapshot, DiscussHighlight, DiscussTargetHit],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([Lesson, Student, Submission, ClassroomSession, AiQuestion, ChatMessage, ObservationRecord, ClassroomSnapshot, DiscussHighlight, DiscussTargetHit]),
      ],
      providers: [
        { provide: LLM_PORT, useExisting: AiPromptBuilder },
        TypeOrmDiscussTargetHitRepository,
        TypeOrmDiscussHighlightRepository,
        { provide: DISCUSS_HIGHLIGHT_REPO_PORT, useExisting: TypeOrmDiscussHighlightRepository },
        TypeOrmAiQuestionRepository,
        { provide: AI_QUESTION_REPO_PORT, useExisting: TypeOrmAiQuestionRepository },
        TypeOrmSubmissionRepository,
        { provide: SUBMISSION_REPO_PORT, useExisting: TypeOrmSubmissionRepository },
        TypeOrmChatMessageRepository,
        { provide: CHAT_MESSAGE_REPO_PORT, useExisting: TypeOrmChatMessageRepository },
        TypeOrmStudentRepository,
        { provide: STUDENT_REPO_PORT, useExisting: TypeOrmStudentRepository },
        TypeOrmLessonRepository,
        { provide: LESSON_REPO_PORT, useExisting: TypeOrmLessonRepository },
        { provide: DISCUSS_TARGET_HIT_REPO_PORT, useExisting: TypeOrmDiscussTargetHitRepository },
        ...PLUGIN_PROVIDERS,
        DiscussService, ObservationQueryService, TypeOrmObservationRecordRepository, { provide: OBSERVATION_RECORD_REPO_PORT, useExisting: TypeOrmObservationRecordRepository }, AiPromptBuilder, ManifestCacheService, ClusterClassifier, ClusterAggregator, CoachingService, GradingService, StudentSubmissionService, StateCacheService,
        { provide: OBSERVER_ENGINE, useValue: mockObserverEngine },
      ],
    }).compile();

    service = module.get(DiscussService);
    studentRepo = module.get(getRepositoryToken(Student));
    lessonRepo = module.get(getRepositoryToken(Lesson));
    sessionRepo = module.get(getRepositoryToken(ClassroomSession));
    aiQuestionRepo = module.get(getRepositoryToken(AiQuestion));
    aiPromptBuilder = module.get(AiPromptBuilder);
    observationQuery = module.get(ObservationQueryService);
    studentSubmissionService = module.get(StudentSubmissionService);

    await lessonRepo.save(lessonRepo.create({
      id: 'discuss-lesson', title: 'Discuss Lesson', subject: 'English', gradeLevel: '7',
      manifestJson: JSON.stringify(DISCUSS_MANIFEST),
    }));
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.restoreAllMocks();
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

      jest.spyOn(observationQuery, 'getStudentLogs').mockResolvedValue([]);

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

      jest.spyOn(observationQuery, 'getStudentLogs').mockResolvedValue([]);

      const result = await service.aiDiscuss(
        session, student.id, 1,
        [{ role: 'student', text: 'The cause is rain' }],
        3, 60,
      );

      expect(result.goalReached).toBe(true);
      expect(result.reply).not.toContain('[GOAL_REACHED]');
      expect(result.reply).toContain('You got it!');
    });

    it('fires discuss_complete dispatch on goal_reached', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue('Done [GOAL_REACHED]');
      jest.spyOn(aiPromptBuilder, 'buildSocraticPrompt').mockReturnValue('prompt');

      jest.spyOn(observationQuery, 'getStudentLogs').mockResolvedValue([]);

      await service.aiDiscuss(
        session, student.id, 1,
        [{ role: 'student', text: 'answer' }],
        2, 45,
      );

      expect(mockObserverEngine.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'discuss_complete',
          sessionId: session.id,
          entityId: student.id,
          payload: expect.objectContaining({ completionType: 'goal_reached', method: 'socratic', goalReached: true, roundsUsed: 2 }),
        }),
      );
    });

    it('dispatches chat_turn observation event', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue('Reply');
      jest.spyOn(aiPromptBuilder, 'buildSocraticPrompt').mockReturnValue('prompt');

      jest.spyOn(observationQuery, 'getStudentLogs').mockResolvedValue([]);

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
      jest.spyOn(observationQuery, 'getStudentLogs').mockResolvedValue([]);

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

    it('sets discussMeta.startedAt on first call', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue('Nice thinking!');
      jest.spyOn(aiPromptBuilder, 'buildSocraticPrompt').mockReturnValue('prompt');

      jest.spyOn(observationQuery, 'getStudentLogs').mockResolvedValue([]);

      await service.aiDiscuss(
        session, student.id, 1,
        [{ role: 'student', text: 'My answer' }],
        1, 10,
      );

      const updated = await studentRepo.findOne({ where: { id: student.id } });
      expect(updated!.discussMeta).not.toBeNull();
      expect(updated!.discussMeta!.startedAt).toBeDefined();
      expect(updated!.discussMeta!.goalReached).toBeUndefined();
    });

    it('sets discussMeta.goalReached when goal reached', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue('Correct! [GOAL_REACHED]');
      jest.spyOn(aiPromptBuilder, 'buildSocraticPrompt').mockReturnValue('prompt');

      jest.spyOn(observationQuery, 'getStudentLogs').mockResolvedValue([]);

      await service.aiDiscuss(
        session, student.id, 1,
        [{ role: 'student', text: 'The answer is X' }],
        2, 30,
      );

      const updated = await studentRepo.findOne({ where: { id: student.id } });
      expect(updated!.discussMeta!.goalReached).toBe(true);
      expect(updated!.discussMeta!.startedAt).toBeDefined();
    });

    it('calls vision LLM and extracts imageDescription when images present', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callVisionConversation')
        .mockResolvedValueOnce('I see a formula')       // main vision call
        .mockResolvedValueOnce('(a+b)(a-b)');           // extraction call
      jest.spyOn(aiPromptBuilder, 'buildSocraticPrompt').mockReturnValue('prompt');
      jest.spyOn(observationQuery, 'getStudentLogs').mockResolvedValue([]);

      const result = await service.aiDiscuss(
        session, student.id, 1,
        [{ role: 'student', text: '（见图片）', images: ['data:image/png;base64,abc'] }],
        1, 15,
      );

      expect(result.reply).toBe('I see a formula');
      expect(result.imageDescription).toBe('(a+b)(a-b)');
      expect(aiPromptBuilder.callVisionConversation).toHaveBeenCalledTimes(2);
    });

    it('returns undefined imageDescription when extraction fails', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callVisionConversation')
        .mockResolvedValueOnce('I see something')       // main vision call
        .mockRejectedValueOnce(new Error('timeout'))     // extraction attempt 1
        .mockRejectedValueOnce(new Error('timeout'));    // extraction retry
      jest.spyOn(aiPromptBuilder, 'buildSocraticPrompt').mockReturnValue('prompt');
      jest.spyOn(observationQuery, 'getStudentLogs').mockResolvedValue([]);

      const result = await service.aiDiscuss(
        session, student.id, 1,
        [{ role: 'student', text: '（见图片）', images: ['data:image/png;base64,abc'] }],
        1, 15,
      );

      expect(result.reply).toBe('I see something');
      expect(result.imageDescription).toBeUndefined();
    });

    it('does not extract imageDescription when no images in messages', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue('Text reply');
      jest.spyOn(aiPromptBuilder, 'callVisionConversation');
      jest.spyOn(aiPromptBuilder, 'buildSocraticPrompt').mockReturnValue('prompt');
      jest.spyOn(observationQuery, 'getStudentLogs').mockResolvedValue([]);

      const result = await service.aiDiscuss(
        session, student.id, 1,
        [{ role: 'student', text: 'plain text answer' }],
        1, 15,
      );

      expect(result.imageDescription).toBeUndefined();
      expect(aiPromptBuilder.callVisionConversation).not.toHaveBeenCalled();
    });

    it('persists imageDescription to chat_messages DB', async () => {
      const { session, student } = await createSessionAndStudent();
      const chatMessageRepo = module.get(getRepositoryToken(ChatMessage)) as Repository<ChatMessage>;
      jest.spyOn(aiPromptBuilder, 'callVisionConversation')
        .mockResolvedValueOnce('Vision reply')
        .mockResolvedValueOnce('extracted desc');
      jest.spyOn(aiPromptBuilder, 'buildSocraticPrompt').mockReturnValue('prompt');
      jest.spyOn(observationQuery, 'getStudentLogs').mockResolvedValue([]);

      await service.aiDiscuss(
        session, student.id, 1,
        [{ role: 'student', text: '（见图片）', images: ['data:image/png;base64,img'] }],
        1, 10,
      );

      const saved = await chatMessageRepo.find({
        where: { sessionId: session.id, studentId: student.id, threadId: 'discuss:1' },
        order: { seq: 'ASC' },
      });
      expect(saved).toHaveLength(2); // student + ai
      expect(saved[0].role).toBe('student');
      expect(saved[0].imageDescription).toBe('extracted desc');
      expect(saved[1].role).toBe('ai');
      expect(saved[1].imageDescription).toBeNull();
    });

    it('preserves existing startedAt on subsequent calls', async () => {
      const { session, student } = await createSessionAndStudent();
      jest.spyOn(aiPromptBuilder, 'callLlmConversation').mockResolvedValue('Tell me more');
      jest.spyOn(aiPromptBuilder, 'buildSocraticPrompt').mockReturnValue('prompt');

      jest.spyOn(observationQuery, 'getStudentLogs').mockResolvedValue([]);

      await service.aiDiscuss(
        session, student.id, 1,
        [{ role: 'student', text: 'First try' }],
        1, 10,
      );

      const after1 = await studentRepo.findOne({ where: { id: student.id } });
      const firstStartedAt = after1!.discussMeta!.startedAt;

      await service.aiDiscuss(
        session, student.id, 1,
        [{ role: 'student', text: 'First try' }, { role: 'ai', text: 'Tell me more' }, { role: 'student', text: 'Second try' }],
        2, 20,
      );

      const after2 = await studentRepo.findOne({ where: { id: student.id } });
      expect(after2!.discussMeta!.startedAt).toBe(firstStartedAt);
    });
  });

  // ── discussComplete ──

  describe('discussComplete', () => {
    it('saves observation event with correct completionType', async () => {
      const { session, student } = await createSessionAndStudent();

      const result = await service.discussComplete(
        session, student.id, 1, 'fallback_rounds', 5, 120,
      );

      expect(result.ok).toBe(true);
      expect(mockObserverEngine.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'discuss_complete',
          sessionId: session.id,
          entityId: student.id,
          payload: expect.objectContaining({ completionType: 'fallback_rounds', method: 'fallback_mc', goalReached: false, roundsUsed: 5 }),
        }),
      );
    });

    it('checks MC correctIndex when mcSelectedIndex provided', async () => {
      const { session, student } = await createSessionAndStudent();

      const result = await service.discussComplete(
        session, student.id, 1, 'fallback_rounds', 5, 120, 2,
      );

      expect(result.mcCorrect).toBe(true);
    });

    it('returns mcCorrect false for wrong MC answer', async () => {
      const { session, student } = await createSessionAndStudent();

      const result = await service.discussComplete(
        session, student.id, 1, 'fallback_time', 3, 90, 0,
      );

      expect(result.mcCorrect).toBe(false);
    });

    it('calls updatePhase to advance student to takeaway', async () => {
      const { session, student } = await createSessionAndStudent();
      const updatePhaseSpy = jest.spyOn(studentSubmissionService, 'updatePhase').mockResolvedValue(undefined as any);

      await service.discussComplete(session, student.id, 1, 'goal_reached', 3, 60);

      expect(updatePhaseSpy).toHaveBeenCalledWith(session, student.id, 1, 'takeaway');
    });

    it('throws NotFoundException for unknown student', async () => {
      const { session } = await createSessionAndStudent();
      await expect(
        service.discussComplete(session, 'nonexistent', 1, 'goal_reached', 2, 30),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getDiscussProgress ──

  describe('getDiscussProgress', () => {
    it('returns both clusters and targetPoints empty when no data ingested', async () => {
      const { session, student } = await createSessionAndStudent();
      const result = await service.getDiscussProgress(session, student.id, 1);
      expect(result.clusters).toEqual([
        { id: 'c1', label: 'Theme', hit: false },
        { id: 'c2', label: 'Evidence', hit: false },
      ]);
      expect(result.targetPoints).toEqual([
        { id: 'tp1', label: 'Identify metaphor', hit: false },
        { id: 'tp2', label: 'Author intent', hit: false },
      ]);
    });

    it('returns clusters with correct hit status after ingest', async () => {
      const { session, student } = await createSessionAndStudent();
      const aggregator = module.get(ClusterAggregator);
      aggregator.ingest(session.id, 1, student.id, student.name, {
        clusterId: 'c1',
        eventType: 'new_signal',
        confidence: 'high',
        evidenceSpan: 'student mentioned theme',
        isHighlight: false,
      } as any);

      const result = await service.getDiscussProgress(session, student.id, 1);
      expect(result.clusters).toEqual([
        { id: 'c1', label: 'Theme', hit: true },
        { id: 'c2', label: 'Evidence', hit: false },
      ]);
    });

    it('returns targetPoints with correct hit status after ingest', async () => {
      const { session, student } = await createSessionAndStudent();
      const aggregator = module.get(ClusterAggregator);
      aggregator.ingest(session.id, 1, student.id, student.name, {
        clusterId: 'other',
        eventType: 'new_signal',
        confidence: 'low',
        evidenceSpan: '',
        isHighlight: false,
        targetPointHits: [
          { targetPointId: 'tp1', confidence: 'high', evidenceSpan: 'found the metaphor' },
        ],
      } as any);

      const result = await service.getDiscussProgress(session, student.id, 1);
      expect(result.targetPoints).toEqual([
        { id: 'tp1', label: 'Identify metaphor', hit: true },
        { id: 'tp2', label: 'Author intent', hit: false },
      ]);
    });

    it('returns empty arrays for missing manifest (unknown lessonId)', async () => {
      const session = await sessionRepo.save(sessionRepo.create({
        lessonId: 'nonexistent-lesson', code: Math.random().toString(36).slice(2, 8).toUpperCase(),
        status: 'active', currentStep: 0,
      }));
      const student = await studentRepo.save(studentRepo.create({
        sessionId: session.id, lessonId: session.lessonId,
        name: `Bob-${Date.now()}`, currentTask: 1, currentPhase: 'discuss',
      }));

      const result = await service.getDiscussProgress(session, student.id, 1);
      expect(result).toEqual({ clusters: [], targetPoints: [] });
    });
  });

  // ── discussMeta lifecycle via updatePhase / getProgress ──

  describe('discussMeta via StudentSubmissionService', () => {
    it('getProgress() includes discussMeta', async () => {
      const { session, student } = await createSessionAndStudent();
      student.discussMeta = { startedAt: '2025-01-01T00:00:00.000Z' };
      await studentRepo.save(student);

      const progress = await studentSubmissionService.getProgress(session, student.id);
      expect(progress).not.toBeNull();
      expect(progress!.discussMeta).toEqual({ startedAt: '2025-01-01T00:00:00.000Z' });
    });

    it('updatePhase() clears discussMeta when task changes', async () => {
      const { session, student } = await createSessionAndStudent();
      student.discussMeta = { startedAt: '2025-01-01T00:00:00.000Z', goalReached: true };
      await studentRepo.save(student);

      // Verify the save worked
      const check = await studentRepo.findOne({ where: { id: student.id } });
      expect(check!.discussMeta).toEqual({ startedAt: '2025-01-01T00:00:00.000Z', goalReached: true });

      // Advance to task 2 listen (higher rank than task 1 discuss)
      await studentSubmissionService.updatePhase(session, student.id, 2, 'listen');

      const updated = await studentRepo.findOne({ where: { id: student.id } });
      expect(updated!.currentTask).toBe(2);
      expect(updated!.currentPhase).toBe('listen');
      expect(updated!.discussMeta).toBeNull();
    });
  });
});
