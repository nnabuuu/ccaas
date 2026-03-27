import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Response } from 'express';

interface SseClient {
  res: Response;
  heartbeat: ReturnType<typeof setInterval>;
}

interface StudentSseClient extends SseClient {
  classSessionId: string;
}

@Injectable()
export class SseService implements OnModuleDestroy {
  private readonly logger = new Logger(SseService.name);

  // classSessionId → Map<subscriberId, SseClient>
  private teacherStreams = new Map<string, Map<string, SseClient>>();
  // studentSessionId → StudentSseClient
  private studentStreams = new Map<string, StudentSseClient>();

  onModuleDestroy() {
    // Clear all heartbeats
    for (const clients of this.teacherStreams.values()) {
      for (const client of clients.values()) {
        clearInterval(client.heartbeat);
      }
    }
    for (const client of this.studentStreams.values()) {
      clearInterval(client.heartbeat);
    }
  }

  subscribeTeacher(
    classSessionId: string,
    subscriberId: string,
    res: Response,
  ): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send initial connected event
    res.write(`event: connected\ndata: ${JSON.stringify({ subscriberId })}\n\n`);

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30_000);

    if (!this.teacherStreams.has(classSessionId)) {
      this.teacherStreams.set(classSessionId, new Map());
    }
    this.teacherStreams.get(classSessionId).set(subscriberId, { res, heartbeat });

    res.on('close', () => {
      clearInterval(heartbeat);
      this.teacherStreams.get(classSessionId)?.delete(subscriberId);
      if (this.teacherStreams.get(classSessionId)?.size === 0) {
        this.teacherStreams.delete(classSessionId);
      }
      this.logger.debug(`Teacher stream closed: ${subscriberId}`);
    });

    this.logger.debug(
      `Teacher subscribed: ${subscriberId} for session ${classSessionId}`,
    );
  }

  subscribeStudent(
    studentSessionId: string,
    classSessionId: string,
    res: Response,
  ): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(
      `event: connected\ndata: ${JSON.stringify({ studentSessionId })}\n\n`,
    );

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30_000);

    // Close existing stream for this student if any
    const existing = this.studentStreams.get(studentSessionId);
    if (existing) {
      clearInterval(existing.heartbeat);
      existing.res.end();
    }

    this.studentStreams.set(studentSessionId, {
      res,
      heartbeat,
      classSessionId,
    });

    res.on('close', () => {
      clearInterval(heartbeat);
      this.studentStreams.delete(studentSessionId);
      this.logger.debug(`Student stream closed: ${studentSessionId}`);
    });

    this.logger.debug(
      `Student subscribed: ${studentSessionId} in session ${classSessionId}`,
    );
  }

  emitToTeachers(classSessionId: string, event: string, data: unknown): void {
    const clients = this.teacherStreams.get(classSessionId);
    if (!clients) return;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of clients.values()) {
      client.res.write(payload);
    }
  }

  emitToStudent(studentSessionId: string, event: string, data: unknown): void {
    const client = this.studentStreams.get(studentSessionId);
    if (!client) return;
    client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  emitToAllStudents(
    classSessionId: string,
    event: string,
    data: unknown,
  ): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [, client] of this.studentStreams) {
      if (client.classSessionId === classSessionId) {
        client.res.write(payload);
      }
    }
  }
}
