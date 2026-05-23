import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiPromptBuilder } from '../ai/ai-prompt-builder';
import { DiscussHighlight } from '../../entities/discuss-highlight.entity';
import { DiscussTargetHit } from '../../entities/discuss-target-hit.entity';
import { ChatMessage } from '../../entities/chat-message.entity';
import { ClassroomSession } from '../../entities/classroom-session.entity';
import type { DepthLeaderboard } from '../../schemas/classroom/depth-ranking';

interface StudentDepthScore {
  studentId: string;
  studentName: string;
  highlightCount: number;
  tpHitCount: number;
  messageCount: number;
  score: number;
}

@Injectable()
export class DepthRankingService {
  private readonly logger = new Logger(DepthRankingService.name);

  private leaderboardCache = new Map<string, DepthLeaderboard>();
  private summaryCache = new Map<string, Map<string, { summary: string; messageCount: number }>>();
  private sessionStartedAt = new Map<string, number>();
  private pending = new Set<string>();
  private lastRefreshAt = new Map<string, number>();
  private readonly THROTTLE_MS = 30_000;
  private readonly WARMUP_MS = 5 * 60 * 1000;

  constructor(
    private readonly aiPromptBuilder: AiPromptBuilder,
    @InjectRepository(DiscussHighlight) private readonly highlightRepo: Repository<DiscussHighlight>,
    @InjectRepository(DiscussTargetHit) private readonly targetHitRepo: Repository<DiscussTargetHit>,
    @InjectRepository(ChatMessage) private readonly chatMessageRepo: Repository<ChatMessage>,
    @InjectRepository(ClassroomSession) private readonly sessionRepo: Repository<ClassroomSession>,
  ) {}

  getCached(sessionId: string): DepthLeaderboard | null {
    return this.leaderboardCache.get(sessionId) ?? null;
  }

  async maybeRefresh(sessionId: string): Promise<void> {
    const now = Date.now();

    // Throttle
    const lastRefresh = this.lastRefreshAt.get(sessionId) ?? 0;
    if (now - lastRefresh < this.THROTTLE_MS) return;

    // Warmup: skip first 5 minutes after session start
    let startedAt = this.sessionStartedAt.get(sessionId);
    if (startedAt === undefined) {
      const session = await this.sessionRepo.findOne({ where: { id: sessionId }, select: ['startedAt'] });
      startedAt = session?.startedAt ? new Date(session.startedAt).getTime() : now;
      this.sessionStartedAt.set(sessionId, startedAt);
    }
    if (now - startedAt < this.WARMUP_MS) return;

    // Prevent concurrent refresh
    if (this.pending.has(sessionId)) return;
    this.pending.add(sessionId);

    try {
      const top5 = await this.computeScores(sessionId);
      if (top5.length === 0) {
        this.lastRefreshAt.set(sessionId, now);
        return;
      }

      // Per-student cache check: find students needing summary refresh
      if (!this.summaryCache.has(sessionId)) {
        this.summaryCache.set(sessionId, new Map());
      }
      const studentCache = this.summaryCache.get(sessionId)!;

      const needsRefresh: StudentDepthScore[] = [];
      for (const student of top5) {
        const cached = studentCache.get(student.studentId);
        if (!cached || cached.messageCount !== student.messageCount) {
          needsRefresh.push(student);
        }
      }

      // Generate summaries only for students with new messages
      if (needsRefresh.length > 0) {
        const newSummaries = await this.generateSummaries(sessionId, needsRefresh);
        for (const student of needsRefresh) {
          const summary = newSummaries[student.studentId];
          if (summary) {
            studentCache.set(student.studentId, {
              summary,
              messageCount: student.messageCount,
            });
          }
        }
      }

      // Build leaderboard from top5 + cached summaries
      const rankings = top5.map((s, i) => ({
        studentId: s.studentId,
        studentName: s.studentName,
        rank: i + 1,
        score: s.score,
        highlightCount: s.highlightCount,
        tpHitCount: s.tpHitCount,
        aiSummary: studentCache.get(s.studentId)?.summary ?? null,
      }));

      this.leaderboardCache.set(sessionId, { rankings, generatedAt: now });
      this.lastRefreshAt.set(sessionId, now);
    } catch (e) {
      this.logger.warn(`Depth ranking refresh failed for session ${sessionId}`, e instanceof Error ? e.stack : e);
    } finally {
      this.pending.delete(sessionId);
    }
  }

  cleanupSession(sessionId: string): void {
    this.leaderboardCache.delete(sessionId);
    this.summaryCache.delete(sessionId);
    this.sessionStartedAt.delete(sessionId);
    this.pending.delete(sessionId);
    this.lastRefreshAt.delete(sessionId);
  }

  // ── Private ──

