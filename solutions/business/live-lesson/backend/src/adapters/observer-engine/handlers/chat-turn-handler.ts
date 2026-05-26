import { Injectable } from '@nestjs/common';
import { ObserverHandler } from '@kedge-agentic/observer-engine';
import type { ObserverEvent, HandlerContext, HandlerResult } from '@kedge-agentic/observer-engine';
import type { IndicatorDef } from '../../../schemas/classroom/observation';

interface LlmOutput {
  action: 'skip' | 'update' | 'append';
  updateTarget?: string;
  anchors: string[];
  gist: string;
  quote: string | null;
}

@Injectable()
export class ChatTurnHandler {
  @ObserverHandler('chat_turn')
  async handle(event: ObserverEvent, ctx: HandlerContext): Promise<HandlerResult> {
    const meta = ctx.getSessionMeta() as { indicators?: IndicatorDef[] } | undefined;
    const indicators = meta?.indicators;
    if (!indicators || indicators.length === 0) {
      return { observations: [] };
    }

    const { student, ai } = event.payload as { student: string; ai: string };
    if (!student || !ai) {
      ctx.logger.warn('ChatTurnHandler: missing student or ai in payload');
      return { observations: [] };
    }

    const existing = await ctx.getObservations(event.entityId);
    const indicatorHits = existing.filter(o => o.type === 'indicator_hit');

    const indicatorDefs = indicators
      .map(a => `${a.id} [${a.type}] ${a.label}: ${a.description}`)
      .join('\n');

    const eventLog = indicatorHits.length > 0
      ? indicatorHits.map(o => {
          const d = o.data as { anchors?: string[]; gist?: string };
          return `${o.id}: [${(d.anchors || []).join(',')}] ${d.gist || ''}`;
        }).join('\n')
      : '(empty)';

    const systemPrompt = `You are an observation assistant for a teacher. Extract factual observations from student dialogue.

INDICATORS:
${indicatorDefs}

EXISTING EVENT LOG:
${eventLog}

LATEST TURN:
Student: ${student}
AI: ${ai}

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

    let result: LlmOutput;
    try {
      const raw = await ctx.llm.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Analyze the latest turn.' },
        ],
        { responseFormat: 'json', temperature: 0.3, maxTokens: 256 },
      );
      result = JSON.parse(raw) as LlmOutput;
    } catch (e) {
      ctx.logger.warn(`ChatTurnHandler LLM call failed: ${e}`);
      return { observations: [] };
    }

    // Validate LLM output
    if (!['skip', 'update', 'append'].includes(result.action)) {
      ctx.logger.warn(`ChatTurnHandler: unexpected action "${result.action}", treating as skip`);
      return { observations: [] };
    }
    if (!Array.isArray(result.anchors)) result.anchors = [];
    if (typeof result.gist !== 'string') result.gist = '';

    // Filter to valid indicator IDs only — prevents hallucinated or injected IDs
    const validIds = new Set(indicators.map(a => a.id));
    result.anchors = result.anchors.filter(a => validIds.has(a));

    if (result.action === 'skip') {
      return { observations: [] };
    }

    const observations: HandlerResult['observations'] = [];

    if (result.action === 'update' && result.updateTarget) {
      const target = indicatorHits.find(o => o.id === result.updateTarget);
      if (target) {
        observations.push({
          op: 'update',
          observationId: target.id,
          patch: {
            data: {
              anchors: result.anchors,
              gist: result.gist,
              quote: result.quote,
              action: 'update',
            },
          },
        });
      }
      if (!target) {
        ctx.logger.warn(`ChatTurnHandler: updateTarget "${result.updateTarget}" not found, falling back to append`);
      }
    }

    if (observations.length === 0) {
      observations.push({
        op: 'append' as const,
        observation: {
          entityId: event.entityId,
          type: 'indicator_hit',
          data: {
            anchors: result.anchors,
            gist: result.gist,
            quote: result.quote,
            action: 'append',
          },
          triggerEventId: event.id,
        },
      });
    }

    return {
      observations,
      emit: [
        {
          type: 'student_observation_changed',
          sessionId: event.sessionId,
          entityId: event.entityId,
          solutionId: event.solutionId,
          payload: { trigger: 'chat_turn' },
        },
      ],
    };
  }
}
