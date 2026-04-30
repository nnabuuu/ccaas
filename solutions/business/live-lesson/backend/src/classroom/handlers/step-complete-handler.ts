import { Injectable } from '@nestjs/common';
import { ObserverHandler } from '@kedge-agentic/observer-engine';
import type { ObserverEvent, HandlerContext, HandlerResult } from '@kedge-agentic/observer-engine';

@Injectable()
export class StepCompleteHandler {
  @ObserverHandler('step_complete')
  async handle(event: ObserverEvent, _ctx: HandlerContext): Promise<HandlerResult> {
    const { step, taskNum, nextTask } = event.payload as {
      step: number;
      taskNum: number;
      nextTask: number;
    };

    return {
      observations: [
        {
          op: 'append' as const,
          observation: {
            entityId: event.entityId,
            type: 'progress',
            data: { step, taskNum, nextTask },
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
          payload: { trigger: 'step_complete' },
        },
      ],
    };
  }
}