  private async computeScores(sessionId: string): Promise<StudentDepthScore[]> {
    const [highlightRows, tpHitRows, msgRows] = await Promise.all([
      this.highlightRepo
        .createQueryBuilder('h')
        .select('h.studentId', 'studentId')
        .addSelect('h.studentName', 'studentName')
        .addSelect('COUNT(*)', 'cnt')
        .where('h.sessionId = :sessionId', { sessionId })
        .groupBy('h.studentId')
        .addGroupBy('h.studentName')
        .getRawMany<{ studentId: string; studentName: string; cnt: string }>(),

      this.targetHitRepo
        .createQueryBuilder('t')
        .select('t.studentId', 'studentId')
        .addSelect('t.studentName', 'studentName')
        .addSelect('COUNT(*)', 'cnt')
        .where('t.sessionId = :sessionId', { sessionId })
        .groupBy('t.studentId')
        .addGroupBy('t.studentName')
        .getRawMany<{ studentId: string; studentName: string; cnt: string }>(),

      this.chatMessageRepo
        .createQueryBuilder('m')
        .select('m.studentId', 'studentId')
        .addSelect('COUNT(*)', 'cnt')
        .where('m.sessionId = :sessionId', { sessionId })
        .andWhere('m.role = :role', { role: 'user' })
        .andWhere('m.threadId LIKE :prefix', { prefix: 'discuss-%' })
        .groupBy('m.studentId')
        .getRawMany<{ studentId: string; cnt: string }>(),
    ]);

    // Merge into a single map — seed from all three sources
    const byStudent = new Map<string, StudentDepthScore>();

    const ensureEntry = (id: string, name?: string): StudentDepthScore => {
      let entry = byStudent.get(id);
      if (!entry) {
        entry = { studentId: id, studentName: name ?? id, highlightCount: 0, tpHitCount: 0, messageCount: 0, score: 0 };
        byStudent.set(id, entry);
      }
      if (name && entry.studentName === id) entry.studentName = name;
      return entry;
    };

    for (const row of highlightRows) {
      const e = ensureEntry(row.studentId, row.studentName);
      e.highlightCount = Number(row.cnt);
    }

    for (const row of tpHitRows) {
      const e = ensureEntry(row.studentId, row.studentName);
      e.tpHitCount = Number(row.cnt);
    }

    for (const row of msgRows) {
      const e = ensureEntry(row.studentId);
      e.messageCount = Number(row.cnt);
    }

    // Compute scores and sort
    for (const s of byStudent.values()) {
      s.score = s.highlightCount * 3 + s.tpHitCount * 2;
    }

    return Array.from(byStudent.values())
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  private async generateSummaries(
    sessionId: string,
    students: StudentDepthScore[],
  ): Promise<Record<string, string>> {
    try {
      // Gather per-student highlight gists and target point info (parallelized)
      const studentDataParts = await Promise.all(
        students.map(async (s) => {
          const [highlights, tpHits] = await Promise.all([
            this.highlightRepo.find({
              where: { sessionId, studentId: s.studentId },
              select: ['gist'],
              order: { detectedAt: 'DESC' },
              take: 3,
            }),
            this.targetHitRepo.find({
              where: { sessionId, studentId: s.studentId },
              select: ['targetPointId'],
            }),
          ]);

          const gists = highlights.map(h => h.gist).join('；');
          const tps = tpHits.map(t => t.targetPointId).join('、');

          return `学生 ${s.studentName} (ID: ${s.studentId}): 深度亮点=${s.highlightCount}, 触及要点=${s.tpHitCount}, ` +
            `讨论消息=${s.messageCount}, 亮点摘要=[${gists}], 触及要点ID=[${tps}]`;
        }),
      );

      const systemPrompt = `你是教学分析助手。根据学生的讨论深度数据，为每位学生生成一句简短的正向评价（≤30字）。

要求：
- 语气鼓励、肯定，突出学生做得好的方面
- 不要使用"缺乏""不足""较低""欠缺"等负面词汇
- 如果学生参与度暂时不高，聚焦于他们已有的尝试或潜力
- 适合在课堂大屏投放，让学生看到后受到激励

学生数据：
${studentDataParts.join('\n')}

输出纯 JSON：{"summaries":{"studentId":"评价",...}}`;

      const raw = await this.aiPromptBuilder.callLlm(systemPrompt, '请生成学生评价', {
        responseFormat: { type: 'json_object' },
        maxTokens: 300,
        temperature: 0.3,
      });

      const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*\n?|\n?```\s*$/g, '').trim());
      const result: Record<string, string> = {};
      if (parsed.summaries && typeof parsed.summaries === 'object') {
        for (const [id, val] of Object.entries(parsed.summaries)) {
          if (typeof val === 'string' && val.trim()) {
            result[id] = val as string;
          }
        }
      }
      return result;
    } catch (e) {
      this.logger.warn(`Depth summary generation failed for session ${sessionId}`, e instanceof Error ? e.stack : e);
      return {};
    }
  }
}
