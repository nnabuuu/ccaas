import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { NotifySink } from '@kedge-agentic/observer-engine';
import { ClassroomService } from '../classroom.service';

@Injectable()
export class ClassroomNotifySink implements NotifySink, OnModuleInit {
  private classroom!: ClassroomService;

  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit(): void {
    this.classroom = this.moduleRef.get(ClassroomService, { strict: false });
  }

  push(channel: string, payload: unknown): void {
    // channel format: "session:<sessionId>:<topic>"
    const parts = channel.split(':');
    if (parts.length < 3) return;
    const [, sessionId, topic] = parts;
    this.classroom.broadcastNamed(sessionId, topic, payload);
  }
}
