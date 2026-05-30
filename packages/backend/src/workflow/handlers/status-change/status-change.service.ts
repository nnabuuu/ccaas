/**
 * `StatusChangeService` — phase 5 M4. Second LLM-driven workflow
 * handler. Replaces the legacy `StatusChangeHandler` in
 * `solutions/business/live-lesson/backend/src/adapters/observer-engine/handlers/status-change-handler.ts`
 * (slated for deletion in m6).
 *
 * Cascade target: fires when ChatTurnService publishes
 * `student_observation_changed` to the LessonSession.events stream.
 * In-process from the action handler's publish call → ManifestAccessor
 * subscriber router → event trigger predicate filter on type === 'student_observation_changed'.
 *
 * What it does:
 *   1. read all observations for the student
 *   2. compute derived metrics (knowledge/misconception counts,
 *      exerciseCorrectRate, messageCount, lastActiveAt)
 *   3. derive status: LLM if a gateway is available, else heuristic
 *      (active/struggling/stuck/cruising/idle)
 *   4. write or update the student_status observation row
 *   5. on transition to an alertable status (stuck/struggling/idle),
 *      publish a student_alerts stream event (subscribers are the
 *      future SSE bridge — m4 second commit punts on the actual
 *      SSE adapter; the publish goes to ManifestAccessor)
 *
 * The legacy StatusChangeHandler was 370 lines including SSE plumbing.
 * This M4 first-cut deliberately omits the SSE wire — the pattern
 * is proven by the publish call, and m5 picks up the dashboard
 * frontend rewrite anyway.
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
import type { Observation } from '@kedge-agentic/observer-engine';
import { SolutionsService } from '../../../solutions/solutions.service';
import { compileActionToToolDefinition } from '../../../ontology/action-to-tool-definition';
import { LessonSessionManifest } from '../../../ontology/live-lesson/lesson-session.manifest';
import { ManifestAccessorService } from '../../../ontology/manifest-accessor.service';
import { ONTOLOGY_REGISTRY } from '../../../ontology/ontology-registry.provider';
import { SolutionToolkitRegistry } from '../../../tool-caller/solution-toolkit-registry';
import type {
  ToolInvocation,
  ToolResult,
} from '../../../tool-caller/types';
import { ObservationRepository } from '../../persistence/observation-repository';
import { WorkflowEngineService } from '../../workflow-engine.service';
import type { TriggerDef, TriggerFireInput } from '../../types';
import { LIVE_LESSON_TENANT_SLUG } from '../constants';
import {
  IndicatorRegistryService,
  type IndicatorDef,
} from '../../llm/indicator-registry.service';
import { LLM_GATEWAY, type LlmGateway } from '../../llm/llm-gateway';

const WORKFLOW_STATUS_NAMESPACE = 'workflow-actions-status';

export type StudentStatus = 'active' | 'struggling' | 'stuck' | 'cruising' | 'idle';

const ALERTABLE_STATUSES: ReadonlySet<StudentStatus> = new Set([
  'stuck',
  'struggling',
  'idle',
]);
const SEVERITY_MAP: Record<StudentStatus, 'info' | 'warn' | 'urgent' | null> = {
  stuck: 'urgent',
  struggling: 'warn',
  idle: 'info',
  active: null,
  cruising: null,
};

// Heuristic thresholds — same as legacy StatusChangeHandler.
const IDLE_THRESHOLD_MS = 180_000;
const STRUGGLE_EVENT_COUNT = 3;
const CRUISING_CORRECT_RATE = 80;
const CRUISING_MAX_MESSAGES = 2;

const DeriveStatusArgsSchema = z.object({
  entityId: z.string().min(1),
  trigger: z.string().min(1),
  triggerEventId: z.string().min(1),
});

const DERIVE_STUDENT_STATUS_ACTION: ActionDef = defineAction({
  apiName: 'derive_student_status',
  displayName: '推导学生状态 / Derive Student Status',
  semantic:
    'Workflow-internal cascade action: re-derive a student\'s status from their accumulated observations + publish an alert if the status is alertable.',
  params: DeriveStatusArgsSchema,
  sideEffects: [
    'observation:append',
    'observation:update',
    'emits:student_alerts',
  ],
  allowedRoles: ['admin'],
  auditLevel: 'log',
});

const STUDENT_OBSERVATION_CHANGED_TRIGGER_DEF: TriggerDef = {
  apiName: 'on_student_observation_changed_derive_status',
  manifest: 'LessonSession',
  semantic:
    'cascade trigger: when ChatTurnService publishes student_observation_changed, re-derive the student\'s status.',
  kind: 'event',
  watch: { stream: 'events' },
  when: (input: TriggerFireInput) => {
    const payload = input.event?.payload as { type?: string } | undefined;
    return payload?.type === 'student_observation_changed';
  },
  then: {
    action: `${WORKFLOW_STATUS_NAMESPACE}.derive_student_status`,
    args: (input: TriggerFireInput) => {
      const payload = input.event?.payload as {
        studentId: string;
        trigger: string;
      };
      return {
        entityId: payload.studentId,
        trigger: payload.trigger,
        triggerEventId: input.cascade.correlationId,
      };
    },
    as: 'admin',
  },
};

interface DerivedStatusResult {
  status: StudentStatus;
  summary: string;
  alertMessage: string | null;
}

interface ComputedMetrics {
  messageCount: number;
  misconceptionCount: number;
  knowledgeCount: number;
  exerciseCorrectRate: number;
  lastActiveAt: number;
}

@Injectable()
export class StatusChangeService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StatusChangeService.name);

  constructor(
    @Inject(ONTOLOGY_REGISTRY) private readonly registry: OntologyRegistry,
    private readonly observations: ObservationRepository,
    private readonly solutions: SolutionsService,
    private readonly toolkits: SolutionToolkitRegistry,
    private readonly engine: WorkflowEngineService,
    private readonly indicators: IndicatorRegistryService,
    private readonly accessor: ManifestAccessorService,
    @Inject(LLM_GATEWAY) private readonly llm: LlmGateway,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const tenant = await this.solutions.findOne(LIVE_LESSON_TENANT_SLUG);
    if (!tenant) {
      this.logger.warn(
        `Tenant "${LIVE_LESSON_TENANT_SLUG}" not provisioned; skipping status-change registration.`,
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
      DERIVE_STUDENT_STATUS_ACTION,
      (inv: ToolInvocation): Promise<ToolResult> => this.handle(inv),
      LessonSessionManifest,
    );
    this.toolkits.registerToolkit({
      solutionId: tenant.id,
      namespace: WORKFLOW_STATUS_NAMESPACE,
      tools: [tool],
    });
    this.engine.registerTrigger(STUDENT_OBSERVATION_CHANGED_TRIGGER_DEF);
    this.logger.log(
      `Status-change derivation registered (solutionId=${tenant.id}).`,
    );
  }

  private async handle(invocation: ToolInvocation): Promise<ToolResult> {
    const args = invocation.args as z.infer<typeof DeriveStatusArgsSchema>;
    const sessionId = invocation.context.sessionId;
    const solutionId = invocation.context.solutionId;

    const observations = await this.observations.getByEntity(sessionId, args.entityId);
    if (observations.length === 0) {
      return ok('no observations; skip');
    }

    const existingStatus = observations.find((o) => o.type === 'student_status');
    const previousStatus =
      (existingStatus?.data as { status?: StudentStatus } | undefined)?.status ?? null;

    const metrics = computeMetrics(observations);
    const indicators = this.indicators.getIndicators(solutionId, sessionId);
    const { status, summary, alertMessage } = await this.deriveStatus({
      observations,
      indicators,
      metrics,
      trigger: args.trigger,
      previousStatus,
    });

    const statusData = {
      status,
      previousStatus,
      ...metrics,
      summary,
      alertMessage,
    };

    if (existingStatus) {
      await this.observations.update(existingStatus.id, { data: statusData });
    } else {
      const now = Date.now();
      await this.observations.append({
        id: uuidv4(),
        sessionId,
        entityId: args.entityId,
        solutionId,
        type: 'student_status',
        data: statusData,
        triggerEventId: args.triggerEventId,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (status !== previousStatus && ALERTABLE_STATUSES.has(status)) {
      this.accessor.publish(sessionId, 'student_alerts', {
        studentId: args.entityId,
        status,
        previousStatus,
        severity: SEVERITY_MAP[status],
        message: alertMessage ?? `Status changed to ${status}`,
        timestamp: Date.now(),
      });
    }

    return ok(`status=${status}, alertable=${ALERTABLE_STATUSES.has(status)}`);
  }

  private async deriveStatus(opts: {
    observations: readonly Observation[];
    indicators: readonly IndicatorDef[];
    metrics: ComputedMetrics;
    trigger: string;
    previousStatus: StudentStatus | null;
  }): Promise<DerivedStatusResult> {
    // Try LLM first if there are indicators to reason about.
    if (opts.indicators.length > 0) {
      const llmResult = await this.tryLlmStatusDerivation(opts);
      if (llmResult) return llmResult;
    }
    return this.heuristicStatus(opts);
  }

  /**
   * Try LLM derivation. The prompt only enumerates active/struggling/
   * stuck/cruising — `idle` is intentionally heuristic-only because the
   * LLM has no wall-clock context. See `heuristicStatus` for the
   * IDLE_THRESHOLD_MS path.
   */
  private async tryLlmStatusDerivation(opts: {
    observations: readonly Observation[];
    indicators: readonly IndicatorDef[];
    metrics: ComputedMetrics;
    trigger: string;
    previousStatus: StudentStatus | null;
  }): Promise<DerivedStatusResult | null> {
    const indicatorHits = opts.observations
      .filter((o) => o.type === 'indicator_hit')
      .slice(-10); // last 10
    const indicatorDefs = opts.indicators
      .map((a) => `${a.id} [${a.type}] ${a.label}`)
      .join('\n');
    const hitsSummary = indicatorHits
      .map((h) => {
        const d = h.data as { anchors?: string[]; gist?: string };
        return `[${(d.anchors ?? []).join(',')}] ${d.gist ?? ''}`;
      })
      .join('\n') || '(none)';

    const system = `You are a classroom observation assistant. Derive a student's current status from their indicator hits + metrics.

INDICATORS:
${indicatorDefs}

RECENT INDICATOR HITS:
${hitsSummary}

METRICS:
- messageCount: ${opts.metrics.messageCount}
- knowledgeCount: ${opts.metrics.knowledgeCount}
- misconceptionCount: ${opts.metrics.misconceptionCount}
- exerciseCorrectRate: ${opts.metrics.exerciseCorrectRate}%

PREVIOUS STATUS: ${opts.previousStatus ?? 'unknown'}
TRIGGER: ${opts.trigger}

Respond with JSON only:
{
  "status": "active" | "struggling" | "stuck" | "cruising",
  "summary": "one-sentence summary",
  "alertMessage": "alert text (when struggling/stuck) or null"
}`;

    let raw: string;
    try {
      raw = await this.llm.chat(
        [
          { role: 'system', content: system },
          { role: 'user', content: 'Derive the status.' },
        ],
        { responseFormat: 'json', temperature: 0.2, maxTokens: 256 },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`LLM status derivation failed; using heuristic. cause=${msg}`);
      return null;
    }
    let parsed: { status?: string; summary?: string; alertMessage?: string | null };
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.warn(`LLM status JSON invalid; using heuristic`);
      return null;
    }
    if (
      parsed.status !== 'active' &&
      parsed.status !== 'struggling' &&
      parsed.status !== 'stuck' &&
      parsed.status !== 'cruising'
    ) {
      return null;
    }
    return {
      status: parsed.status,
      summary: parsed.summary ?? '',
      alertMessage: parsed.alertMessage ?? null,
    };
  }

  /**
   * Heuristic fallback when LLM unavailable or fails. Same thresholds
   * the legacy StatusChangeHandler used internally as its safety net.
   */
  private heuristicStatus(opts: {
    observations: readonly Observation[];
    metrics: ComputedMetrics;
    trigger: string;
  }): DerivedStatusResult {
    const { metrics } = opts;
    const sinceLastActive = Date.now() - metrics.lastActiveAt;
    if (sinceLastActive > IDLE_THRESHOLD_MS) {
      return { status: 'idle', summary: 'Student inactive', alertMessage: 'Student appears idle' };
    }
    if (metrics.misconceptionCount >= STRUGGLE_EVENT_COUNT) {
      return {
        status: 'struggling',
        summary: `${metrics.misconceptionCount} misconception signals observed`,
        alertMessage: 'Multiple misconceptions detected',
      };
    }
    if (
      metrics.exerciseCorrectRate >= CRUISING_CORRECT_RATE &&
      metrics.messageCount <= CRUISING_MAX_MESSAGES
    ) {
      return { status: 'cruising', summary: 'High accuracy, low engagement', alertMessage: null };
    }
    return { status: 'active', summary: 'Engaged and progressing', alertMessage: null };
  }
}

