/**
 * `ProgressObservationService` — phase 5 M3. Registers the
 * `record_progress_observation` ActionDef + `StepCompletedTrigger`
 * that fires when a `step_completed` event arrives on
 * `LessonSession.events`. Replaces the legacy `StepCompleteHandler`
 * in `solutions/business/live-lesson/backend/src/adapters/observer-engine/handlers/step-complete-handler.ts`.
 *
 * Observation row shape mirrors the legacy handler:
 *   {type:'progress', data:{step, taskNum?, nextTask?}}
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
import { SolutionsService } from '../../../solutions/solutions.service';
import { compileActionToToolDefinition } from '../../../ontology/action-to-tool-definition';
import { LessonSessionManifest } from '../../../ontology/live-lesson/lesson-session.manifest';
import { ONTOLOGY_REGISTRY } from '../../../ontology/ontology-registry.provider';
import { SolutionToolkitRegistry } from '../../../tool-caller/solution-toolkit-registry';
import type {
  ToolInvocation,
  ToolResult,
} from '../../../tool-caller/types';
import { ObservationRepository } from '../../persistence/observation-repository';
import { WorkflowEngineService } from '../../workflow-engine.service';
import type { TriggerDef, TriggerFireInput } from '../../types';
import {
  LIVE_LESSON_TENANT_SLUG,
  WORKFLOW_PROGRESS_NAMESPACE as WORKFLOW_ACTION_NAMESPACE,
} from '../constants';

const ProgressObservationArgsSchema = z.object({
  entityId: z.string().min(1),
  step: z.number().int().nonnegative(),
  taskNum: z.number().int().nonnegative().optional(),
  nextTask: z.number().int().nonnegative().optional(),
  triggerEventId: z.string().min(1),
});

const RECORD_PROGRESS_OBSERVATION_ACTION: ActionDef = defineAction({
  apiName: 'record_progress_observation',
  displayName: '记录进度观察 / Record Progress Observation',
  semantic:
    'Workflow-internal action: persist a step-completion observation (step + taskNum + nextTask) to the observations table.',
  params: ProgressObservationArgsSchema,
  sideEffects: ['observation:append'],
  allowedRoles: ['admin'],
  auditLevel: 'log',
});

const STEP_COMPLETED_TRIGGER_DEF: TriggerDef = {
  apiName: 'on_step_completed_record_progress',
  manifest: 'LessonSession',
  semantic:
    'when a step_completed event arrives on LessonSession.events, record a progress observation.',
  kind: 'event',
  watch: { stream: 'events' },
  when: (input: TriggerFireInput) => {
    const payload = input.event?.payload as { type?: string } | undefined;
    return payload?.type === 'step_completed';
  },
  then: {
    action: `${WORKFLOW_ACTION_NAMESPACE}.record_progress_observation`,
    args: (input: TriggerFireInput) => {
      const payload = input.event?.payload as {
        studentId: string;
        step: number;
        taskNum?: number;
        nextTask?: number;
      };
      return {
        entityId: payload.studentId,
        step: payload.step,
        taskNum: payload.taskNum,
        nextTask: payload.nextTask,
        triggerEventId: input.cascade.correlationId,
      };
    },
    as: 'admin',
  },
};

@Injectable()
export class ProgressObservationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProgressObservationService.name);

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
        `Tenant "${LIVE_LESSON_TENANT_SLUG}" not provisioned; skipping progress registration.`,
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
      RECORD_PROGRESS_OBSERVATION_ACTION,
      (inv: ToolInvocation): Promise<ToolResult> => this.handle(inv),
      LessonSessionManifest,
    );
    this.toolkits.registerToolkit({
      solutionId: tenant.id,
      namespace: WORKFLOW_ACTION_NAMESPACE,
      tools: [tool],
    });
    this.engine.registerTrigger(STEP_COMPLETED_TRIGGER_DEF);
    this.logger.log(
      `Progress observation registered (solutionId=${tenant.id}).`,
    );
  }

  private async handle(invocation: ToolInvocation): Promise<ToolResult> {
    const args = invocation.args as z.infer<typeof ProgressObservationArgsSchema>;
    const now = Date.now();
    const data: Record<string, unknown> = { step: args.step };
    if (args.taskNum !== undefined) data.taskNum = args.taskNum;
    if (args.nextTask !== undefined) data.nextTask = args.nextTask;
    await this.observations.append({
      id: uuidv4(),
      sessionId: invocation.context.sessionId,
      entityId: args.entityId,
      solutionId: invocation.context.solutionId,
      type: 'progress',
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
          text: JSON.stringify({ recorded: 'progress', step: args.step }),
        },
      ],
    };
  }
}
