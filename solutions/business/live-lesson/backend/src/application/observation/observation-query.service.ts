import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ObservationRecord } from '@kedge-agentic/observer-engine';
import type { Observation } from '@kedge-agentic/observer-engine';
import type {
  StudentLog,
  StudentEvent,
  Alert,
  IndicatorStats,
  IndicatorDef,
  StudentObsStatus,
} from '../../schemas/classroom/observation';

const IDLE_THRESHOLD_MS = 180_000;
const RECENT_WINDOW_MS = 300_000;
const STRUGGLE_EVENT_COUNT = 3;
const CRUISING_CORRECT_RATE = 80;
const CRUISING_MAX_MESSAGES = 2;
const PROGRESS_INDICATOR_MIN = 2;

@Injectable()
export class ObservationQueryService {
  private readonly logger = new Logger(ObservationQueryService.name);
  private readonly sessionIndicators = new Map<string, IndicatorDef[]>();

  constructor(
    @InjectRepository(ObservationRecord)
    private readonly observationRepo: Repository<ObservationRecord>,
  ) {}

  setIndicators(sessionId: string, indicators: IndicatorDef[]): void {
    this.sessionIndicators.set(sessionId, indicators);
  }

  clearSession(sessionId: string): void {
    this.sessionIndicators.delete(sessionId);
  }

  async getObservationDashboard(sessionId: string): Promise<{
    logs: StudentLog[];
    alerts: Alert[];
    indicatorStats: IndicatorStats[];
  }> {
    const byStudent = await this.loadGroupedObservations(sessionId);
    return {
      logs: this.buildStudentLogs(byStudent),
      alerts: this.buildAlerts(sessionId, byStudent),
      indicatorStats: await this.computeIndicatorStats(sessionId),
    };
  }

  async getStudentLogs(sessionId: string): Promise<StudentLog[]> {
    const byStudent = await this.loadGroupedObservations(sessionId);
    return this.buildStudentLogs(byStudent);
  }

  private async loadGroupedObservations(sessionId: string): Promise<Map<string, Observation[]>> {
    const records = await this.observationRepo.find({
      where: { sessionId },
      order: { createdAtEpoch: 'ASC' },
    });

    const byStudent = new Map<string, Observation[]>();
    for (const r of records) {
      const obs = toObservation(r);
      if (!byStudent.has(obs.entityId)) byStudent.set(obs.entityId, []);
      byStudent.get(obs.entityId)!.push(obs);
    }
    return byStudent;
  }

