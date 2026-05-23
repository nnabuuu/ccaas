import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Submission } from '../entities/submission.entity';
import type { SubmissionRecord } from '../../../domain/types/submission';
import type {
  SubmissionRepoPort,
  SubmissionUpsert,
} from '../../../domain/ports/submission-repo.port';

@Injectable()
export class TypeOrmSubmissionRepository implements SubmissionRepoPort {
  constructor(
    @InjectRepository(Submission) private readonly repo: Repository<Submission>,
  ) {}

  findExerciseBySession(sessionId: string): Promise<SubmissionRecord[]> {
    return this.repo.find({ where: { sessionId, phase: 'exercise' } });
  }

  findExerciseBySessionAndStudent(
    sessionId: string,
    studentId: string,
  ): Promise<SubmissionRecord[]> {
    return this.repo.find({ where: { sessionId, studentId, phase: 'exercise' } });
  }

  findOneBySessionStudentStepPhase(
    sessionId: string,
    studentId: string,
    step: number,
    phase: string,
  ): Promise<SubmissionRecord | null> {
    return this.repo.findOne({ where: { sessionId, studentId, step, phase } });
  }

  countDiscussBySessionAndStudent(sessionId: string, studentId: string): Promise<number> {
    return this.repo.count({ where: { sessionId, studentId, phase: 'discuss' } });
  }

  countBonusBySessionAndStudent(
    sessionId: string,
    studentId: string,
    bonusStartStep: number,
  ): Promise<number> {
    return this.repo.count({
      where: { sessionId, studentId, step: MoreThanOrEqual(bonusStartStep) },
    });
  }

  findRecentBySessionAndStudent(
    sessionId: string,
    studentId: string,
    limit: number,
  ): Promise<SubmissionRecord[]> {
    return this.repo.find({
      where: { sessionId, studentId },
      order: { submittedAt: 'DESC' },
      take: limit,
    });
  }

  async upsert(rec: SubmissionUpsert): Promise<void> {
    await this.repo.upsert(rec, ['sessionId', 'studentId', 'step', 'phase']);
  }

  async updateData(
    id: number,
    patch: Partial<Pick<SubmissionRecord, 'dataJson' | 'scoreJson'>>,
  ): Promise<void> {
    await this.repo.update({ id }, patch as Partial<Submission>);
  }
}
