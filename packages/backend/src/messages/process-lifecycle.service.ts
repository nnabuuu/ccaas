/**
 * Process Lifecycle Service
 *
 * Tracks CLI process lifecycle events for debugging and analysis.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessLifecycleEvent, ProcessEventType } from './entities/process-lifecycle-event.entity';

export interface CreateProcessEventDto {
  sessionId: string;
  tenantId?: string | null;
  eventType: ProcessEventType;
  pid?: number | null;
  exitCode?: number | null;
  signal?: string | null;
  stderr?: string | null;
  errorMessage?: string | null;
  command?: string | null;
  workingDir?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class ProcessLifecycleService {
  private readonly logger = new Logger(ProcessLifecycleService.name);

  constructor(
    @InjectRepository(ProcessLifecycleEvent)
    private readonly eventRepository: Repository<ProcessLifecycleEvent>,
  ) {}

  /**
   * Record a process lifecycle event
   */
  async recordEvent(dto: CreateProcessEventDto): Promise<ProcessLifecycleEvent> {
    const event = this.eventRepository.create({
      sessionId: dto.sessionId,
      tenantId: dto.tenantId ?? undefined,
      eventType: dto.eventType,
      pid: dto.pid ?? null,
      exitCode: dto.exitCode ?? null,
      signal: dto.signal ?? null,
      stderr: dto.stderr ?? null,
      errorMessage: dto.errorMessage ?? null,
      command: dto.command ?? null,
      workingDir: dto.workingDir ?? null,
      metadata: dto.metadata ?? null,
    });

    const saved = await this.eventRepository.save(event);
    this.logger.debug(`Recorded ${dto.eventType} event for session ${dto.sessionId} (PID: ${dto.pid})`);
    return saved;
  }

  /**
   * Record process spawn
   */
  async recordSpawn(
    sessionId: string,
    pid: number,
    command?: string,
    workingDir?: string,
    tenantId?: string | null,
  ): Promise<ProcessLifecycleEvent> {
    return this.recordEvent({
      sessionId,
      tenantId,
      eventType: 'spawn',
      pid,
      command,
      workingDir,
    });
  }

  /**
   * Record process exit
   */
  async recordExit(
    sessionId: string,
    pid: number | null,
    exitCode: number | null,
    signal?: string,
    tenantId?: string | null,
  ): Promise<ProcessLifecycleEvent> {
    return this.recordEvent({
      sessionId,
      tenantId,
      eventType: 'exit',
      pid,
      exitCode,
      signal,
    });
  }

  /**
   * Record process crash
   */
  async recordCrash(
    sessionId: string,
    pid: number | null,
    errorMessage?: string,
    stderr?: string,
    tenantId?: string | null,
  ): Promise<ProcessLifecycleEvent> {
    return this.recordEvent({
      sessionId,
      tenantId,
      eventType: 'crash',
      pid,
      errorMessage,
      stderr,
    });
  }

  /**
   * Record process kill (manual termination)
   */
  async recordKill(
    sessionId: string,
    pid: number | null,
    signal: string = 'SIGTERM',
    tenantId?: string | null,
  ): Promise<ProcessLifecycleEvent> {
    return this.recordEvent({
      sessionId,
      tenantId,
      eventType: 'kill',
      pid,
      signal,
    });
  }

  /**
   * Get all events for a session
   */
  async getBySessionId(sessionId: string): Promise<ProcessLifecycleEvent[]> {
    return this.eventRepository.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get last spawn event for a session
   */
  async getLastSpawn(sessionId: string): Promise<ProcessLifecycleEvent | null> {
    return this.eventRepository.findOne({
      where: { sessionId, eventType: 'spawn' },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get process event statistics for a session
   */
  async getSessionStats(sessionId: string): Promise<{
    totalSpawns: number;
    totalExits: number;
    totalCrashes: number;
    totalKills: number;
    lastEvent: ProcessLifecycleEvent | null;
  }> {
    const events = await this.getBySessionId(sessionId);

    let totalSpawns = 0;
    let totalExits = 0;
    let totalCrashes = 0;
    let totalKills = 0;

    for (const event of events) {
      switch (event.eventType) {
        case 'spawn':
          totalSpawns++;
          break;
        case 'exit':
          totalExits++;
          break;
        case 'crash':
          totalCrashes++;
          break;
        case 'kill':
          totalKills++;
          break;
      }
    }

    return {
      totalSpawns,
      totalExits,
      totalCrashes,
      totalKills,
      lastEvent: events.length > 0 ? events[events.length - 1] : null,
    };
  }

  /**
   * Delete all events for a session
   */
  async deleteBySessionId(sessionId: string): Promise<number> {
    const result = await this.eventRepository.delete({ sessionId });
    return result.affected || 0;
  }
}
