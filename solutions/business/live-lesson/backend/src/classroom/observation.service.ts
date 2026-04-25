import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ObservationEvent } from '../entities/observation-event.entity';

interface ObservationAnchor {
  id: string;
  type: 'knowledge' | 'misconception';
  label: string;
  description: string;
  signals: string[];
}

interface StudentEvent {
  id: string;
  timestamp: number;
  updatedAt: number;
  anchors: string[];
  gist: string;
  quote: string | null;
  source: 'llm' | 'system';
  systemType?: string;
  data?: Record<string, unknown>;
}

interface StudentLog {
  studentId: string;
  studentName: string;
  events: StudentEvent[];
  systemMetrics: {
    messageCount: number;
    lastActiveAt: number;
    exerciseCorrectRate: number;
    currentStep: string;
  };
}

type StudentObsStatus = 'active' | 'struggling' | 'stuck' | 'idle' | 'cruising';

interface Alert {
  timestamp: number;
  studentName: string;
  studentId: string;
  severity: 'info' | 'warn' | 'urgent';
  message: string;
  anchorId: string | null;
}

interface AnchorStats {
  anchorId: string;
  label: string;
  type: 'knowledge' | 'misconception';
  studentCount: number;
  latestGist: string;
  updatedAt: number;
}

interface GLMObserverOutput {
  action: 'skip' | 'update' | 'append';
  updateTarget?: string;
  anchors: string[];
  gist: string;
  quote: string | null;
}

// ── Threshold constants ──
const IDLE_THRESHOLD_MS = 180_000;       // 3 minutes
const RECENT_WINDOW_MS = 300_000;        // 5 minutes
const STRUGGLE_EVENT_COUNT = 3;          // M-anchor events before flagging stuck
const CRUISING_CORRECT_RATE = 80;        // min exerciseCorrectRate for cruising
const CRUISING_MAX_MESSAGES = 2;         // max messages for cruising
const PROGRESS_ANCHOR_MIN = 2;           // min K-anchors for "on-track" (mixed signal)

@Injectable()
export class ObservationService {
  private readonly logger = new Logger(ObservationService.name);

  /** sessionId → studentId → StudentLog */
  private studentLogs = new Map<string, Map<string, StudentLog>>();
  /** sessionId → ObservationAnchor[] */
  private anchorSets = new Map<string, ObservationAnchor[]>();

  constructor(
    @InjectRepository(ObservationEvent)
    private readonly eventRepo: Repository<ObservationEvent>,
    private readonly configService: ConfigService,
  ) {}

  // ── Lifecycle ──

  initSession(sessionId: string, anchors: ObservationAnchor[]): void {
    this.anchorSets.set(sessionId, anchors);
    if (!this.studentLogs.has(sessionId)) {
      this.studentLogs.set(sessionId, new Map());
    }
    this.logger.log(`Observation initialized for session ${sessionId} with ${anchors.length} anchors`);
  }

  async cleanupSession(sessionId: string): Promise<void> {
    // Persist any remaining in-memory events to DB
    const logs = this.studentLogs.get(sessionId);
    if (logs) {
      for (const [studentId, log] of logs) {
        for (const event of log.events) {
          // Upsert: skip if already persisted (check by session+student+eventId)
          const exists = await this.eventRepo.findOne({
            where: { sessionId, studentId, eventId: event.id },
          });
          if (!exists) {
            await this.eventRepo.save(this.eventRepo.create({
              sessionId,
              studentId,
              eventId: event.id,
              anchors: event.anchors,
              gist: event.gist,
              quote: event.quote,
              source: event.source,
              systemType: event.systemType ?? null,
              data: event.data ?? null,
              updatedAt: new Date(event.updatedAt),
            }));
          }
        }
      }
    }
    this.studentLogs.delete(sessionId);
    this.anchorSets.delete(sessionId);
    this.logger.log(`Observation cleaned up for session ${sessionId}`);
  }

  // ── Layer 2: Event Log ──