  private buildStudentLogs(byStudent: Map<string, Observation[]>): StudentLog[] {

    const logs: StudentLog[] = [];
    for (const [studentId, observations] of byStudent) {
      const statusObs = observations.find(o => o.type === 'student_status');
      const statusData = statusObs?.data as Record<string, unknown> | undefined;

      const events: StudentEvent[] = [];
      let eventCounter = 0;

      for (const obs of observations) {
        if (obs.type === 'student_status') continue;

        eventCounter++;
        const data = obs.data as Record<string, unknown>;

        if (obs.type === 'indicator_hit') {
          events.push({
            id: `e${eventCounter}`,
            timestamp: obs.createdAt,
            updatedAt: obs.updatedAt,
            anchors: (data.anchors as string[]) || [],
            gist: (data.gist as string) || '',
            quote: (data.quote as string) || null,
            source: 'llm',
          });
        } else if (obs.type === 'lifecycle') {
          const action = (data.action as string) || 'unknown';
          const studentName = (data.studentName as string) || studentId;
          events.push({
            id: `e${eventCounter}`,
            timestamp: obs.createdAt,
            updatedAt: obs.updatedAt,
            anchors: [],
            gist: action === 'join' ? `${studentName} 加入课堂` : action,
            quote: null,
            source: 'system',
            systemType: action,
            data,
          });
        } else if (obs.type === 'exercise') {
          const score = data.score as number | null;
          const step = data.step as number | undefined;
          events.push({
            id: `e${eventCounter}`,
            timestamp: obs.createdAt,
            updatedAt: obs.updatedAt,
            anchors: [],
            gist: `提交 Step ${step ?? '?'} 答案${score != null ? `，得分 ${score}%` : ''}`,
            quote: null,
            source: 'system',
            systemType: 'exercise_result',
            data,
          });
        } else if (obs.type === 'progress') {
          const taskNum = data.taskNum ?? data.step;
          const nextTask = data.nextTask;
          events.push({
            id: `e${eventCounter}`,
            timestamp: obs.createdAt,
            updatedAt: obs.updatedAt,
            anchors: [],
            gist: `完成 Task ${taskNum}，进入 Task ${nextTask}`,
            quote: null,
            source: 'system',
            systemType: 'step_complete',
            data,
          });
        } else {
          events.push({
            id: `e${eventCounter}`,
            timestamp: obs.createdAt,
            updatedAt: obs.updatedAt,
            anchors: [],
            gist: (data.gist as string) || obs.type,
            quote: null,
            source: 'system',
            systemType: obs.type,
            data,
          });
        }
      }

      const exerciseScores = observations
        .filter(o => o.type === 'exercise')
        .map(o => (o.data as { score?: number }).score)
        .filter((s): s is number => s != null);
      const exerciseCorrectRate = exerciseScores.length > 0
        ? Math.round(exerciseScores.reduce((a, b) => a + b, 0) / exerciseScores.length)
        : 0;

      const indicatorHits = observations.filter(o => o.type === 'indicator_hit');
      const messageCount = statusData?.messageCount as number
        ?? indicatorHits.length;

      const lastActiveAt = statusData?.lastActiveAt as number
        ?? (observations.length > 0
          ? observations.reduce((max, o) => o.updatedAt > max ? o.updatedAt : max, 0)
          : Date.now());

      const stepData = observations.find(o => o.type === 'progress');
      const currentStep = (stepData?.data as { step?: number })?.step
        ? `step-${(stepData.data as { step: number }).step}`
        : '';

      // Use studentName from lifecycle join event
      const joinObs = observations.find(o => o.type === 'lifecycle' && (o.data as { action?: string }).action === 'join');
      const studentName = (joinObs?.data as { studentName?: string })?.studentName || studentId;

      logs.push({
        studentId,
        studentName,
        events,
        systemMetrics: {
          messageCount,
          lastActiveAt,
          exerciseCorrectRate,
          currentStep,
        },
      });
    }

    return logs;
  }

  async generateAlerts(sessionId: string): Promise<Alert[]> {
    const byStudent = await this.loadGroupedObservations(sessionId);
    return this.buildAlerts(sessionId, byStudent);
  }

