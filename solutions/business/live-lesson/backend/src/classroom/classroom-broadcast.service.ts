import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassroomSnapshot } from '../entities/classroom-snapshot.entity';
import { CoachingService } from './coaching.service';
import { ClassroomStateService } from './classroom-state.service';
import type { Response } from 'express';
import type { ClassroomStateResponse, SnapshotEntry } from '../schemas/classroom';

/**
 * SSE transport layer + snapshot persistence.
 * Owns all SSE connection state (subscribers, heartbeats, debounce timers).
 * Delegates to ClassroomStateService.getState() for broadcast payloads.
 */
@Injectable()
export class ClassroomBroadcastService implements OnModuleDestroy {
  private readonly logger = new Logger(ClassroomBroadcastService.name);

  private subscribers = new Map<string, Set<Response>>();
  private heartbeatTimers = new Map<Response, NodeJS.Timeout>();
  private broadcastTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private lastSnapshotAt = new Map<string, number>();
  private readonly SNAPSHOT_THROTTLE_MS = 10_000;

  constructor(
    private readonly stateService: ClassroomStateService,
    @InjectRepository(ClassroomSnapshot)
    private readonly snapshotRepo: Repository<ClassroomSnapshot>,
    private readonly coachingService: CoachingService,
  ) {}

  onModuleDestroy() {
    for (const timer of this.broadcastTimers.values()) clearTimeout(timer);
    this.broadcastTimers.clear();

    for (const timer of this.heartbeatTimers.values()) clearInterval(timer);
    this.heartbeatTimers.clear();
    this.subscribers.clear();
  }

  // ── SSE connection ──

  subscribe(sessionId: string, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    if (!this.subscribers.has(sessionId)) {
      this.subscribers.set(sessionId, new Set());
    }
    this.subscribers.get(sessionId)!.add(res);

    this.stateService.getState(sessionId).then(state => {
      res.write(`data: ${JSON.stringify(state)}\n\n`);
    }).catch(e => {
      this.logger.error(`Failed to send initial SSE state: ${e}`);
    });

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30000);
    this.heartbeatTimers.set(res, heartbeat);

    res.on('close', () => {
      this.subscribers.get(sessionId)?.delete(res);
      const timer = this.heartbeatTimers.get(res);
      if (timer) {
        clearInterval(timer);
        this.heartbeatTimers.delete(res);
      }
      this.logger.debug(`SSE subscriber disconnected for session ${sessionId}`);
    });

    this.logger.debug(`SSE subscriber connected for session ${sessionId}`);
  }

  // ── Debounced broadcast ──

  broadcast(sessionId: string) {
    const existing = this.broadcastTimers.get(sessionId);
    if (existing) clearTimeout(existing);

    this.broadcastTimers.set(sessionId, setTimeout(() => {
      this.broadcastTimers.delete(sessionId);
      this.doBroadcast(sessionId).catch(e =>
        this.logger.error(`Debounced broadcast failed for ${sessionId}: ${e}`),
      );
    }, 300));
  }

  private async doBroadcast(sessionId: string) {
    const subs = this.subscribers.get(sessionId);
    const state = await this.stateService.getState(sessionId);

    this.maybePersistSnapshot(sessionId, state);

    this.coachingService.maybeRefresh(sessionId, {
      stepMetrics: state.stepMetrics,
      healthCards: state.healthCards,
      observation: state.observation,
    }).catch(e =>
      this.logger.warn(`Coaching refresh failed: ${e}`),
    );

    if (!subs || subs.size === 0) return;

    const payload = `data: ${JSON.stringify(state)}\n\n`;

    this.writeToSubscribers(subs, payload);
  }

  // ── Named SSE event ──

  broadcastNamed(sessionId: string, eventName: string, payload: unknown) {
    const subs = this.subscribers.get(sessionId);
    if (!subs || subs.size === 0) return;

    const message = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
    this.writeToSubscribers(subs, message);
  }

  private writeToSubscribers(subs: Set<Response>, data: string) {
    for (const res of subs) {
      try {
        res.write(data);
      } catch {
        subs.delete(res);
        const timer = this.heartbeatTimers.get(res);
        if (timer) {
          clearInterval(timer);
          this.heartbeatTimers.delete(res);
        }
      }
    }
  }

  // ── Flush + immediate broadcast (used by endSession) ──

  async flushAndBroadcast(sessionId: string) {
    const pending = this.broadcastTimers.get(sessionId);
    if (pending) {
      clearTimeout(pending);
      this.broadcastTimers.delete(sessionId);
    }
    await this.doBroadcast(sessionId);
  }

  // ── Snapshot persistence ──

  private maybePersistSnapshot(sessionId: string, state: ClassroomStateResponse): void {
    const now = Date.now();
    const last = this.lastSnapshotAt.get(sessionId) || 0;
    if (now - last < this.SNAPSHOT_THROTTLE_MS) return;
    this.lastSnapshotAt.set(sessionId, now);
    this.snapshotRepo.save(
      this.snapshotRepo.create({
        sessionId,
        capturedAt: new Date(now),
        stateJson: JSON.stringify(state),
      }),
    ).catch(e => this.logger.warn(`Snapshot persist failed: ${e}`));
  }

  async getSnapshots(sessionId: string): Promise<SnapshotEntry[]> {
    const rows = await this.snapshotRepo.find({
      where: { sessionId },
      order: { capturedAt: 'ASC' },
    });
    return rows.reduce<SnapshotEntry[]>((acc, r) => {
      try {
        acc.push({
          capturedAt: r.capturedAt instanceof Date ? r.capturedAt.toISOString() : String(r.capturedAt),
          state: JSON.parse(r.stateJson),
        });
      } catch {
        this.logger.warn(`Skipping corrupted snapshot ${r.id}`);
      }
      return acc;
    }, []);
  }

  // ── Session cleanup ──

  cleanupSession(sessionId: string) {
    const pending = this.broadcastTimers.get(sessionId);
    if (pending) {
      clearTimeout(pending);
      this.broadcastTimers.delete(sessionId);
    }

    this.lastSnapshotAt.delete(sessionId);

    const subs = this.subscribers.get(sessionId);
    if (subs) {
      for (const res of subs) {
        const timer = this.heartbeatTimers.get(res);
        if (timer) {
          clearInterval(timer);
          this.heartbeatTimers.delete(res);
        }
      }
      this.subscribers.delete(sessionId);
    }
  }
}