  async observeTurn(
    sessionId: string,
    studentId: string,
    studentName: string,
    latestTurn: { student: string; ai: string },
    systemContext: { currentStep: string; exerciseCorrectRate: number; idleSeconds: number },
  ): Promise<void> {
    const anchors = this.anchorSets.get(sessionId);
    if (!anchors || anchors.length === 0) return;

    const log = this.ensureStudentLog(sessionId, studentId, studentName);

    // Update system metrics
    log.systemMetrics.messageCount++;
    log.systemMetrics.lastActiveAt = Date.now();
    log.systemMetrics.currentStep = systemContext.currentStep;
    log.systemMetrics.exerciseCorrectRate = systemContext.exerciseCorrectRate;

    try {
      const result = await this.callObserverGlm(anchors, log.events, latestTurn);
      if (!result || result.action === 'skip') return;

      const now = Date.now();

      if (result.action === 'update' && result.updateTarget) {
        const target = log.events.find(e => e.id === result.updateTarget);
        if (target) {
          target.anchors = result.anchors;
          target.gist = result.gist;
          target.quote = result.quote;
          target.updatedAt = now;
          // Update in DB
          await this.eventRepo.update(
            { sessionId, studentId, eventId: target.id },
            { anchors: result.anchors, gist: result.gist, quote: result.quote, updatedAt: new Date(now) },
          );
        }
      } else {
        // append
        const eventId = `e${log.events.length + 1}`;
        const event: StudentEvent = {
          id: eventId,
          timestamp: now,
          updatedAt: now,
          anchors: result.anchors,
          gist: result.gist,
          quote: result.quote,
          source: 'llm',
        };
        log.events.push(event);
        // Persist
        await this.eventRepo.save(this.eventRepo.create({
          sessionId,
          studentId,
          eventId,
          anchors: result.anchors,
          gist: result.gist,
          quote: result.quote,
          source: 'llm',
          systemType: null,
          data: null,
          updatedAt: new Date(now),
        }));
      }
    } catch (e) {
      this.logger.warn(`observeTurn GLM call failed: ${e}`);
    }
  }

  async addSystemEvent(
    sessionId: string,
    studentId: string,
    studentName: string,
    type: 'exercise_result' | 'idle_timeout' | 'step_complete' | 'join' | 'leave',
    data: Record<string, unknown>,
    gist: string,
  ): Promise<void> {
    const log = this.ensureStudentLog(sessionId, studentId, studentName);
    const now = Date.now();
    const eventId = `e${log.events.length + 1}`;

    const event: StudentEvent = {
      id: eventId,
      timestamp: now,
      updatedAt: now,
      anchors: [],
      gist,
      quote: null,
      source: 'system',
      systemType: type,
      data,
    };
    log.events.push(event);

    // Update system metrics
    log.systemMetrics.lastActiveAt = now;
    if (type === 'exercise_result' && typeof data.score === 'number') {
      log.systemMetrics.exerciseCorrectRate = data.score;
    }

    // Synchronous DB persist (awaited)
    await this.eventRepo.save(this.eventRepo.create({
      sessionId,
      studentId,
      eventId,
      anchors: [],
      gist,
      quote: null,
      source: 'system',
      systemType: type,
      data,
      updatedAt: new Date(now),
    }));
  }

  // ── Layer 3: Surface ──

  getStudentLogs(sessionId: string): StudentLog[] {
    const logs = this.studentLogs.get(sessionId);
    if (!logs) return [];
    return Array.from(logs.values());
  }

  getAnchors(sessionId: string): ObservationAnchor[] {
    return this.anchorSets.get(sessionId) || [];
  }

  deriveStatus(log: StudentLog): StudentObsStatus {
    const now = Date.now();

    if (now - log.systemMetrics.lastActiveAt > IDLE_THRESHOLD_MS) {
      return 'idle';
    }

    const recentEvents = log.events.filter(e => now - e.timestamp < RECENT_WINDOW_MS);
    const misconceptions = recentEvents.filter(e =>
      e.anchors.some(a => a.startsWith('M')),
    );
    const knowledgeEvents = recentEvents.filter(e =>
      e.anchors.some(a => a.startsWith('K')),
    );

    // Mixed signal handling: K-anchors can counterbalance M-anchors
    if (misconceptions.length >= STRUGGLE_EVENT_COUNT) {
      // If enough K-anchors outweigh misconceptions, downgrade to struggling
      if (knowledgeEvents.length >= PROGRESS_ANCHOR_MIN && knowledgeEvents.length > misconceptions.length) {
        return 'struggling';
      }
      return 'stuck';
    }
    if (misconceptions.length >= 1) {
      // If strong K-anchor presence counterbalances, treat as active
      if (knowledgeEvents.length >= PROGRESS_ANCHOR_MIN && knowledgeEvents.length > misconceptions.length) {
        return 'active';
      }
      return 'struggling';
    }

    if (log.systemMetrics.exerciseCorrectRate >= CRUISING_CORRECT_RATE && log.systemMetrics.messageCount <= CRUISING_MAX_MESSAGES) {
      return 'cruising';
    }

    return 'active';
  }

