/**
 * `LifecycleObservationService` — phase 5 m2's first end-to-end workflow:
 *
 *   POST /workflow/sessions/:id/events  (cross-process, via WorkflowClient)
 *     → WorkflowEngine.ingestEvent
 *     → matches `JoinTrigger` (event kind, stream='events', predicate
 *        filters `payload.type === 'student_joined'`)
 *     → fires ActionDef `record_lifecycle_observation` via the phase 3
 *        bridge (= ToolCallerProxy + checkBoundary + audit row in
 *        tool_events)
 *     → action handler persists an `Observation` row in the platform
 *        `observations` table
 *
 * Audit-row claim: every join event landing here gets ONE tool_events
 * row (workflow dispatch) + ONE observations row (handler write). The
 * workflow correlationId + tool name + tenant/session/role are all on
 * the audit row; the observation row carries the durable data.
 *
 * Registration happens in OnModuleInit. We resolve `live-lesson` slug
 * → tenant.id (same pattern as Phase 3's LiveLessonOntologyService —
 * SolutionToolkitRegistry keys by uuid, not slug) before registering
 * the toolkit + the trigger.
 *
 * Phase 5 M3+ adds Exercise / StepComplete / ChatTurn / StatusChange /
 * SystemEvent triggers; they'll all reuse this `record_lifecycle_observation`
 * action OR introduce their own action variants (record_exercise_observation,
 * etc.) under the same `workflow-actions` namespace.
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
import { SolutionsService } from '@kedge-agentic/backend/solutions/solutions.service';
import { compileActionToToolDefinition } from '@kedge-agentic/backend/ontology/action-to-tool-definition';
import { LessonSessionManifest } from '../../ontology/lesson-session.manifest';
import { ONTOLOGY_REGISTRY } from '@kedge-agentic/backend/ontology/ontology-registry.provider';
import type { OntologyRegistry } from '@kedge-agentic/ontology';
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
  WORKFLOW_LIFECYCLE_NAMESPACE as WORKFLOW_ACTION_NAMESPACE,
} from '../../constants';
export { LIVE_LESSON_TENANT_SLUG } from '../../constants';

const LifecycleObservationArgsSchema = z.object({
  /** Entity the observation is about — e.g. studentId. */
  entityId: z.string().min(1),
  /** Lifecycle event label — 'join', 'leave', 'step_complete', etc. */
  action: z.string().min(1),
  /** Cascade correlation id from the trigger's TriggerFireInput. */
  triggerEventId: z.string().min(1),
  /** Free-form additional fields preserved in observation.data. */
  extra: z.record(z.unknown()).optional(),
});

export type LifecycleObservationArgs = z.infer<
  typeof LifecycleObservationArgsSchema
>;

const RECORD_LIFECYCLE_OBSERVATION_ACTION: ActionDef = defineAction({
  apiName: 'record_lifecycle_observation',
  displayName: '记录生命周期观察 / Record Lifecycle Observation',
  semantic:
    'Workflow-internal action: persist a lifecycle observation (student join, step complete, system event) to the observations table.',
  params: LifecycleObservationArgsSchema,
  sideEffects: ['observation:append'],
  allowedRoles: ['admin'],
  auditLevel: 'log',
});

/**
 * TriggerDef for live-lesson's `student_joined` events.
 *
 * Watches `LessonSession.events` stream, predicate checks payload type,
 * args mapper extracts entityId + classroomCode → action args. Runs
 * under `admin` role because:
 *   - workflow actions are platform-internal (not agent-visible)
 *   - the manifest's `agent` boundary doesn't list this action; only
 *     `admin` has the wildcard `*` actions
 */
/**
 * Important note on `then.action` shape: it carries the FULLY QUALIFIED
 * tool name (`<namespace>.<actionApiName>`) as registered in the
 * SolutionToolkitRegistry. The Phase 3 bridge's default `qualifyTool` is
 * identity, so the engine's `accessor.invokeAction(...)` hands this
 * string straight to `ToolCallerProxy.resolveTool(solutionId, ...)`.
 *
 * Workflow actions register under `WORKFLOW_ACTION_NAMESPACE`; trigger
 * definitions reference the resulting qualified name.
 */
/**
 * Helper to keep the 4 lifecycle triggers (join + 3 system event
 * variants) compact. Each is a thin shell over `event` kind +
 * type-discriminated predicate + args mapper.
 */
function lifecycleTrigger(opts: {
  apiName: string;
  semantic: string;
  payloadType: string;
  toAction: 'join' | 'translate_request' | 'discuss_complete' | 'continue_chat_turn';
  /** Extra fields from payload preserved in observation.data. */
  extras?: (payload: Record<string, unknown>) => Record<string, unknown>;
}): TriggerDef {
  return {
    apiName: opts.apiName,
    manifest: 'LessonSession',
    semantic: opts.semantic,
    kind: 'event',
    watch: { stream: 'events' },
    when: (input: TriggerFireInput) => {
      const payload = input.event?.payload as { type?: string } | undefined;
      return payload?.type === opts.payloadType;
    },
    then: {
      action: `${WORKFLOW_ACTION_NAMESPACE}.record_lifecycle_observation`,
      args: (input: TriggerFireInput) => {
        const payload = input.event?.payload as Record<string, unknown> & {
          studentId: string;
        };
        return {
          entityId: payload.studentId,
          action: opts.toAction,
          triggerEventId: input.cascade.correlationId,
          extra: opts.extras ? opts.extras(payload) : undefined,
        };
      },
      as: 'admin',
    },
  };
}

