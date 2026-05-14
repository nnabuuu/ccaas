import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiPromptBuilder } from './ai-prompt-builder';
import { DiscussHighlight } from '../entities/discuss-highlight.entity';
import type { DiscussionHighlight, CoachingStateInput, CoachingInsight } from '../schemas/classroom/coaching';

@Injectable()
export class CoachingService {
  private readonly logger = new Logger(CoachingService.name);

  // sessionId → highlights (newest first)
  private highlights = new Map<string, DiscussionHighlight[]>();

  // sessionId → cached LLM insight
  private insightCache = new Map<string, { data: CoachingInsight; updatedAt: number }>();
  private pending = new Set<string>();
  private readonly THROTTLE_MS = 30_000;

  constructor(
    private readonly aiPromptBuilder: AiPromptBuilder,
    @InjectRepository(DiscussHighlight) private readonly highlightRepo: Repository<DiscussHighlight>,
  ) {}

  // ── Highlight management ──

  addHighlight(sessionId: string, h: Omit<DiscussionHighlight, 'detectedAt'>): void {
    const now = Date.now();
    if (!this.highlights.has(sessionId)) {
      this.highlights.set(sessionId, []);
    }
    const list = this.highlights.get(sessionId)!;
    list.push({ ...h, detectedAt: now });
    if (list.length > 100) list.splice(0, list.length - 100);
    this.logger.log(`Highlight detected for ${h.studentName} in session ${sessionId}: ${h.gist}`);

    // Persist to DB (fire-and-forget)
    this.highlightRepo.upsert(
      {
        sessionId, studentId: h.studentId, studentName: h.studentName,
        taskNum: h.taskNum, clusterId: h.clusterId,
        message: h.message, gist: h.gist, evidenceSpan: h.evidenceSpan,
        detectedAt: now,
      },
      ['sessionId', 'studentId', 'taskNum', 'clusterId'],
    ).catch(e => this.logger.warn('Failed to persist highlight', e));
  }

  async getHighlights(sessionId: string): Promise<DiscussionHighlight[]> {
    const cached = this.highlights.get(sessionId);
    if (cached) return cached;

    // Restore from DB
    const rows = await this.highlightRepo.find({
      where: { sessionId },
      order: { detectedAt: 'ASC' },
    });
    if (rows.length > 0) {
      const restored = rows.map(r => ({
        studentId: r.studentId, studentName: r.studentName,
        taskNum: r.taskNum, clusterId: r.clusterId,
        message: r.message, gist: r.gist, evidenceSpan: r.evidenceSpan,
        detectedAt: Number(r.detectedAt),
      }));
      this.highlights.set(sessionId, restored);
      return restored;
    }
    return [];
  }

  // ── LLM Insight management ──

  getCached(sessionId: string): CoachingInsight | null {
    const entry = this.insightCache.get(sessionId);
    return entry ? entry.data : null;
  }

  async maybeRefresh(sessionId: string, stateSnapshot: CoachingStateInput): Promise<void> {
    const now = Date.now();
    const lastUpdate = this.insightCache.get(sessionId)?.updatedAt ?? 0;
    if (now - lastUpdate < this.THROTTLE_MS) return;
    if (this.pending.has(sessionId)) return;

    this.pending.add(sessionId);
    try {
      const insight = await this.generateInsight(sessionId, stateSnapshot);
      if (insight) {
        this.insightCache.set(sessionId, { data: insight, updatedAt: now });
      }
    } finally {
      this.pending.delete(sessionId);
    }
  }

  cleanupSession(sessionId: string): void {
    this.highlights.delete(sessionId);
    this.insightCache.delete(sessionId);
    this.pending.delete(sessionId);
  }

  // ── Private ──

  private async generateInsight(
    sessionId: string,
    state: CoachingStateInput,
  ): Promise<CoachingInsight | null> {
    try {
      const { stepMetrics, healthCards, observation } = state;

      const highlights = await this.getHighlights(sessionId);
      const recentHighlightGists = highlights.slice(-3).map(h => h.gist);

      // Build a compact summary for the LLM
      const metricsSummary: string[] = [];
      if (stepMetrics) {
        for (const [taskNum, sm] of Object.entries(stepMetrics)) {
          const parts: string[] = [`Step ${taskNum}`];
          if (sm.alertTag) parts.push(`alert: ${sm.alertTag}`);
          if (sm.issues?.length) parts.push(`issues: ${sm.issues.join('; ')}`);
          if (sm.byDimension) {
            const dims = Object.entries(sm.byDimension)
              .filter(([, v]) => {
                const total = v.good + v.partial + v.wrong;
                return total > 0 && v.wrong / total > 0.3;
              })
              .map(([dim, v]) => {
                const total = v.good + v.partial + v.wrong;
                return `${dim}: ${Math.round((v.wrong / total) * 100)}%错误`;
              });
            if (dims.length) parts.push(`weak: ${dims.join(', ')}`);
          }
          if (parts.length > 1) metricsSummary.push(parts.join(' | '));
        }
      }

      const contextParts: string[] = [];
      if (metricsSummary.length) contextParts.push(`STEP METRICS:\n${metricsSummary.join('\n')}`);
      if (healthCards?.stuck?.count) contextParts.push(`STUCK: ${healthCards.stuck.count} students`);
      if (healthCards?.median?.step) contextParts.push(`MEDIAN PROGRESS: ${healthCards.median.step}`);
      if (recentHighlightGists.length) contextParts.push(`RECENT HIGHLIGHTS:\n${recentHighlightGists.map(g => `- ${g}`).join('\n')}`);
      if (observation?.indicatorStats?.length) {
        const topMisconceptions = observation.indicatorStats
          .filter(s => s.type === 'misconception')
          .sort((a, b) => b.studentCount - a.studentCount)
          .slice(0, 3);
        if (topMisconceptions.length) {
          contextParts.push(`TOP MISCONCEPTIONS:\n${topMisconceptions.map(m => `- ${m.label} (${m.studentCount}人)`).join('\n')}`);
        }
      }

      if (contextParts.length === 0) return null;

      const systemPrompt = `你是教学教练助手。根据以下课堂实时数据，生成 1-3 条教学建议。

CLASSROOM DATA:
${contextParts.join('\n\n')}

每条建议包含：
- title: 简短标题（≤10字）
- detail: 具体情况描述（1-2句）
- suggestedAction: 建议教师采取的行动（1句）

输出纯 JSON：{"insights": [{"title": "...", "detail": "...", "suggestedAction": "..."}]}`;

      const raw = await this.aiPromptBuilder.callLlm(systemPrompt, '请生成教学建议', {
        responseFormat: { type: 'json_object' },
        maxTokens: 500,
        temperature: 0.3,
      });

      const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*\n?|\n?```\s*$/g, '').trim());
      if (!Array.isArray(parsed.insights)) return null;

      return {
        insights: parsed.insights.slice(0, 3).map((i: any) => ({
          title: typeof i.title === 'string' ? i.title : '',
          detail: typeof i.detail === 'string' ? i.detail : '',
          suggestedAction: typeof i.suggestedAction === 'string' ? i.suggestedAction : '',
        })),
        generatedAt: Date.now(),
      };
    } catch (e) {
      this.logger.warn(`Coaching insight generation failed for session ${sessionId}`, e instanceof Error ? e.stack : e);
      return null;
    }
  }
}