  private buildAlerts(sessionId: string, byStudent: Map<string, Observation[]>): Alert[] {
    const alerts: Alert[] = [];

    for (const [studentId, observations] of byStudent) {
      const statusObs = observations.find(o => o.type === 'student_status');
      const statusData = statusObs?.data as Record<string, unknown> | undefined;
      const status = (statusData?.status as StudentObsStatus) ?? this.deriveStatusFromObservations(observations);
      const alertMessage = statusData?.alertMessage as string | null;

      const joinObs = observations.find(o => o.type === 'lifecycle' && (o.data as { action?: string }).action === 'join');
      const studentName = (joinObs?.data as { studentName?: string })?.studentName || studentId;

      const severityMap: Record<string, 'info' | 'warn' | 'urgent'> = {
        stuck: 'urgent',
        struggling: 'warn',
        idle: 'info',
      };

      if (status === 'stuck' || status === 'struggling' || status === 'idle') {
        const indicatorHits = observations.filter(o => o.type === 'indicator_hit');
        const lastM = [...indicatorHits]
          .reverse()
          .find(o => ((o.data as { anchors?: string[] }).anchors || []).some(a => a.startsWith('M')));
        const indicatorId = lastM
          ? ((lastM.data as { anchors?: string[] }).anchors || []).find(a => a.startsWith('M')) ?? null
          : null;

        const indicators = this.getIndicators(sessionId);
        const indicatorLabel = indicatorId
          ? indicators.find(i => i.id === indicatorId)?.label ?? indicatorId
          : null;

        let message: string;
        if (alertMessage) {
          message = alertMessage;
        } else if (status === 'stuck') {
          message = `${studentName} 遇到持续困难${indicatorLabel ? ` (${indicatorLabel})` : ''}`;
        } else if (status === 'struggling') {
          message = `${studentName} 出现误解信号${indicatorLabel ? ` (${indicatorLabel})` : ''}`;
        } else {
          message = `${studentName} 超过 3 分钟无活动`;
        }

        alerts.push({
          timestamp: statusObs?.updatedAt ?? Date.now(),
          studentName,
          studentId,
          severity: severityMap[status],
          message,
          indicatorId,
        });
      }
    }

    return alerts.sort((a, b) => {
      const order = { urgent: 0, warn: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });
  }

  async computeIndicatorStats(sessionId: string): Promise<IndicatorStats[]> {
    const indicators = this.getIndicators(sessionId);

    const records = await this.observationRepo.find({
      where: { sessionId, type: 'indicator_hit' },
      order: { createdAtEpoch: 'ASC' },
    });

    const statsMap = new Map<string, {
      students: Set<string>;
      latestGist: string;
      updatedAt: number;
    }>();

    for (const ind of indicators) {
      statsMap.set(ind.id, { students: new Set(), latestGist: '', updatedAt: 0 });
    }

    for (const r of records) {
      const data = r.data as { anchors?: string[]; gist?: string };
      const anchors = data.anchors || [];
      const gist = data.gist || '';
      const updatedAt = Number(r.updatedAtEpoch);

      for (const anchor of anchors) {
        const stat = statsMap.get(anchor);
        if (!stat) continue;
        stat.students.add(r.entityId);
        if (updatedAt > stat.updatedAt) {
          stat.latestGist = gist;
          stat.updatedAt = updatedAt;
        }
      }
    }

    return indicators.map(ind => {
      const stat = statsMap.get(ind.id) || { students: new Set(), latestGist: '', updatedAt: 0 };
      return {
        indicatorId: ind.id,
        label: ind.label,
        type: ind.type,
        studentCount: stat.students.size,
        latestGist: stat.latestGist,
        updatedAt: stat.updatedAt,
      };
    });
  }

  getIndicators(sessionId: string): IndicatorDef[] {
    return this.sessionIndicators.get(sessionId) || [];
  }

  private deriveStatusFromObservations(observations: Observation[]): StudentObsStatus {
    const now = Date.now();
    const lastActiveAt = observations.length > 0
      ? observations.reduce((max, o) => o.updatedAt > max ? o.updatedAt : max, 0)
      : now;

    if (now - lastActiveAt > IDLE_THRESHOLD_MS) return 'idle';

    const recentHits = observations.filter(
      o => o.type === 'indicator_hit' && now - o.createdAt < RECENT_WINDOW_MS,
    );

    let mCount = 0, kCount = 0;
    for (const hit of recentHits) {
      const anchors = (hit.data as { anchors?: string[] }).anchors || [];
      for (const a of anchors) {
        if (a.startsWith('M')) mCount++;
        if (a.startsWith('K')) kCount++;
      }
    }

    if (mCount >= STRUGGLE_EVENT_COUNT) {
      if (kCount >= PROGRESS_INDICATOR_MIN && kCount > mCount) return 'struggling';
      return 'stuck';
    }
    if (mCount >= 1) {
      if (kCount >= PROGRESS_INDICATOR_MIN && kCount > mCount) return 'active';
      return 'struggling';
    }

    const exercises = observations.filter(o => o.type === 'exercise');
    const scores = exercises
      .map(e => (e.data as { score?: number }).score)
      .filter((s): s is number => s != null);
    const avgScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    const totalHits = observations.filter(o => o.type === 'indicator_hit').length;
    if (avgScore >= CRUISING_CORRECT_RATE && totalHits <= CRUISING_MAX_MESSAGES) return 'cruising';

    return 'active';
  }
}

function toObservation(record: ObservationRecord): Observation {
  return {
    id: record.id,
    sessionId: record.sessionId,
    entityId: record.entityId,
    tenantId: record.tenantId,
    type: record.type,
    data: record.data,
    triggerEventId: record.triggerEventId,
    createdAt: Number(record.createdAtEpoch),
    updatedAt: Number(record.updatedAtEpoch),
  };
}