/**
 * Student-activity event types. `lastActiveAt` is derived from these
 * ONLY — pass-1 review MF2: including `student_status` (which this
 * service itself mutates on every cascade) means its `updatedAt` jumps
 * to now on every derivation, so `sinceLastActive ≈ 0` and the `idle`
 * heuristic becomes unreachable. Including `lifecycle` would mix join
 * pings into "active" signal which the legacy dashboard doesn't count.
 */
const ACTIVITY_TYPES: ReadonlySet<string> = new Set([
  'indicator_hit',
  'exercise',
  'progress',
]);

function computeMetrics(observations: readonly Observation[]): ComputedMetrics {
  let messageCount = 0;
  let misconceptionCount = 0;
  let knowledgeCount = 0;
  const scores: number[] = [];
  let lastActiveAt = 0;
  for (const obs of observations) {
    // Pass-1 review MF3: use createdAt (the event's wall-clock time),
    // NOT updatedAt (which jumps when this service overwrites the
    // student_status row). Aligns with the metric the M5.2 dashboard
    // exposes — see `DashboardStudentMetrics.lastActiveAt` JSDoc.
    if (ACTIVITY_TYPES.has(obs.type) && obs.createdAt > lastActiveAt) {
      lastActiveAt = obs.createdAt;
    }
    if (obs.type === 'indicator_hit') {
      messageCount += 1;
      const anchors = (obs.data as { anchors?: string[] }).anchors ?? [];
      for (const a of anchors) {
        if (a.startsWith('M')) misconceptionCount += 1;
        else if (a.startsWith('K')) knowledgeCount += 1;
      }
    } else if (obs.type === 'exercise') {
      const score = (obs.data as { score?: number }).score;
      if (typeof score === 'number') scores.push(score);
    }
  }
  const exerciseCorrectRate =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
  return {
    messageCount,
    misconceptionCount,
    knowledgeCount,
    exerciseCorrectRate,
    lastActiveAt: lastActiveAt > 0 ? lastActiveAt : Date.now(),
  };
}

function ok(text: string): ToolResult {
  return {
    ok: true,
    content: [{ type: 'text', text: JSON.stringify({ recorded: 'student_status', detail: text }) }],
  };
}
