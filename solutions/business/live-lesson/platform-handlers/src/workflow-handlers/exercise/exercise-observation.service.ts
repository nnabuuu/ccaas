/**
 * `ExerciseObservationService` — phase 5 M3. Registers the
 * `record_exercise_observation` ActionDef + `ExerciseTrigger` that
 * fires when a `student_submitted` event arrives on
 * `LessonSession.events`. Replaces the legacy `ExerciseHandler` in
 * `solutions/business/live-lesson/backend/src/adapters/observer-engine/handlers/exercise-handler.ts`
 * (slated for deletion in M3 after dual-write transition completes).
 *
 * Observation row shape mirrors the legacy handler:
 *   {type:'exercise', data:{score, step}}
 *
 * Audit semantics: each fired trigger lands one tool_events row +
 * one observations row (workflow path) — distinguishable from
 * agent-driven invocations only by `actingUserId === undefined`.
 */

import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { defineAction, type ActionDef } from '@kedge-agentic/ontology';
import type { OntologyRegistry } from '@kedge-agentic/ontology';
import { SolutionsService } from '@kedge-agentic/backend/solutions/solutions.service';
import { compileActionToToolDefinition } from '@kedge-agentic/backend/ontology/action-to-tool-definition';
import { LessonSessionManifest } from '../../ontology/lesson-session.manifest';
import { ONTOLOGY_REGISTRY } from '@kedge-agentic/backend/ontology/ontology-registry.provider';
import { SolutionToolkitRegistry } from '@kedge-agentic/backend/tool-caller/solution-toolkit-registry';
import type {
  ToolInvocation,
  ToolResult,
} from '@kedge-agentic/backend/tool-caller/types';
import { ObservationRepository } from '@kedge-agentic/backend/workflow/persistence/observation-repository';
import { WorkflowEngineService } from '@kedge-agentic/backend/workflow/workflow-engine.service';
import type { TriggerDef, TriggerFireInput } from '@kedge-agentic/backend/workflow/types';
import {
  LIVE_LESSON_TENANT_SLUG,
  WORKFLOW_EXERCISE_NAMESPACE as WORKFLOW_ACTION_NAMESPACE,
} from '../../constants';

const ExerciseObservationArgsSchema = z.object({
  /** Student the observation is about. */
  entityId: z.string().min(1),
  /** Step number the submission was for. */
  step: z.number().int().nonnegative(),
  /** Score (typically 0-1 normalised, but workflow doesn't constrain). */
  score: z.number().optional(),
  /** Cascade correlation id. */
  triggerEventId: z.string().min(1),
});

const RECORD_EXERCISE_OBSERVATION_ACTION: ActionDef = defineAction({
  apiName: 'record_exercise_observation',
  displayName: '记录练习观察 / Record Exercise Observation',
  semantic:
    'Workflow-internal action: persist an exercise submission observation (score + step) to the observations table.',
  params: ExerciseObservationArgsSchema,
  sideEffects: ['observation:append'],
  allowedRoles: ['admin'],
  auditLevel: 'log',
});

const EXERCISE_TRIGGER_DEF: TriggerDef = {
  apiName: 'on_student_submitted_record_exercise',
  manifest: 'LessonSession',
  semantic:
    'when a student_submitted event arrives on LessonSession.events, record an exercise observation.',
  kind: 'event',
  watch: { stream: 'events' },
  when: (input: TriggerFireInput) => {
    const payload = input.event?.payload as { type?: string } | undefined;
    return payload?.type === 'student_submitted';
  },
  then: {
    action: `${WORKFLOW_ACTION_NAMESPACE}.record_exercise_observation`,
    args: (input: TriggerFireInput) => {
      const payload = input.event?.payload as {
        studentId: string;
        step: number;
        score?: number;
      };
      return {
        entityId: payload.studentId,
        step: payload.step,
        score: payload.score,
        triggerEventId: input.cascade.correlationId,
      };
    },
    as: 'admin',
  },
};

@Injectable()
export class ExerciseObservationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ExerciseObservationService.name);

  constructor(
    @Inject(ONTOLOGY_REGISTRY) private readonly registry: OntologyRegistry,
    private readonly observations: ObservationRepository,
    private readonly solutions: SolutionsService,
    private readonly toolkits: SolutionToolkitRegistry,
    private readonly engine: WorkflowEngineService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const tenant = await this.solutions.findOne(LIVE_LESSON_TENANT_SLUG);
    if (!tenant) {
      this.logger.warn(
        `Tenant "${LIVE_LESSON_TENANT_SLUG}" not provisioned; skipping exercise registration.`,
      );
      return;
    }
    if (!this.registry.getManifest('LessonSession')) {
      this.logger.error(
        'LessonSession manifest not registered; LiveLessonOntologyService missing?',
      );
      return;
    }

    const tool = compileActionToToolDefinition(
      RECORD_EXERCISE_OBSERVATION_ACTION,
      (inv: ToolInvocation): Promise<ToolResult> => this.handle(inv),
      LessonSessionManifest,
    );
    this.toolkits.registerToolkit({
      solutionId: tenant.id,
      namespace: WORKFLOW_ACTION_NAMESPACE,
      tools: [tool],
    });
    this.engine.registerTrigger(EXERCISE_TRIGGER_DEF);
    this.logger.log(
      `Exercise observation registered (solutionId=${tenant.id}).`,
    );
  }

  private async handle(invocation: ToolInvocation): Promise<ToolResult> {
    const args = invocation.args as z.infer<typeof ExerciseObservationArgsSchema>;
    const now = Date.now();
    const data: Record<string, unknown> = { step: args.step };
    if (args.score !== undefined) data.score = args.score;
    await this.observations.append({
      id: uuidv4(),
      sessionId: invocation.context.sessionId,
      entityId: args.entityId,
      solutionId: invocation.context.solutionId,
      type: 'exercise',
      data,
      triggerEventId: args.triggerEventId,
      createdAt: now,
      updatedAt: now,
    });
    return {
      ok: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify({ recorded: 'exercise', step: args.step }),
        },
      ],
    };
  }
}
