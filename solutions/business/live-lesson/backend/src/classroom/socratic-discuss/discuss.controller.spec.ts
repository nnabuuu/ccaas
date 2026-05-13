import { BadRequestException } from '@nestjs/common';
import { DiscussController } from './discuss.controller';

const fakeSession = { id: 'sess-1', code: 'ABC234', lessonId: 'L1', status: 'started' } as any;

const mockClassroomService = {
  resolveStartedSession: jest.fn().mockResolvedValue(fakeSession),
  broadcast: jest.fn(),
};

const mockDiscussService = {
  getDiscussProgress: jest.fn().mockResolvedValue({ clusters: [] }),
  aiDiscuss: jest.fn().mockResolvedValue({ reply: 'test', goalReached: false }),
  discussComplete: jest.fn().mockResolvedValue({ ok: true }),
};

describe('DiscussController', () => {
  let controller: DiscussController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new DiscussController(
      mockClassroomService as any,
      mockDiscussService as any,
    );
  });

  // --- getDiscussProgress ---

  it('getDiscussProgress delegates to service with correct args', async () => {
    const result = await controller.getDiscussProgress('ABC234', 'stu-1', '3');
    expect(mockClassroomService.resolveStartedSession).toHaveBeenCalledWith('ABC234');
    expect(mockDiscussService.getDiscussProgress).toHaveBeenCalledWith(fakeSession, 'stu-1', 3);
    expect(result).toEqual({ clusters: [] });
  });

  it('getDiscussProgress throws when studentId is missing', async () => {
    await expect(controller.getDiscussProgress('ABC234', '', '1'))
      .rejects.toThrow(BadRequestException);
  });

  it('getDiscussProgress throws when taskNum is not a number', async () => {
    await expect(controller.getDiscussProgress('ABC234', 'stu-1', 'abc'))
      .rejects.toThrow(BadRequestException);
  });

  // --- aiDiscuss ---

  it('aiDiscuss delegates to service with all DTO fields', async () => {
    const dto = {
      studentId: 'stu-1',
      taskNum: 2,
      messages: [{ role: 'student' as const, text: 'hello' }],
      round: 1,
      timeUsedSeconds: 30,
    };
    await controller.aiDiscuss('ABC234', dto);
    expect(mockDiscussService.aiDiscuss).toHaveBeenCalledWith(
      fakeSession, 'stu-1', 2, dto.messages, 1, 30,
    );
  });

  it('aiDiscuss calls broadcast after service returns', async () => {
    const dto = {
      studentId: 'stu-1', taskNum: 1,
      messages: [{ role: 'student' as const, text: 'hi' }],
      round: 0, timeUsedSeconds: 0,
    };
    await controller.aiDiscuss('ABC234', dto);
    expect(mockClassroomService.broadcast).toHaveBeenCalledWith('sess-1');
  });

  it('aiDiscuss returns service result as-is', async () => {
    const dto = {
      studentId: 'stu-1', taskNum: 1,
      messages: [{ role: 'student' as const, text: 'hi' }],
      round: 0, timeUsedSeconds: 0,
    };
    const result = await controller.aiDiscuss('ABC234', dto);
    expect(result).toEqual({ reply: 'test', goalReached: false });
  });

  // --- discussComplete ---

  it('discussComplete delegates with all DTO fields including optional mcSelectedIndex', async () => {
    const dto = {
      studentId: 'stu-1',
      taskNum: 3,
      completionType: 'goal_reached' as const,
      roundsUsed: 4,
      timeUsedSeconds: 120,
      mcSelectedIndex: 2,
    };
    await controller.discussComplete('ABC234', dto);
    expect(mockDiscussService.discussComplete).toHaveBeenCalledWith(
      fakeSession, 'stu-1', 3, 'goal_reached', 4, 120, 2,
    );
  });

  it('discussComplete calls broadcast after service returns', async () => {
    const dto = {
      studentId: 'stu-1', taskNum: 1,
      completionType: 'fallback_rounds' as const,
      roundsUsed: 5, timeUsedSeconds: 60,
    };
    await controller.discussComplete('ABC234', dto);
    expect(mockClassroomService.broadcast).toHaveBeenCalledWith('sess-1');
  });

  it('discussComplete returns service result as-is', async () => {
    const dto = {
      studentId: 'stu-1', taskNum: 1,
      completionType: 'fallback_time' as const,
      roundsUsed: 3, timeUsedSeconds: 90,
    };
    const result = await controller.discussComplete('ABC234', dto);
    expect(result).toEqual({ ok: true });
  });

  it('discussComplete passes undefined mcSelectedIndex when omitted', async () => {
    const dto = {
      studentId: 'stu-1', taskNum: 1,
      completionType: 'fallback_rounds' as const,
      roundsUsed: 5, timeUsedSeconds: 60,
    };
    await controller.discussComplete('ABC234', dto);
    expect(mockDiscussService.discussComplete).toHaveBeenCalledWith(
      fakeSession, 'stu-1', 1, 'fallback_rounds', 5, 60, undefined,
    );
  });

  // --- error propagation ---

  it('rejects invalid session code before calling service', async () => {
    await expect(controller.getDiscussProgress('BAD!', 'stu-1', '1'))
      .rejects.toThrow(BadRequestException);
    expect(mockClassroomService.resolveStartedSession).not.toHaveBeenCalled();
  });

  it('propagates resolveStartedSession rejection', async () => {
    mockClassroomService.resolveStartedSession.mockRejectedValueOnce(
      new BadRequestException('Session not found'),
    );
    await expect(controller.getDiscussProgress('ABC234', 'stu-1', '1'))
      .rejects.toThrow('Session not found');
  });

  it('does not broadcast when aiDiscuss service rejects', async () => {
    mockDiscussService.aiDiscuss.mockRejectedValueOnce(new Error('LLM down'));
    const dto = {
      studentId: 'stu-1', taskNum: 1,
      messages: [{ role: 'student' as const, text: 'hi' }],
      round: 0, timeUsedSeconds: 0,
    };
    await expect(controller.aiDiscuss('ABC234', dto)).rejects.toThrow('LLM down');
    expect(mockClassroomService.broadcast).not.toHaveBeenCalled();
  });
});