const JOIN_TRIGGER_DEF: TriggerDef = lifecycleTrigger({
  apiName: 'on_student_joined_record_lifecycle',
  semantic:
    'when a student_joined event arrives on LessonSession.events, record a lifecycle observation.',
  payloadType: 'student_joined',
  toAction: 'join',
  extras: (p) => ({ classroomCode: p.classroomCode }),
});

const TRANSLATE_REQUEST_TRIGGER_DEF: TriggerDef = lifecycleTrigger({
  apiName: 'on_translate_request_record_lifecycle',
  semantic: 'M3: translate_request → lifecycle observation (system event).',
  payloadType: 'translate_request',
  toAction: 'translate_request',
  extras: (p) => ({
    step: p.step,
    originalText: p.originalText,
  }),
});

const DISCUSS_COMPLETE_TRIGGER_DEF: TriggerDef = lifecycleTrigger({
  apiName: 'on_discuss_complete_record_lifecycle',
  semantic: 'M3: discuss_complete → lifecycle observation (system event).',
  payloadType: 'discuss_complete',
  toAction: 'discuss_complete',
  extras: (p) => ({ step: p.step }),
});

const CONTINUE_CHAT_TURN_TRIGGER_DEF: TriggerDef = lifecycleTrigger({
  apiName: 'on_continue_chat_turn_record_lifecycle',
  semantic: 'M3: continue_chat_turn → lifecycle observation (system event).',
  payloadType: 'continue_chat_turn',
  toAction: 'continue_chat_turn',
  extras: (p) => ({ step: p.step }),
});

const LIFECYCLE_TRIGGERS: readonly TriggerDef[] = [
  JOIN_TRIGGER_DEF,
  TRANSLATE_REQUEST_TRIGGER_DEF,
  DISCUSS_COMPLETE_TRIGGER_DEF,
  CONTINUE_CHAT_TURN_TRIGGER_DEF,
];

@Injectable()
export class LifecycleObservationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LifecycleObservationService.name);

  constructor(
    @Inject(ONTOLOGY_REGISTRY) private readonly registry: OntologyRegistry,
    private readonly observations: ObservationRepository,
    private readonly solutions: SolutionsService,
    private readonly toolkits: SolutionToolkitRegistry,
    private readonly engine: WorkflowEngineService,
  ) {}

  /**
   * Runs at `OnApplicationBootstrap` (not `OnModuleInit`) so:
   *   1. Tenant resolution sees rows created by other modules'
   *      `OnModuleInit` (e.g. `SolutionLoaderService`).
   *   2. The LessonSession manifest registered by
   *      `LiveLessonOntologyService.onModuleInit` (Phase 3) is already
   *      present — no duplicate-register attempt, no race.
   * Pass-1 code-review S-4 + S-8.
   */
  async onApplicationBootstrap(): Promise<void> {
    const tenant = await this.solutions.findOne(LIVE_LESSON_TENANT_SLUG);
    if (!tenant) {
      this.logger.warn(
        `Tenant slug "${LIVE_LESSON_TENANT_SLUG}" not provisioned at boot — ` +
          'skipping lifecycle observation registration. Action registers once the tenant row exists.',
      );
      return;
    }

    // Phase 3 `LiveLessonOntologyService` is responsible for the
    // LessonSession manifest registration. If it's missing here, that's
    // a wiring bug — fail loudly rather than fix it defensively.
    if (!this.registry.getManifest('LessonSession')) {
      this.logger.error(
        'LessonSession manifest is not registered. Check that ' +
          'LiveLessonOntologyService is wired into AppModule (Phase 3).',
      );
      return;
    }

    const tool = compileActionToToolDefinition(
      RECORD_LIFECYCLE_OBSERVATION_ACTION,
      (invocation: ToolInvocation): Promise<ToolResult> =>
        this.handleRecordLifecycleObservation(invocation),
      LessonSessionManifest,
    );

    this.toolkits.registerToolkit({
      solutionId: tenant.id,
      namespace: WORKFLOW_ACTION_NAMESPACE,
      tools: [tool],
    });

    for (const trigger of LIFECYCLE_TRIGGERS) {
      this.engine.registerTrigger(trigger);
    }

    this.logger.log(
      `Lifecycle observation registered: ActionDef ` +
        `"${WORKFLOW_ACTION_NAMESPACE}.${RECORD_LIFECYCLE_OBSERVATION_ACTION.apiName}" + ` +
        `${LIFECYCLE_TRIGGERS.length} triggers (solutionId=${tenant.id}).`,
    );
  }

  /**
   * Action handler invoked by ToolCallerProxy after the bridge's
   * checkBoundary + Zod parse. Appends a row to the platform
   * observations table.
   */
  private async handleRecordLifecycleObservation(
    invocation: ToolInvocation,
  ): Promise<ToolResult> {
    const args = invocation.args as LifecycleObservationArgs;
    const now = Date.now();
    const data: Record<string, unknown> = {
      action: args.action,
      ...(args.extra ?? {}),
    };
    await this.observations.append({
      id: uuidv4(),
      sessionId: invocation.context.sessionId,
      entityId: args.entityId,
      solutionId: invocation.context.solutionId,
      type: 'lifecycle',
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
          text: JSON.stringify({
            recorded: 'lifecycle',
            action: args.action,
            entityId: args.entityId,
          }),
        },
      ],
    };
  }
}