  generateAlerts(sessionId: string): Alert[] {
    const logs = this.studentLogs.get(sessionId);
    if (!logs) return [];

    const alerts: Alert[] = [];
    const now = Date.now();

    for (const log of logs.values()) {
      const status = this.deriveStatus(log);

      if (status === 'stuck') {
        const lastMisconception = [...log.events]
          .reverse()
          .find(e => e.anchors.some(a => a.startsWith('M')));
        const anchorId = lastMisconception?.anchors.find(a => a.startsWith('M')) ?? null;
        const anchorLabel = anchorId ? this.getAnchorLabel(sessionId, anchorId) : '';
        alerts.push({
          timestamp: now,
          studentName: log.studentName,
          studentId: log.studentId,
          severity: 'urgent',
          message: `${log.studentName} 连续遇到困难${anchorLabel ? `（${anchorLabel}）` : ''}`,
          anchorId,
        });
      } else if (status === 'struggling') {
        const lastMisconception = [...log.events]
          .reverse()
          .find(e => e.anchors.some(a => a.startsWith('M')));
        const anchorId = lastMisconception?.anchors.find(a => a.startsWith('M')) ?? null;
        alerts.push({
          timestamp: now,
          studentName: log.studentName,
          studentId: log.studentId,
          severity: 'warn',
          message: `${log.studentName} 出现误解信号`,
          anchorId,
        });
      } else if (status === 'idle') {
        const idleMinutes = Math.round(IDLE_THRESHOLD_MS / 60_000);
        alerts.push({
          timestamp: now,
          studentName: log.studentName,
          studentId: log.studentId,
          severity: 'info',
          message: `${log.studentName} 超过 ${idleMinutes} 分钟无活动`,
          anchorId: null,
        });
      }
    }

    return alerts.sort((a, b) => {
      const severity = { urgent: 0, warn: 1, info: 2 };
      return severity[a.severity] - severity[b.severity];
    });
  }

  computeAnchorStats(sessionId: string): AnchorStats[] {
    const anchors = this.anchorSets.get(sessionId);
    const logs = this.studentLogs.get(sessionId);
    if (!anchors || !logs) return [];

    return anchors.map(anchor => {
      let studentCount = 0;
      let latestGist = '';
      let latestTime = 0;

      for (const log of logs.values()) {
        const matchingEvents = log.events.filter(e => e.anchors.includes(anchor.id));
        if (matchingEvents.length > 0) {
          studentCount++;
          const latest = matchingEvents.reduce((a, b) => a.updatedAt > b.updatedAt ? a : b);
          if (latest.updatedAt > latestTime) {
            latestTime = latest.updatedAt;
            latestGist = latest.gist;
          }
        }
      }

      return {
        anchorId: anchor.id,
        label: anchor.label,
        type: anchor.type,
        studentCount,
        latestGist,
        updatedAt: latestTime,
      };
    });
  }

  // ── Private helpers ──

  private ensureStudentLog(sessionId: string, studentId: string, studentName: string): StudentLog {
    let sessionLogs = this.studentLogs.get(sessionId);
    if (!sessionLogs) {
      sessionLogs = new Map();
      this.studentLogs.set(sessionId, sessionLogs);
    }

    let log = sessionLogs.get(studentId);
    if (!log) {
      log = {
        studentId,
        studentName,
        events: [],
        systemMetrics: {
          messageCount: 0,
          lastActiveAt: Date.now(),
          exerciseCorrectRate: 0,
          currentStep: '',
        },
      };
      sessionLogs.set(studentId, log);
    }
    return log;
  }

  private getAnchorLabel(sessionId: string, anchorId: string): string {
    const anchors = this.anchorSets.get(sessionId);
    return anchors?.find(a => a.id === anchorId)?.label ?? '';
  }

  private async callObserverGlm(
    anchors: ObservationAnchor[],
    existingEvents: StudentEvent[],
    latestTurn: { student: string; ai: string },
  ): Promise<GLMObserverOutput | null> {
    const apiKey = this.configService.get<string>('ZHIPU_API_KEY');
    if (!apiKey) return null;

    const model = this.configService.get<string>('ZHIPU_OBSERVER_MODEL') || 'glm-4-flash';

    const anchorDefs = anchors.map(a => `${a.id} [${a.type}] ${a.label}: ${a.description}`).join('\n');
    const eventLog = existingEvents.length > 0
      ? existingEvents.map(e => `${e.id}: [${e.anchors.join(',')}] ${e.gist}`).join('\n')
      : '(empty)';

    const systemPrompt = `You are an observation assistant for a teacher. Extract factual observations from student dialogue.

ANCHORS:
${anchorDefs}

EXISTING EVENT LOG:
${eventLog}

LATEST TURN:
Student: ${latestTurn.student}
AI: ${latestTurn.ai}

Respond with JSON only:
{
  "action": "skip" | "update" | "append",
  "updateTarget": "e1" (only if action=update),
  "anchors": ["K1", "M2"],
  "gist": "one-sentence factual observation",
  "quote": "exact student quote or null"
}

Rules:
- "skip" if the turn has no observable learning signal
- "update" if the turn refines an existing event (same anchor, new info)
- "append" if the turn shows a new observation
- anchors: only IDs from the list above
- gist: factual, no judgement, max 30 words
- quote: exact student words, or null`;

    try {
      const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Analyze the latest turn.' },
          ],
          max_tokens: 256,
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(`Observer GLM error ${res.status}: ${text}`);
        return null;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) return null;

      return JSON.parse(content) as GLMObserverOutput;
    } catch (e) {
      this.logger.warn(`Observer GLM parse error: ${e}`);
      return null;
    }
  }
}
