import { Injectable } from '@nestjs/common';
import { ObserverHandler } from '@kedge-agentic/observer-engine';
import type { ObserverEvent, HandlerContext, HandlerResult, Observation } from '@kedge-agentic/observer-engine';
import type { StudentObsStatus, IndicatorDef } from '../../../schemas/classroom/observation';

type LlmEligibleStatus = 'active' | 'struggling' | 'stuck' | 'cruising';

interface LlmStatusOutput {
  status: LlmEligibleStatus;
  summary: string;
  alertMessage: string | null;
}

const IDLE_THRESHOLD_MS = 180_000;
const RECENT_WINDOW_MS = 300_000;
const STRUGGLE_EVENT_COUNT = 3;
const CRUISING_CORRECT_RATE = 80;
const CRUISING_MAX_MESSAGES = 2;
const PROGRESS_INDICATOR_MIN = 2;

const VALID_LLM_STATUSES = new Set<string>(['active', 'struggling', 'stuck', 'cruising']);
const ALERTABLE_STATUSES: StudentObsStatus[] = ['stuck', 'struggling', 'idle'];
const SEVERITY_MAP: Record<string, 'info' | 'warn' | 'urgent'> = {
  stuck: 'urgent',
  struggling: 'warn',
  idle: 'info',
};

@Injectable()
export class StatusChangeHandler {
  @ObserverHandler('student_observation_changed')
  async handle(event: ObserverEvent, ctx: HandlerContext): Promise<HandlerResult> {
    const observations = await ctx.getObservations(event.entityId);

    // Find existing student_status observation (for previousStatus + LLM context)
    const existingStatus = observations.find(o => o.type === 'student_status');
    const existingData = existingStatus?.data as {
      status?: string; summary?: string;
    } | undefined;
    const previousStatus = existingData?.status as StudentObsStatus | undefined;
    const previousSummary = existingData?.summary as string | undefined;

    // Derive status via LLM (with fast paths + fallback)
    const meta = ctx.getSessionMeta() as { indicators?: IndicatorDef[] } | undefined;
    const indicators = meta?.indicators;
    const trigger = (event.payload as { trigger?: string })?.trigger ?? 'unknown';

    const { status, summary, alertMessage } = await this.deriveStatusViaLlm(
      observations, indicators, trigger, previousStatus, previousSummary,
      existingStatus, ctx,
    );

    // Build status data from observations
    const indicatorHits = observations.filter(o => o.type === 'indicator_hit');
    const exercises = observations.filter(o => o.type === 'exercise');

    let misconceptionCount = 0;
    let knowledgeCount = 0;
    for (const hit of indicatorHits) {
      const anchors = (hit.data as { anchors?: string[] }).anchors || [];
      for (const a of anchors) {
        if (a.startsWith('M')) misconceptionCount++;
        if (a.startsWith('K')) knowledgeCount++;
      }
    }

    const exerciseScores = exercises
      .map(e => (e.data as { score?: number }).score)
      .filter((s): s is number => s != null);
    const exerciseCorrectRate = exerciseScores.length > 0
      ? Math.round(exerciseScores.reduce((a, b) => a + b, 0) / exerciseScores.length)
      : 0;

    const messageCount = indicatorHits.length;
    const lastActiveAt = observations.length > 0
      ? observations.reduce((max, o) => o.updatedAt > max ? o.updatedAt : max, 0)
      : Date.now();

    const statusData = {
      status,
      previousStatus: previousStatus ?? null,
      messageCount,
      misconceptionCount,
      knowledgeCount,
      exerciseCorrectRate,
      lastActiveAt,
      summary,
      alertMessage,
    };

    const result: HandlerResult = { observations: [] };

    if (existingStatus) {
      result.observations.push({
        op: 'update',
        observationId: existingStatus.id,
        patch: { data: statusData },
      });
    } else {
      result.observations.push({
        op: 'append' as const,
        observation: {
          entityId: event.entityId,
          type: 'student_status',
          data: statusData,
          triggerEventId: event.id,
        },
      });
    }

    // Push SSE events on status change
    if (status !== previousStatus) {
      ctx.notify(`session:${event.sessionId}:observer_status`, {
        studentId: event.entityId,
        status,
        previousStatus: previousStatus ?? null,
        timestamp: Date.now(),
      });

      if (ALERTABLE_STATUSES.includes(status)) {
        const indicatorId = this.findLastMisconceptionId(indicatorHits);

        ctx.notify(`session:${event.sessionId}:observer_alert`, {
          severity: SEVERITY_MAP[status] ?? 'info',
          message: alertMessage ?? this.buildFallbackAlertMessage(status, event.entityId),
          studentId: event.entityId,
          indicatorId,
        });
      }
    }

    return result;
  }

