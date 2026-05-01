import { Injectable } from '@nestjs/common';
import { ObserverHandler } from '@kedge-agentic/observer-engine';
import type { ObserverEvent, HandlerContext, HandlerResult } from '@kedge-agentic/observer-engine';

@Injectable()
export class JoinHandler {
  @ObserverHandler('student_join')
  async handle(event: ObserverEvent, _ctx: HandlerContext): Promise<HandlerResult> {
    return {
      observations: [
        {
          op: 'append' as const,
          observation: {
            entityId: event.entityId,
            type: 'lifecycle',
            data: { action: 'join', ...event.payload },
            triggerEventId: event.id,
          },
        },
      ],
    };
  }
}
