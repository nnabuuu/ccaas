import { Injectable, Inject, Logger, NotFoundException, ConflictException, BadRequestException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { randomInt } from 'crypto';
import { Student } from '../../adapters/persistence/entities/student.entity';
import {
  CLASSROOM_SESSION_REPO_PORT,
  type ClassroomSessionRepoPort,
} from '../../domain/ports/classroom-session-repo.port';
import {
  CHAT_MESSAGE_REPO_PORT,
  type ChatMessageRepoPort,
} from '../../domain/ports/chat-message-repo.port';
import type { ClassroomSessionRecord } from '../../domain/types/classroom-session';
import { ClassroomBroadcastService } from '../../adapters/transport/classroom-broadcast.service';
import { ClassroomStateService } from './classroom-state.service';
import { StateCacheService } from '../../adapters/transport/state-cache.service';
import { Lesson } from '../../adapters/persistence/entities/lesson.entity';
import { OBSERVER_ENGINE, type ObserverEngine } from '@kedge-agentic/observer-engine';
import { TranslateService } from '../ai/translate.service';
import type { Response } from 'express';
import type {
  CreateSessionResponse, SessionInfoResponse, StartSessionResponse,
  EndSessionResponse, BatchCheckItem, SetStepResponse, NotifyResponse,
  SessionListItem, SessionListResponse,
  ClassroomStateResponse, ChatMessageResponse, SnapshotEntry,
} from '../../schemas/classroom';
import type { SessionStatus } from '../../schemas/classroom/session';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 30 chars, no 0/O/1/I/L
const CODE_LENGTH = 6;

@Injectable()
export class ClassroomService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClassroomService.name);
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly configService: ConfigService,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @Inject(CLASSROOM_SESSION_REPO_PORT)
    private readonly sessionRepo: ClassroomSessionRepoPort,
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
    @Inject(CHAT_MESSAGE_REPO_PORT)
    private readonly chatMessageRepo: ChatMessageRepoPort,
    private readonly broadcastService: ClassroomBroadcastService,
    private readonly stateService: ClassroomStateService,
    private readonly stateCache: StateCacheService,
    private readonly translateService: TranslateService,
    @Inject(OBSERVER_ENGINE) private readonly engine: ObserverEngine,
  ) {}

  onModuleInit() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleSessions().catch(e =>
        this.logger.warn(`Stale session cleanup failed: ${e}`),
      );
    }, 5 * 60_000);
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private async cleanupStaleSessions(): Promise<void> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60_000);
    const staleSessions = await this.sessionRepo.findStaleEnded(tenMinutesAgo);
    for (const session of staleSessions) {
      this.stateService.cleanupSession(session.id, session.lessonId);
      this.broadcastService.cleanupSession(session.id);
    }
    if (staleSessions.length > 0) {
      this.logger.log(`Cleaned up ${staleSessions.length} stale session(s)`);
    }
  }

  // ── Session lifecycle ──

  async createSession(lessonId: string): Promise<CreateSessionResponse> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = this.generateCode();
      try {
        const saved = await this.sessionRepo.insert({ code, lessonId, status: 'waiting' });
        this.logger.log(`Session created: ${saved.code} for lesson ${lessonId}`);
        await this.stateService.initObservation(saved.id, lessonId);
        return { sessionId: saved.id, code: saved.code, lessonId: saved.lessonId, status: saved.status };
      } catch (err: any) {
        if (err?.message?.includes('UNIQUE') || err?.code === 'SQLITE_CONSTRAINT') continue;
        throw err;
      }
    }
    throw new ConflictException('Failed to generate unique session code');
  }

  async resolveSession(codeOrId: string): Promise<ClassroomSessionRecord> {
    const session = codeOrId.length > 6
      ? await this.sessionRepo.findById(codeOrId)
      : await this.sessionRepo.findByCode(codeOrId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }

  async resolveActiveSession(code: string): Promise<ClassroomSessionRecord> {
    const session = await this.resolveSession(code);
    if (session.status === 'ended') {
      throw new BadRequestException('Session has ended');
    }
    return session;
  }

  async resolveStartedSession(code: string): Promise<ClassroomSessionRecord> {
    const session = await this.resolveSession(code);
    if (session.status !== 'active') {
      throw new BadRequestException(
        session.status === 'ended' ? 'Session has ended' : 'Session has not started yet',
      );
    }
    return session;
  }

  private sessionInfoKey(code: string) { return `session-info:${code}`; }

  async getSessionInfo(code: string): Promise<SessionInfoResponse> {
    const key = this.sessionInfoKey(code);
    const cached = await this.cache.get<Awaited<ReturnType<ClassroomService['getSessionInfo']>>>(key);
    if (cached) return cached;

    const session = await this.resolveSession(code);
    const result = {
      sessionId: session.id,
      code: session.code,
      lessonId: session.lessonId,
      status: session.status,
      startedAt: session.startedAt,
      createdAt: session.createdAt,
    };
    await this.cache.set(key, result);
    return result;
  }

  async batchCheckSessions(sessionIds: string[], statusFilter?: 'waiting' | 'active'): Promise<BatchCheckItem[]> {
    if (!sessionIds.length) return [];

    const SESSION_TTL_MS = 60 * 60 * 1000; // 60 min
    const cutoff = new Date(Date.now() - SESSION_TTL_MS);

    const statuses: Array<'waiting' | 'active'> = !statusFilter
      ? ['waiting', 'active']
      : [statusFilter];

    const sessions = await this.sessionRepo.findForBatchCheck(sessionIds, statuses, cutoff);
    if (!sessions.length) return [];

    const lessonIds = [...new Set(sessions.map(s => s.lessonId))];
    const lessons = await this.lessonRepo.find({ where: { id: In(lessonIds) } });
    const titleMap = new Map(lessons.map(l => [l.id, l.title]));

    return sessions.map(s => ({
      sessionId: s.id,
      code: s.code,
      lessonId: s.lessonId,
      status: s.status,
      title: titleMap.get(s.lessonId) || s.lessonId,
    }));
  }

  async listSessions(status?: SessionStatus, limit = 50, offset = 0): Promise<SessionListResponse> {
    const [sessions, total] = await this.sessionRepo.findAndCount({ status, limit, offset });
    if (!sessions.length) return { items: [], total };

    const sessionIds = sessions.map(s => s.id);

    // Batch fetch lesson titles
    const lessonIds = [...new Set(sessions.map(s => s.lessonId))];
    const lessons = await this.lessonRepo.find({ where: { id: In(lessonIds) } });
    const titleMap = new Map(lessons.map(l => [l.id, l.title]));

    // Batch count students per session
    const studentCounts: Array<{ sessionId: string; count: string }> = await this.studentRepo
      .createQueryBuilder('s')
      .select('s.sessionId', 'sessionId')
      .addSelect('COUNT(*)', 'count')
      .where('s.sessionId IN (:...ids)', { ids: sessionIds })
      .groupBy('s.sessionId')
      .getRawMany();
    const countMap = new Map(studentCounts.map(r => [r.sessionId, Number(r.count)]));

    const now = Date.now();
    const items: SessionListItem[] = sessions.map(s => {
      let duration: number | null = null;
      if (s.startedAt) {
        const end = s.endedAt ? new Date(s.endedAt).getTime() : now;
        duration = Math.round((end - new Date(s.startedAt).getTime()) / 1000);
      }
      return {
        sessionId: s.id,
        code: s.code,
        lessonId: s.lessonId,
        lessonTitle: titleMap.get(s.lessonId) || s.lessonId,
        status: s.status,
        currentStep: s.currentStep ?? 0,
        studentCount: countMap.get(s.id) || 0,
        duration,
        createdAt: s.createdAt,
        startedAt: s.startedAt ?? null,
        endedAt: s.endedAt ?? null,
      };
    });

    return { items, total };
  }

  async startSession(code: string): Promise<StartSessionResponse> {
    const session = await this.resolveSession(code);
    if (session.status === 'ended') {
      throw new BadRequestException('Session has ended');
    }
    if (session.status === 'active') {
      return { ok: true, status: 'active', startedAt: session.startedAt };
    }
    const startedAt = new Date();
    await this.sessionRepo.update(session.id, { status: 'active', startedAt });
    this.stateCache.markDirty(session.id);
    await this.cache.del(this.sessionInfoKey(code));

    this.stateService.initObservation(session.id, session.lessonId).catch(e =>
      this.logger.warn(`Observation init failed: ${e}`),
    );

    this.broadcast(session.id);
    this.logger.log(`Session started: ${code}`);
    return { ok: true, status: 'active', startedAt };
  }

  async endSession(code: string): Promise<EndSessionResponse> {
    const session = await this.resolveSession(code);
    if (session.status === 'ended') {
      return { ok: true, status: 'ended' };
    }
    await this.sessionRepo.update(session.id, { status: 'ended', endedAt: new Date() });
    this.stateCache.markDirty(session.id);
    await this.cache.del(this.sessionInfoKey(code));

    // Flush any pending debounced broadcast, then send final state immediately
    await this.broadcastService.flushAndBroadcast(session.id);

    this.stateService.cleanupSession(session.id, session.lessonId);
    this.broadcastService.cleanupSession(session.id);

    this.engine.clearSessionMeta(session.id);
    this.translateService.clearSession(session.id);

    this.logger.log(`Session ended: ${code}`);
    return { ok: true, status: 'ended' };
  }

  // ── State aggregation (delegated to StateService) ──

  async getState(sessionId: string, currentStep?: number): Promise<ClassroomStateResponse> {
    return this.stateService.getState(sessionId, currentStep);
  }

  async getSurfaces(sessionId: string, taskNum: number) {
    return this.stateService.getSurfaces(sessionId, taskNum);
  }

  // ── Chat history ──

  async getChatHistory(
    sessionId: string,
    studentId: string,
    threadId?: string,
  ): Promise<Record<string, ChatMessageResponse[]>> {
    const messages = await this.chatMessageRepo.findBySessionAndStudent(sessionId, studentId, threadId);
    const grouped: Record<string, ChatMessageResponse[]> = {};
    for (const m of messages) {
      if (!grouped[m.threadId]) grouped[m.threadId] = [];
      const entry: ChatMessageResponse = {
        role: m.role,
        content: m.content,
        seq: m.seq,
        createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt),
      };
      if (m.images) {
        try { entry.images = JSON.parse(m.images); } catch { /* ignore corrupt JSON */ }
      }
      if (m.imageDescription) {
        entry.imageDescription = m.imageDescription;
      }
      grouped[m.threadId].push(entry);
    }
    return grouped;
  }

  // ── SSE (delegated to BroadcastService) ──

  subscribe(sessionId: string, res: Response) {
    this.broadcastService.subscribe(sessionId, res);
  }

  // ── Teacher control ──

  async setStep(sessionId: string, step: number): Promise<SetStepResponse> {
    const session = await this.sessionRepo.findById(sessionId);
    if (session) {
      await this.sessionRepo.update(session.id, { currentStep: step });
    }
    this.stateCache.markDirty(sessionId);
    const state = await this.getState(sessionId, step);
    this.broadcastNamed(sessionId, 'step_sync', { currentStep: step, ...state });
    return { ok: true, currentStep: step };
  }

  notify(sessionId: string, message: string, type?: string): NotifyResponse {
    const notifyType = type || 'general';
    const id = `${notifyType}::${message}`;

    const active = this.stateService.toggleNotification(sessionId, id, message, notifyType);
    this.stateCache.markDirty(sessionId);

    if (!active) {
      this.broadcastNamed(sessionId, 'notification_revoke', { id });
      return { ok: true, active: false, id };
    } else {
      const notifications = this.stateService.getActiveNotifications(sessionId);
      const notif = notifications.find(n => n.id === id)!;
      this.broadcastNamed(sessionId, 'notification', { id, message, notifyType, timestamp: notif.timestamp });
      return { ok: true, active: true, id };
    }
  }

  // ── Broadcast (delegated to BroadcastService) ──

  broadcast(sessionId: string) {
    this.broadcastService.broadcast(sessionId);
  }

  broadcastNamed(sessionId: string, eventName: string, payload: any) {
    this.broadcastService.broadcastNamed(sessionId, eventName, payload);
  }

  // ── Snapshots (delegated to BroadcastService) ──

  async getSnapshots(sessionId: string): Promise<SnapshotEntry[]> {
    return this.broadcastService.getSnapshots(sessionId);
  }

  // ── Private helpers ──

  private generateCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARS[randomInt(CODE_CHARS.length)];
    }
    return code;
  }
}
