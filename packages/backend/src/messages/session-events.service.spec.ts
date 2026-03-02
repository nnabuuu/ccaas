/**
 * SessionEventsService - Unit Tests
 *
 * Tests event persistence: recordEvent sequencing, findBySession filtering.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SessionEventsService } from './session-events.service';
import { SessionEvent } from './entities/session-event.entity';

describe('SessionEventsService', () => {
  let service: SessionEventsService;
  let mockRepo: {
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  beforeEach(async () => {
    mockRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionEventsService,
        { provide: getRepositoryToken(SessionEvent), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<SessionEventsService>(SessionEventsService);
  });

  describe('recordEvent', () => {
    it('should save event with incrementing sequence number', async () => {
      const event1 = { type: 'agent_status', status: 'complete' };
      const event2 = { type: 'tool_activity', toolId: 'tool-1' };

      await service.recordEvent('session-1', 'tenant-1', event1);
      await service.recordEvent('session-1', 'tenant-1', event2);

      expect(mockRepo.save).toHaveBeenCalledTimes(2);
      expect(mockRepo.save).toHaveBeenNthCalledWith(1, {
        sessionId: 'session-1',
        tenantId: 'tenant-1',
        messageId: null,
        type: 'agent_status',
        payload: event1,
        seq: 1,
      });
      expect(mockRepo.save).toHaveBeenNthCalledWith(2, {
        sessionId: 'session-1',
        tenantId: 'tenant-1',
        messageId: null,
        type: 'tool_activity',
        payload: event2,
        seq: 2,
      });
    });

    it('should maintain separate sequence counters per session', async () => {
      await service.recordEvent('session-A', 'tenant-1', { type: 'event-a' });
      await service.recordEvent('session-B', 'tenant-1', { type: 'event-b' });
      await service.recordEvent('session-A', 'tenant-1', { type: 'event-a2' });

      // session-A: seq 1, 2; session-B: seq 1
      expect(mockRepo.save).toHaveBeenNthCalledWith(1, expect.objectContaining({ sessionId: 'session-A', seq: 1 }));
      expect(mockRepo.save).toHaveBeenNthCalledWith(2, expect.objectContaining({ sessionId: 'session-B', seq: 1 }));
      expect(mockRepo.save).toHaveBeenNthCalledWith(3, expect.objectContaining({ sessionId: 'session-A', seq: 2 }));
    });

    it('should use messageId from event when present', async () => {
      await service.recordEvent('session-1', 'tenant-1', {
        type: 'text_delta',
        messageId: 'msg-42',
        delta: 'hello',
      });

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ messageId: 'msg-42' }),
      );
    });

    it('should handle null tenantId', async () => {
      await service.recordEvent('session-1', null, { type: 'test' });

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: null }),
      );
    });
  });

  describe('findBySession', () => {
    let mockQb: Record<string, jest.Mock>;

    beforeEach(() => {
      mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockRepo.createQueryBuilder.mockReturnValue(mockQb);
    });

    it('should query by sessionId ordered by seq ASC', async () => {
      await service.findBySession('session-1');

      expect(mockQb.where).toHaveBeenCalledWith('e.sessionId = :sessionId', { sessionId: 'session-1' });
      expect(mockQb.orderBy).toHaveBeenCalledWith('e.seq', 'ASC');
      expect(mockQb.getMany).toHaveBeenCalled();
    });

    it('should filter by event types when provided', async () => {
      await service.findBySession('session-1', { types: ['output_update', 'agent_status'] });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'e.type IN (:...types)',
        { types: ['output_update', 'agent_status'] },
      );
    });

    it('should not filter by types when not provided', async () => {
      await service.findBySession('session-1');

      expect(mockQb.andWhere).not.toHaveBeenCalled();
    });

    it('should apply limit and offset when provided', async () => {
      await service.findBySession('session-1', { limit: 50, offset: 10 });

      expect(mockQb.take).toHaveBeenCalledWith(50);
      expect(mockQb.skip).toHaveBeenCalledWith(10);
    });

    it('should not apply skip/take when not provided', async () => {
      await service.findBySession('session-1');

      expect(mockQb.skip).not.toHaveBeenCalled();
      expect(mockQb.take).not.toHaveBeenCalled();
    });
  });

  describe('clearSession', () => {
    it('should reset sequence counter for a session', async () => {
      // Record two events to set seq to 2
      await service.recordEvent('session-1', 'tenant-1', { type: 'a' });
      await service.recordEvent('session-1', 'tenant-1', { type: 'b' });

      // Clear and record again — seq should restart at 1
      service.clearSession('session-1');
      await service.recordEvent('session-1', 'tenant-1', { type: 'c' });

      expect(mockRepo.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ seq: 1 }),
      );
    });

    it('should not affect other sessions', async () => {
      await service.recordEvent('session-A', 'tenant-1', { type: 'a' });
      await service.recordEvent('session-B', 'tenant-1', { type: 'b' });

      service.clearSession('session-A');

      await service.recordEvent('session-B', 'tenant-1', { type: 'b2' });

      // session-B should continue at seq 2
      expect(mockRepo.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ sessionId: 'session-B', seq: 2 }),
      );
    });
  });
});
