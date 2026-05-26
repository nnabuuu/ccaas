import type { ObserverEvent, HandlerContext } from '@kedge-agentic/observer-engine';
import { SystemEventHandler } from './system-event-handler';

function makeEvent(overrides: Partial<ObserverEvent> = {}): ObserverEvent {
  return {
    id: 'evt-1',
    type: 'test',
    sessionId: 'sess-1',
    entityId: 'ent-1',
    solutionId: 'ten-1',
    timestamp: Date.now(),
    payload: { foo: 'bar' },
    ...overrides,
  };
}

const ctx = {} as HandlerContext;

describe('SystemEventHandler', () => {
  const handler = new SystemEventHandler();

  describe('handleTranslate', () => {
    it('returns an append lifecycle observation with translate_request action', () => {
      const event = makeEvent({ type: 'translate_request', payload: { text: 'hello' } });
      const result = handler.handleTranslate(event, ctx);

      expect(result.observations).toHaveLength(1);
      expect(result.observations[0]).toEqual({
        op: 'append',
        observation: {
          entityId: 'ent-1',
          type: 'lifecycle',
          data: { action: 'translate_request', text: 'hello' },
          triggerEventId: 'evt-1',
        },
      });
      expect(result.emit).toBeUndefined();
    });
  });

  describe('handleDiscussComplete', () => {
    it('returns an append lifecycle observation and emits student_observation_changed', () => {
      const event = makeEvent({ type: 'discuss_complete', payload: { step: 2 } });
      const result = handler.handleDiscussComplete(event, ctx);

      expect(result.observations).toHaveLength(1);
      expect(result.observations[0]).toEqual({
        op: 'append',
        observation: {
          entityId: 'ent-1',
          type: 'lifecycle',
          data: { action: 'discuss_complete', step: 2 },
          triggerEventId: 'evt-1',
        },
      });

      expect(result.emit).toHaveLength(1);
      expect(result.emit![0]).toEqual({
        type: 'student_observation_changed',
        sessionId: 'sess-1',
        entityId: 'ent-1',
        solutionId: 'ten-1',
        payload: { trigger: 'discuss_complete' },
      });
    });
  });

  describe('handleContinueChatTurn', () => {
    it('returns an append lifecycle observation with continue_chat_turn action', () => {
      const event = makeEvent({ type: 'continue_chat_turn', payload: { round: 3 } });
      const result = handler.handleContinueChatTurn(event, ctx);

      expect(result.observations).toHaveLength(1);
      expect(result.observations[0]).toEqual({
        op: 'append',
        observation: {
          entityId: 'ent-1',
          type: 'lifecycle',
          data: { action: 'continue_chat_turn', round: 3 },
          triggerEventId: 'evt-1',
        },
      });
      expect(result.emit).toBeUndefined();
    });
  });
});
