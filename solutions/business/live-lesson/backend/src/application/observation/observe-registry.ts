import { Inject, Injectable, OnModuleInit, BadRequestException, Logger } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { STUDENT_REPO_PORT, type StudentRepoPort } from '../../domain/ports/student-repo.port';
import type { StudentRecord } from '../../domain/types/student';
import { OBSERVE_TYPE_KEY } from '../../domain/shared/observe-handler.interface';
import type { ObserveHandler, ObserveContext } from '../../domain/shared/observe-handler.interface';
import type { SubmissionRecord } from '../../domain/types/submission';
import { SUBMISSION_REPO_PORT, type SubmissionRepoPort } from '../../domain/ports/submission-repo.port';

@Injectable()
export class ObserveRegistry implements OnModuleInit {
  private readonly logger = new Logger(ObserveRegistry.name);
  private handlers = new Map<string, ObserveHandler>();

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector,
    @Inject(STUDENT_REPO_PORT)
    private readonly studentRepo: StudentRepoPort,
    @Inject(SUBMISSION_REPO_PORT)
    private readonly submissionRepo: SubmissionRepoPort,
  ) {}

  onModuleInit() {
    for (const wrapper of this.discoveryService.getProviders()) {
      if (!wrapper.metatype) continue;
      const type = this.reflector.get<string>(OBSERVE_TYPE_KEY, wrapper.metatype);
      if (type && wrapper.instance) {
        this.handlers.set(type, wrapper.instance as ObserveHandler);
        this.logger.log(`Registered observe handler for type "${type}": ${wrapper.metatype.name}`);
      }
    }
  }

  async loadObserveData(sessionId: string): Promise<{
    students: StudentRecord[];
    subsByStudent: Map<string, Record<number, SubmissionRecord>>;
  }> {
    const students = await this.studentRepo.findBySession(sessionId);
    const submissions = await this.submissionRepo.findExerciseBySession(sessionId);
    const subsByStudent = new Map<string, Record<number, SubmissionRecord>>();
    for (const sub of submissions) {
      if (!subsByStudent.has(sub.studentId)) subsByStudent.set(sub.studentId, {});
      subsByStudent.get(sub.studentId)![sub.step] = sub;
    }
    return { students, subsByStudent };
  }

  async compute(type: string, ctx: ObserveContext): Promise<unknown> {
    let handler = this.handlers.get(type);
    // Fallback: rich-content-quiz reuses the image-upload handler
    if (!handler && type === 'rich-content-quiz') {
      handler = this.handlers.get('image-upload');
    }
    if (!handler) {
      // Types without a dedicated handler return empty observe data
      if (type === 'fill-blank') {
        return { type, students: [] };
      }
      throw new BadRequestException(`Unknown observe type: ${type}`);
    }
    return handler.compute(ctx);
  }

  getSupportedTypes(): string[] {
    return [...this.handlers.keys()];
  }
}
