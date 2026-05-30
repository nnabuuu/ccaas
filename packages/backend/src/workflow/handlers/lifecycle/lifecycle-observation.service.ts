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
  OnModuleInit,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { defineAction, type ActionDef } from '@kedge-agentic/ontology';
import { SolutionsService } from '../../../solutions/solutions.service';
import { compileActionToToolDefinition } from '../../../ontology/action-to-tool-definition';
import { LessonSessionManifest } from '../../../ontology/live-lesson/lesson-session.manifest';
import { ONTOLOGY_REGISTRY } from '../../../ontology/ontology-registry.provider';
import type { OntologyRegistry } from '@kedge-agentic/ontology';
import { SolutionToolkitRegistry } from '../../../tool-caller/solution-toolkit-registry';
import type {
  ToolInvocation,
  ToolResult,
} from '../../../tool-caller/types';
import { ObservationRepository } from '../../persistence/observation-repository';
import { WorkflowEngineService } from '../../workflow-engine.service';
import type { TriggerDef, TriggerFireInput } from '../../types';

export const LIVE_LESSON_TENANT_SLUG = 'live-lesson';
export const WORKFLOW_ACTION_NAMESPACE = 'workflow-actions';

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
const JOIN_TRIGGER_DEF: TriggerDef = {
  apiName: 'on_student_joined_record_lifecycle',
  manifest: 'LessonSession',
  semantic:
    'when a student_joined event arrives on LessonSession.events, record a lifecycle observation.',
  kind: 'event',
  watch: { stream: 'events' },
  when: (input: TriggerFireInput) => {
    const payload = input.event?.payload as { type?: string } | undefined;
    return payload?.type === 'student_joined';
  },
  then: {
    action: `${WORKFLOW_ACTION_NAMESPACE}.record_lifecycle_observation`,
    args: (input: TriggerFireInput) => {
      const payload = input.event?.payload as {
        studentId: string;
        classroomCode: string;
      };
      return {
        entityId: payload.studentId,
        action: 'join',
        triggerEventId: input.cascade.correlationId,
        extra: { classroomCode: payload.classroomCode },
      };
    },
    as: 'admin',
  },
};

@Injectable()
export class LifecycleObservationService implements OnModuleInit {
  private readonly logger = new Logger(LifecycleObservationService.name);

  constructor(
    @Inject(ONTOLOGY_REGISTRY) private readonly registry: OntologyRegistry,
    private readonly observations: ObservationRepository,
    private readonly solutions: SolutionsService,
    private readonly toolkits: SolutionToolkitRegistry,
    private readonly engine: WorkflowEngineService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Tenant resolution mirrors LiveLessonOntologyService (phase 3 m1
    // code-review): SolutionToolkitRegistry is uuid-keyed, so passing
    // the slug here would dead-code the entire path.
    const tenant = await this.solutions.findOne(LIVE_LESSON_TENANT_SLUG);
    if (!tenant) {
      this.logger.warn(
        `Tenant slug "${LIVE_LESSON_TENANT_SLUG}" not provisioned at boot — ` +
          'skipping lifecycle observation registration. Action registers once the tenant row exists.',
      );
      return;
    }

    // Ensure LessonSession manifest is registered. Phase 3's
    // LiveLessonOntologyService registers it on the SAME registry, but
    // we register defensively here so M2 stays revertible without
    // requiring phase 3 to be active.
    if (!this.registry.getManifest('LessonSession')) {
      this.registry.registerManifest(LessonSessionManifest);
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

    this.engine.registerTrigger(JOIN_TRIGGER_DEF);

    this.logger.log(
      `Lifecycle observation registered: ActionDef ` +
        `"${WORKFLOW_ACTION_NAMESPACE}.${RECORD_LIFECYCLE_OBSERVATION_ACTION.apiName}" + ` +
        `TriggerDef "${JOIN_TRIGGER_DEF.apiName}" (solutionId=${tenant.id}).`,
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