  /** Main status derivation: fast paths → LLM → rule fallback */
  private async deriveStatusViaLlm(
    observations: Observation[],
    indicators: IndicatorDef[] | undefined,
    trigger: string,
    previousStatus: StudentObsStatus | undefined,
    previousSummary: string | undefined,
    existingStatus: Observation | undefined,
    ctx: HandlerContext,
  ): Promise<{ status: StudentObsStatus; summary: string; alertMessage: string | null }> {
    const now = Date.now();

    // Fast path: idle detection (pure time check, no LLM needed)
    const lastActiveAt = observations.length > 0
      ? observations.reduce((max, o) => o.updatedAt > max ? o.updatedAt : max, 0)
      : now;
    if (now - lastActiveAt > IDLE_THRESHOLD_MS) {
      return { status: 'idle', summary: '超过3分钟无活动', alertMessage: null };
    }

    const indicatorHits = observations.filter(o => o.type === 'indicator_hit');

    // Fast path: cold start (no indicator_hit observations → default active)
    if (indicatorHits.length === 0) {
      return { status: 'active', summary: '刚加入课堂，暂无学习数据', alertMessage: null };
    }

    // Fast path: no indicators defined → rule fallback
    if (!indicators || indicators.length === 0) {
      const status = this.deriveStatusRuleBased(observations);
      return { status, summary: '', alertMessage: null };
    }

    // LLM path: build prompt and call
    try {
      const observationLog = this.formatObservationLog(observations, existingStatus?.updatedAt);
      const prompt = this.buildStatusPrompt(
        indicators, observationLog, trigger, previousStatus, previousSummary,
      );

      const raw = await ctx.llm.chat(
        [
          { role: 'system', content: prompt },
          { role: 'user', content: '请分析该学生当前状态。' },
        ],
        { responseFormat: 'json', temperature: 0.2, maxTokens: 200 },
      );

      const parsed = JSON.parse(raw) as LlmStatusOutput;

      // Validate status enum
      if (!VALID_LLM_STATUSES.has(parsed.status)) {
        ctx.logger.warn(`StatusChangeHandler: LLM returned invalid status "${parsed.status}", falling back`);
        const status = this.deriveStatusRuleBased(observations);
        return { status, summary: '', alertMessage: null };
      }

      return {
        status: parsed.status,
        summary: typeof parsed.summary === 'string' ? parsed.summary : '',
        alertMessage: typeof parsed.alertMessage === 'string' ? parsed.alertMessage : null,
      };
    } catch (e) {
      ctx.logger.warn(`StatusChangeHandler: LLM call failed: ${e}, using rule fallback`);
      const status = this.deriveStatusRuleBased(observations);
      return { status, summary: '', alertMessage: null };
    }
  }

  /** Format observation log as compact lines with [NEW] markers */
  private formatObservationLog(observations: Observation[], lastStatusUpdatedAt?: number): string {
    const relevantTypes = new Set(['indicator_hit', 'exercise', 'progress', 'step_complete']);
    const relevant = observations
      .filter(o => relevantTypes.has(o.type))
      .sort((a, b) => a.createdAt - b.createdAt);

    if (relevant.length === 0) return '(无观察记录)';

    return relevant.map(o => {
      const isNew = lastStatusUpdatedAt && o.createdAt > lastStatusUpdatedAt;
      const prefix = isNew ? '[NEW]' : '';
      const data = o.data as Record<string, any>;

      if (o.type === 'indicator_hit') {
        const anchors = (data.anchors || []).join(',');
        const gist = data.gist || '';
        return `${prefix}[indicator_hit] indicators:${anchors} "${gist}"`;
      }
      if (o.type === 'exercise') {
        const score = data.score ?? '?';
        const step = data.step ?? '?';
        return `${prefix}[exercise] score:${score} step:${step}`;
      }
      if (o.type === 'step_complete' || o.type === 'progress') {
        const from = data.taskNum ?? '?';
        const to = data.nextTask ?? '?';
        return `${prefix}[progress] task:${from}→${to}`;
      }
      return `${prefix}[${o.type}]`;
    }).join('\n');
  }

