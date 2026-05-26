import { Injectable } from '@nestjs/common';
import { ObserverHandler } from '@kedge-agentic/observer-engine';
import type { ObserverEvent, HandlerContext, HandlerResult } from '@kedge-agentic/observer-engine';

@Injectable()
export class ExerciseHandler {
  @ObserverHandler('exercise_result')
  async handle(event: ObserverEvent, _ctx: HandlerContext): Promise<HandlerResult> {
    const { score, step } = event.payload as { score: number; step: number };
    return {
      observations: [
        {
          op: 'append' as const,
          observation: {
            entityId: event.entityId,
            type: 'exercise',
            data: { score, step },
            triggerEventId: event.id,
          },
        },
      ],
      emit: [
        {
          type: 'student_observation_changed',
          sessionId: event.sessionId,
          entityId: event.entityId,
          solutionId: event.solutionId,
          payload: { trigger: 'exercise_result' },
        },
      ],
    };
  }
}
