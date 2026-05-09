import { Injectable } from '@nestjs/common';
import { ObserverHandler } from '@kedge-agentic/observer-engine';
import type { ObserverEvent, HandlerContext, HandlerResult } from '@kedge-agentic/observer-engine';

@Injectable()
export class SystemEventHandler {
  @ObserverHandler('translate_request')
  handleTranslate(event: ObserverEvent, _ctx: HandlerContext): HandlerResult {
    return this.appendLifecycleObs(event, 'translate_request');
  }

  @ObserverHandler('discuss_complete')
  handleDiscussComplete(event: ObserverEvent, _ctx: HandlerContext): HandlerResult {
    return {
      observations: [
        {
          op: 'append' as const,
          observation: {
            entityId: event.entityId,
            type: 'lifecycle',
            data: { action: 'discuss_complete', ...event.payload },
            triggerEventId: event.id,
          },
        },
      ],
      emit: [
        {
          type: 'student_observation_changed',
          sessionId: event.sessionId,
          entityId: event.entityId,
          tenantId: event.tenantId,
          payload: { trigger: 'discuss_complete' },
        },
      ],
    };
  }

  @ObserverHandler('continue_chat_turn')
  handleContinueChatTurn(event: ObserverEvent, _ctx: HandlerContext): HandlerResult {
    return this.appendLifecycleObs(event, 'continue_chat_turn');
  }

  private appendLifecycleObs(event: ObserverEvent, action: string): HandlerResult {
    return {
      observations: [
        {
          op: 'append' as const,
          observation: {
            entityId: event.entityId,
            type: 'lifecycle',
            data: { action, ...event.payload },
            triggerEventId: event.id,
          },
        },
      ],
    };
  }
}