  /** Build the Chinese LLM prompt for status derivation */
  private buildStatusPrompt(
    indicators: IndicatorDef[],
    observationLog: string,
    trigger: string,
    previousStatus?: StudentObsStatus,
    previousSummary?: string,
  ): string {
    const indicatorSection = indicators
      .map(a => `${a.id} (${a.type}): ${a.label} — ${a.description}`)
      .join('\n');

    return `你是一个课堂观察助手，负责综合分析一个学生的学习状态。

## 本课观察指标
${indicatorSection}

## 上次评估结果
状态: ${previousStatus ?? '(首次评估)'}
摘要: ${previousSummary ?? '(无)'}

## 该学生的观察记录（按时间排序）
${observationLog}

## 触发本次评估的事件
来源: ${trigger}（chat_turn / exercise_result / step_complete）

## 任务
基于上次评估和新增的观察记录，判断该学生**当前**的学习状态。
注意状态是可以改善的：如果上次是struggling，但新观察到K指标确认，可以回到active。

## 状态定义
- "active": 正常学习中，有互动，无明显困难
- "struggling": 出现误解信号（M指标），但仍在尝试
- "stuck": 反复遇到同一困难，AI纠正后仍无改善
- "cruising": 练习正确率高，几乎不需要AI帮助

## 输出JSON
{
  "status": "active" | "struggling" | "stuck" | "cruising",
  "summary": "一句话概括当前状态（中文，≤40字，引用具体指标标签）",
  "alertMessage": "需要提醒老师的具体情况（中文，≤60字），无需提醒则null"
}

## 判断原则
- M指标反复出现且未见改善 → stuck
- 有M但也有K进展 → struggling（有改善迹象则回到active）
- 练习高分 + AI互动少 → cruising
- 有互动无M → active
- alertMessage仅在struggling/stuck时提供，要说明**具体是哪个指标的什么问题**
- summary必须比上次更具体，不要重复上次的摘要`;
  }

  /** Rule-based fallback (preserved from original implementation) */
  private deriveStatusRuleBased(observations: Observation[]): StudentObsStatus {
    const now = Date.now();

    const lastActiveAt = observations.length > 0
      ? observations.reduce((max, o) => o.updatedAt > max ? o.updatedAt : max, 0)
      : now;

    if (now - lastActiveAt > IDLE_THRESHOLD_MS) {
      return 'idle';
    }

    const recentIndicatorHits = observations.filter(
      o => o.type === 'indicator_hit' && now - o.createdAt < RECENT_WINDOW_MS,
    );

    let misconceptionCount = 0;
    let knowledgeCount = 0;
    for (const hit of recentIndicatorHits) {
      const anchors = (hit.data as { anchors?: string[] }).anchors || [];
      for (const a of anchors) {
        if (a.startsWith('M')) misconceptionCount++;
        if (a.startsWith('K')) knowledgeCount++;
      }
    }

    if (misconceptionCount >= STRUGGLE_EVENT_COUNT) {
      if (knowledgeCount >= PROGRESS_INDICATOR_MIN && knowledgeCount > misconceptionCount) {
        return 'struggling';
      }
      return 'stuck';
    }
    if (misconceptionCount >= 1) {
      if (knowledgeCount >= PROGRESS_INDICATOR_MIN && knowledgeCount > misconceptionCount) {
        return 'active';
      }
      return 'struggling';
    }

    const exercises = observations.filter(o => o.type === 'exercise');
    const scores = exercises
      .map(e => (e.data as { score?: number }).score)
      .filter((s): s is number => s != null);
    const avgScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    const totalIndicatorHits = observations.filter(o => o.type === 'indicator_hit').length;

    if (avgScore >= CRUISING_CORRECT_RATE && totalIndicatorHits <= CRUISING_MAX_MESSAGES) {
      return 'cruising';
    }

    return 'active';
  }

  private findLastMisconceptionId(indicatorHits: Observation[]): string | null {
    const lastMisconception = [...indicatorHits]
      .reverse()
      .find(o => {
        const anchors = (o.data as { anchors?: string[] }).anchors || [];
        return anchors.some(a => a.startsWith('M'));
      });
    return lastMisconception
      ? ((lastMisconception.data as { anchors?: string[] }).anchors || []).find(a => a.startsWith('M')) ?? null
      : null;
  }

  private buildFallbackAlertMessage(status: StudentObsStatus, studentId: string): string {
    switch (status) {
      case 'stuck':
        return `${studentId} 连续遇到困难`;
      case 'struggling':
        return `${studentId} 出现误解信号`;
      case 'idle':
        return `${studentId} 超过 3 分钟无活动`;
      default:
        return `${studentId} status: ${status}`;
    }
  }
}
