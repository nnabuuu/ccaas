import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ObserveType } from '../../../domain/shared/observe-handler.interface';
import type { ObserveHandler, ObserveContext } from '../../../domain/shared/observe-handler.interface';
import type { DiscussObserveData } from '../../../schemas/classroom/observe-data';
import { ChatMessage } from '../../../adapters/persistence/entities/chat-message.entity';
import { ClusterAggregator } from '../../../domain/discussion/cluster-aggregator';
import { ManifestCacheService } from '../../../application/classroom/manifest-cache.service';
import { Lesson } from '../../../adapters/persistence/entities/lesson.entity';
import { buildTaskMap } from '../../../domain/classroom/task-map.utils';

@Injectable()
@ObserveType('discuss')
export class DiscussObserveHandler implements ObserveHandler {
  private readonly logger = new Logger(DiscussObserveHandler.name);

  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepo: Repository<ChatMessage>,
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
    private readonly clusterAggregator: ClusterAggregator,
    private readonly manifestCache: ManifestCacheService,
  ) {}

  async compute(ctx: ObserveContext): Promise<DiscussObserveData> {
    if (ctx.answerKey && ctx.answerKey.type !== 'quiz') {
      throw new Error(`DiscussObserveHandler expects quiz answerKey, got ${ctx.answerKey.type}`);
    }
    const totalStudents = ctx.students.length;

    const threadId = `discuss:${ctx.stepIdx}`;
    const messages = await this.chatMessageRepo.find({
      where: { sessionId: ctx.sessionId, threadId },
      order: { seq: 'ASC' },
    });

    const msgsByStudent = new Map<string, typeof messages>();
    for (const m of messages) {
      if (!msgsByStudent.has(m.studentId)) msgsByStudent.set(m.studentId, []);
      msgsByStudent.get(m.studentId)!.push(m);
    }

    let discussedCount = 0;
    let goalReachedCount = 0;
    let fallbackCount = 0;
    let totalRounds = 0;
    let totalTime = 0;
    let timeCount = 0;
    const timesArr: number[] = [];

    const studentResults: DiscussObserveData['students'] = [];

    for (const student of ctx.students) {
      const msgs = msgsByStudent.get(student.id);
      if (!msgs || msgs.length === 0) continue;

      discussedCount++;
      const studentMsgs = msgs.filter(m => m.role === 'student' || m.role === 'user');
      const rounds = studentMsgs.length;
      totalRounds += rounds;

      const lastMsg = msgs[msgs.length - 1];
      let goalReached = false;
      let completionType: DiscussObserveData['students'][0]['completionType'] = '';
      const method: 'socratic' | 'fallback' = 'socratic';

      if (lastMsg.content?.includes('goal_reached')) {
        goalReached = true;
        completionType = 'goal_reached';
      } else if (lastMsg.content?.includes('fallback_time')) {
        completionType = 'fallback_time';
        fallbackCount++;
      } else if (lastMsg.content?.includes('fallback')) {
        completionType = 'fallback_rounds';
        fallbackCount++;
      }

      if (goalReached) goalReachedCount++;

      const first = msgs[0].createdAt instanceof Date ? msgs[0].createdAt.getTime() : new Date(msgs[0].createdAt).getTime();
      const last = lastMsg.createdAt instanceof Date ? lastMsg.createdAt.getTime() : new Date(lastMsg.createdAt).getTime();
      const timeUsed = (last - first) / 1000;
      if (timeUsed > 0) { totalTime += timeUsed; timeCount++; timesArr.push(timeUsed); }

      const conversation = msgs.map(m => ({
        role: (m.role === 'student' || m.role === 'user' ? 'student' : 'ai') as 'ai' | 'student',
        text: m.content,
      }));

      const insights: string[] = [];
      if (goalReached) insights.push('达成讨论目标');
      if (rounds <= 2) insights.push('对话轮次较少');

      studentResults.push({
        id: student.id,
        name: student.name,
        method,
        goalReached,
        roundsUsed: rounds,
        timeUsedSeconds: timeUsed,
        completionType,
        conversation,
        keyInsights: insights,
      });
    }

    // Median time
    timesArr.sort((a, b) => a - b);
    const medianTime = timesArr.length > 0
      ? timesArr.length % 2 === 1
        ? timesArr[Math.floor(timesArr.length / 2)]
        : (timesArr[timesArr.length / 2 - 1] + timesArr[timesArr.length / 2]) / 2
      : 0;

    const goalReachedRate = discussedCount > 0 ? goalReachedCount / discussedCount : 0;

    // Cluster coverage
    let clusterCoverage: DiscussObserveData['clusterCoverage'];
    try {
      const manifest = await this.manifestCache.getManifest(ctx.lessonId, this.lessonRepo);
      if (manifest) {
        const taskMap = buildTaskMap(manifest);
        const taskNum = taskMap.stepToTask[ctx.stepIdx];
        const readingSteps: any[] = manifest.readingSteps || [];
        const stepDef = readingSteps.find((s: any) => s.idx === ctx.stepIdx);
        const clusterDefs: Array<{ id: string; label: string }> = stepDef?.discuss?.clusters || [];

        if (taskNum != null && clusterDefs.length > 0) {
          const hitCounts = new Map<string, number>();
          for (const def of clusterDefs) hitCounts.set(def.id, 0);

          let totalStudentHitRate = 0;
          for (const sr of studentResults) {
            sr.clusterHits = this.clusterAggregator.getStudentClusters(
              ctx.sessionId, taskNum, sr.id, clusterDefs,
            );
            let studentHits = 0;
            for (const h of sr.clusterHits) {
              if (h.hit) {
                hitCounts.set(h.id, (hitCounts.get(h.id) || 0) + 1);
                studentHits++;
              }
            }
            totalStudentHitRate += studentHits / clusterDefs.length;
          }

          const classCoverage = clusterDefs.map(def => ({
            clusterId: def.id,
            label: def.label,
            hitCount: hitCounts.get(def.id) || 0,
            hitRate: discussedCount > 0 ? (hitCounts.get(def.id) || 0) / discussedCount : 0,
          }));

          clusterCoverage = {
            definitions: clusterDefs.map(d => ({ ...d })),
            classCoverage,
            overallRate: discussedCount > 0 ? totalStudentHitRate / discussedCount : 0,
          };
        }
      }
    } catch (err) {
      this.logger.warn('Cluster coverage computation failed, skipping', err);
    }

    return {
      stats: {
        totalStudents,
        discussedCount,
        goalReachedCount,
        avgRounds: discussedCount > 0 ? totalRounds / discussedCount : 0,
        avgTime: timeCount > 0 ? totalTime / timeCount : 0,
        fallbackCount,
        medianTime,
        goalReachedRate,
      },
      ...(clusterCoverage ? { clusterCoverage } : {}),
      students: studentResults,
    };
  }
}
