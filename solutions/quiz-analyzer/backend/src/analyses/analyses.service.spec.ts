import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalysesService } from './analyses.service';
import { QuizAnalysis, Quiz } from '../database/entities';
import { MessagesService } from '../messages/messages.service';
import { TurnsService } from '../messages/turns.service';

const mockAnalysisRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
};

const mockQuizRepo = {
  findOne: jest.fn(),
};

const mockMessagesService = {
  createMessage: jest.fn(),
};

const mockTurnsService = {
  getLatestTurn: jest.fn(),
  completeTurn: jest.fn(),
};

describe('AnalysesService', () => {
  let service: AnalysesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalysesService,
        { provide: getRepositoryToken(QuizAnalysis), useValue: mockAnalysisRepo },
        { provide: getRepositoryToken(Quiz), useValue: mockQuizRepo },
        { provide: MessagesService, useValue: mockMessagesService },
        { provide: TurnsService, useValue: mockTurnsService },
      ],
    }).compile();

    service = module.get<AnalysesService>(AnalysesService);
    jest.clearAllMocks();
  });

  describe('create (without sessionId)', () => {
    it('should create analysis without persisting messages', async () => {
      mockQuizRepo.findOne.mockResolvedValue({ id: 'quiz_1' });
      mockAnalysisRepo.findOne.mockResolvedValue(null);
      mockAnalysisRepo.create.mockImplementation((data) => data);
      mockAnalysisRepo.save.mockImplementation((data) => Promise.resolve(data));

      await service.create({
        quiz_id: 'quiz_1',
        thinking_process: 'Some analysis',
      });

      expect(mockMessagesService.createMessage).not.toHaveBeenCalled();
      expect(mockTurnsService.getLatestTurn).not.toHaveBeenCalled();
    });
  });

  describe('create (with sessionId)', () => {
    beforeEach(() => {
      mockQuizRepo.findOne.mockResolvedValue({ id: 'quiz_1' });
      mockAnalysisRepo.findOne.mockResolvedValue(null);
      mockAnalysisRepo.create.mockImplementation((data) => ({
        ...data,
        id: 'analysis_1',
        analyzer_version: data.analyzer_version || '1.0',
      }));
      mockAnalysisRepo.save.mockImplementation((data) => Promise.resolve(data));
    });

    it('should create an assistant message when sessionId is provided', async () => {
      mockMessagesService.createMessage.mockResolvedValue({ id: 'msg_asst_1' });
      mockTurnsService.getLatestTurn.mockResolvedValue(null);

      await service.create({
        quiz_id: 'quiz_1',
        thinking_process: 'Analysis content',
        sessionId: 'conv_123',
      });

      expect(mockMessagesService.createMessage).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: 'conv_123',
        role: 'assistant',
        metadata: expect.objectContaining({
          analysisId: 'analysis_1',
          quizId: 'quiz_1',
        }),
      }));
    });

    it('should complete the latest open turn', async () => {
      mockMessagesService.createMessage.mockResolvedValue({ id: 'msg_asst_1' });
      mockTurnsService.getLatestTurn.mockResolvedValue({
        id: 'turn_1',
        completed_at: null,
        created_at: new Date(Date.now() - 5000).toISOString(),
      });
      mockTurnsService.completeTurn.mockResolvedValue({});

      await service.create({
        quiz_id: 'quiz_1',
        thinking_process: 'Content',
        analysis_duration_ms: 3000,
        sessionId: 'conv_123',
      });

      expect(mockTurnsService.completeTurn).toHaveBeenCalledWith('turn_1', {
        assistantMessageId: 'msg_asst_1',
        durationMs: 3000,
      });
    });

    it('should not complete already-completed turns', async () => {
      mockMessagesService.createMessage.mockResolvedValue({ id: 'msg_asst_1' });
      mockTurnsService.getLatestTurn.mockResolvedValue({
        id: 'turn_1',
        completed_at: '2026-02-15T00:00:00Z', // already completed
      });

      await service.create({
        quiz_id: 'quiz_1',
        thinking_process: 'Content',
        sessionId: 'conv_123',
      });

      expect(mockTurnsService.completeTurn).not.toHaveBeenCalled();
    });

    it('should not fail if message persistence fails', async () => {
      mockMessagesService.createMessage.mockRejectedValue(new Error('DB error'));

      // Should not throw
      const result = await service.create({
        quiz_id: 'quiz_1',
        thinking_process: 'Content',
        sessionId: 'conv_123',
      });

      expect(result).toBeDefined();
    });
  });
});
