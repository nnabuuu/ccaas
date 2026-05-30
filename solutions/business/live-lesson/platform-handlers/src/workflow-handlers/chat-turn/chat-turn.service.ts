/**
 * `ChatTurnService` — phase 5 M4. The first LLM-driven workflow
 * handler. Replaces the legacy `ChatTurnHandler` in
 * `solutions/business/live-lesson/backend/src/adapters/observer-engine/handlers/chat-turn-handler.ts`.
 *
 * What it does end-to-end:
 *   1. `chat_turn` event arrives on `LessonSession.events` stream
 *   2. `ChatTurnTrigger` matches → fires `classify_chat_turn_indicators`
 *      action with the event payload (student/ai text + session indicators)
 *   3. action handler reads prior `indicator_hit` observations for the
 *      student via `ObservationRepository.getByEntity`
 *   4. handler calls LLM (`LlmGateway.chat`) with a prompt covering
 *      indicators + existing observations + current turn
 *   5. parses LLM JSON output (action: skip/update/append)
 *   6. depending on action, appends OR updates an `indicator_hit`
 *      observation row
 *   7. publishes a `student_observation_changed` stream event so the
 *      M4 StatusChangeHandler can re-derive status (cascade, in-process)
 *
 * LLM failure handling: any throw inside the LLM call → log + skip
 * (matches legacy behavior). Bad JSON → skip. Invalid action → skip.
 *
 * Tests use a fake `LlmGateway` to return canned strings — no real
 * OpenAI calls under jest.
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
import { LIVE_LESSON_TENANT_SLUG } from '../../constants';
import {
  IndicatorRegistryService,
  type IndicatorDef,
} from '@kedge-agentic/backend/workflow/llm/indicator-registry.service';
import { LLM_GATEWAY, type LlmGateway } from '@kedge-agentic/backend/workflow/llm/llm-gateway';

const WORKFLOW_CHAT_TURN_NAMESPACE = 'workflow-actions-chat-turn';

const ClassifyChatTurnArgsSchema = z.object({
  entityId: z.string().min(1),
  student: z.string(),
  ai: z.string(),
  triggerEventId: z.string().min(1),
});

const CLASSIFY_CHAT_TURN_ACTION: ActionDef = defineAction({
  apiName: 'classify_chat_turn_indicators',
  displayName: '分类对话轮次指标 / Classify Chat Turn Indicators',
  semantic:
    'Workflow-internal LLM action: classify a student↔AI chat turn against session indicators + append/update an indicator_hit observation.',
  params: ClassifyChatTurnArgsSchema,
  sideEffects: ['observation:append', 'observation:update', 'emits:student_observation_changed'],
  allowedRoles: ['admin'],
  auditLevel: 'log',
});

const CHAT_TURN_TRIGGER_DEF: TriggerDef = {
  apiName: 'on_chat_turn_classify_indicators',
  manifest: 'LessonSession',
  semantic:
    'when a chat_turn event arrives on LessonSession.events, LLM-classify it against session indicators + write an indicator_hit observation.',
  kind: 'event',
  watch: { stream: 'events' },
  when: (input: TriggerFireInput) => {
    const payload = input.event?.payload as { type?: string } | undefined;
    return payload?.type === 'chat_turn';
  },
  then: {
    action: `${WORKFLOW_CHAT_TURN_NAMESPACE}.classify_chat_turn_indicators`,
    args: (input: TriggerFireInput) => {
      const payload = input.event?.payload as {
        studentId: string;
        student: string;
        ai: string;
      };
      return {
        entityId: payload.studentId,
        student: payload.student,
        ai: payload.ai,
        triggerEventId: input.cascade.correlationId,
      };
    },
    as: 'admin',
  },
};

interface LlmOutput {
  action: 'skip' | 'update' | 'append';
  updateTarget?: string;
  anchors: string[];
  gist: string;
  quote: string | null;
}

@Injectable()
export class ChatTurnService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ChatTurnService.name);

  constructor(
    @Inject(ONTOLOGY_REGISTRY) private readonly registry: OntologyRegistry,
    private readonly observations: ObservationRepository,
    private readonly solutions: SolutionsService,
    private readonly toolkits: SolutionToolkitRegistry,
    private readonly engine: WorkflowEngineService,
    private readonly indicators: IndicatorRegistryService,
    @Inject(LLM_GATEWAY) private readonly llm: LlmGateway,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const tenant = await this.solutions.findOne(LIVE_LESSON_TENANT_SLUG);
    if (!tenant) {
      this.logger.warn(
        `Tenant "${LIVE_LESSON_TENANT_SLUG}" not provisioned; skipping chat-turn registration.`,
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
      CLASSIFY_CHAT_TURN_ACTION,
      (inv: ToolInvocation): Promise<ToolResult> => this.handle(inv),
      LessonSessionManifest,
    );
    this.toolkits.registerToolkit({
      solutionId: tenant.id,
      namespace: WORKFLOW_CHAT_TURN_NAMESPACE,
      tools: [tool],
    });
    this.engine.registerTrigger(CHAT_TURN_TRIGGER_DEF);
    this.logger.log(
      `Chat-turn classifier registered (solutionId=${tenant.id}).`,
    );
  }

  private async handle(invocation: ToolInvocation): Promise<ToolResult> {
    const args = invocation.args as z.infer<typeof ClassifyChatTurnArgsSchema>;
    const sessionId = invocation.context.sessionId;
    const solutionId = invocation.context.solutionId;

    const indicators = this.indicators.getIndicators(solutionId, sessionId);
    if (indicators.length === 0) {
      return ok('no indicators registered; skip');
    }
    if (!args.student || !args.ai) {
      this.logger.warn('chat_turn missing student or ai text — skip');
      return ok('missing dialogue; skip');
    }

    // Read prior indicator_hit observations for this student so the LLM
    // can decide append vs update.
    const existing = await this.observations.getByEntity(sessionId, args.entityId);
    const indicatorHits = existing.filter((o) => o.type === 'indicator_hit');

    const llmOutput = await this.classifyWithLlm({
      student: args.student,
      ai: args.ai,
      indicators,
      existing: indicatorHits.map((o) => ({
        id: o.id,
        data: o.data as { anchors?: string[]; gist?: string },
      })),
    });
    if (!llmOutput) return ok('LLM call failed; skip');

    const validIds = new Set(indicators.map((a) => a.id));
    llmOutput.anchors = (llmOutput.anchors ?? []).filter((a) => validIds.has(a));

    if (llmOutput.action === 'skip') {
      return ok('classified as skip');
    }

    if (llmOutput.action === 'update' && llmOutput.updateTarget) {
      const target = indicatorHits.find((o) => o.id === llmOutput.updateTarget);
      if (target) {
        // Pass-1 review SF5: merge with existing row data — the LLM
        // chose `update` because the turn REFINES an existing
        // observation, not because it wants to blank it. Empty
        // anchors/gist/quote from the LLM are treated as "keep prior."
        const prior = (target.data ?? {}) as {
          anchors?: string[];
          gist?: string;
          quote?: string | null;
        };
        const mergedAnchors =
          llmOutput.anchors.length > 0 ? llmOutput.anchors : prior.anchors ?? [];
        const mergedGist = llmOutput.gist || prior.gist || '';
        const mergedQuote =
          llmOutput.quote !== null && llmOutput.quote !== undefined
            ? llmOutput.quote
            : prior.quote ?? null;
        await this.observations.update(target.id, {
          data: {
            anchors: mergedAnchors,
            gist: mergedGist,
            quote: mergedQuote,
            action: 'update',
          },
        });
        await this.cascadeStudentObservationChanged(
          sessionId,
          solutionId,
          args.entityId,
        );
        return ok('indicator_hit updated');
      }
      this.logger.warn(
        `updateTarget "${llmOutput.updateTarget}" not found; falling back to append`,
      );
    }

    const now = Date.now();
    await this.observations.append({
      id: uuidv4(),
      sessionId,
      entityId: args.entityId,
      solutionId,
      type: 'indicator_hit',
      data: {
        anchors: llmOutput.anchors,
        gist: llmOutput.gist,
        quote: llmOutput.quote,
        action: 'append',
      },
      triggerEventId: args.triggerEventId,
      createdAt: now,
      updatedAt: now,
    });
    await this.cascadeStudentObservationChanged(
      sessionId,
      solutionId,
      args.entityId,
    );
    return ok('indicator_hit appended');
  }

  /**
   * Cascade: publish `student_observation_changed` to LessonSession.events
   * so the StatusChangeTrigger fires + re-derives the student's status.
   *
   * Routed through `WorkflowEngineService.cascadeEvent` (NOT the bare
   * `ManifestAccessorService.publish`). Bare `publish` only fans to
   * subscribers and does not re-enter the engine, so event-kind triggers
   * watching the stream never see the cascade — pass-1 review MF1.
   * `cascadeEvent` opens a child cascade frame so depth tracking +
   * ceiling enforcement work across the chain.
   */
  private async cascadeStudentObservationChanged(
    sessionId: string,
    solutionId: string,
    entityId: string,
  ): Promise<void> {
    await this.engine.cascadeEvent({
      sessionId,
      solutionId,
      manifestName: 'LessonSession',
      streamApiName: 'events',
      payload: {
        type: 'student_observation_changed',
        studentId: entityId,
        trigger: 'chat_turn',
      },
    });
  }

  private async classifyWithLlm(opts: {
    student: string;
    ai: string;
    indicators: readonly IndicatorDef[];
    existing: readonly { id: string; data: { anchors?: string[]; gist?: string } }[];
  }): Promise<LlmOutput | null> {
    const indicatorDefs = opts.indicators
      .map((a) => `${a.id} [${a.type}] ${a.label}: ${a.description}`)
      .join('\n');
    const eventLog =
      opts.existing.length > 0
        ? opts.existing
            .map((o) => `${o.id}: [${(o.data.anchors ?? []).join(',')}] ${o.data.gist ?? ''}`)
            .join('\n')
        : '(empty)';

    const systemPrompt = `You are an observation assistant for a teacher. Extract factual observations from student dialogue.

INDICATORS:
${indicatorDefs}

EXISTING EVENT LOG:
${eventLog}

LATEST TURN:
Student: ${opts.student}
AI: ${opts.ai}

Respond with JSON only:
{
  "action": "skip" | "update" | "append",
  "updateTarget": "<observation-id>" (only if action=update),
  "anchors": ["K1", "M2"],
  "gist": "one-sentence factual observation",
  "quote": "exact student quote or null"
}

Rules:
- "skip" if the turn has no observable learning signal
- "update" if the turn refines an existing event (same indicator, new info)
- "append" if the turn shows a new observation
- anchors: only IDs from the indicator list above
- gist: factual, no judgement, max 30 words
- quote: exact student words, or null`;

    let raw: string;
    try {
      raw = await this.llm.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Analyze the latest turn.' },
        ],
        { responseFormat: 'json', temperature: 0.3, maxTokens: 256 },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`LLM call failed: ${msg}`);
      return null;
    }
    let parsed: LlmOutput;
    try {
      parsed = JSON.parse(raw) as LlmOutput;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`LLM response not valid JSON: ${msg}; raw=${raw.slice(0, 100)}`);
      return null;
    }
    if (!['skip', 'update', 'append'].includes(parsed.action)) {
      this.logger.warn(`LLM returned unknown action "${parsed.action}"; skip`);
      return null;
    }
    if (!Array.isArray(parsed.anchors)) parsed.anchors = [];
    if (typeof parsed.gist !== 'string') parsed.gist = '';
    return parsed;
  }
}

function ok(text: string): ToolResult {
  return {
    ok: true,
    content: [{ type: 'text', text: JSON.stringify({ recorded: 'chat_turn', detail: text }) }],
  };
}
