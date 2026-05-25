import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskDemoAttempt } from '../entities/task-demo-attempt.entity';
import type {
  RespondentSummary,
  TaskDemoAttemptInsert,
  TaskDemoAttemptRecord,
  TaskDemoAttemptRepoPort,
} from '../../../domain/ports/task-demo-attempt-repo.port';

@Injectable()
export class TypeOrmTaskDemoAttemptRepository implements TaskDemoAttemptRepoPort {
  constructor(
    @InjectRepository(TaskDemoAttempt) private readonly repo: Repository<TaskDemoAttempt>,
  ) {}

  async insert(rec: TaskDemoAttemptInsert): Promise<TaskDemoAttemptRecord> {
    const created = this.repo.create(rec);
    return this.repo.save(created);
  }

  async maxAttempt(sessionId: string, studentId: string): Promise<number> {
    const row = await this.repo
      .createQueryBuilder('a')
      .select('MAX(a.attempt)', 'max')
      .where('a.sessionId = :sessionId AND a.studentId = :studentId', { sessionId, studentId })
      .getRawOne<{ max: number | null }>();
    return row?.max ?? 0;
  }

  async summarizeBySession(sessionId: string): Promise<RespondentSummary[]> {
    // Per-student aggregates: count + latest submittedAt. We then fetch the
    // latest score with a small fan-out (one query per respondent). Acceptable
    // for demo-scale (<100 respondents per session); revisit if scale grows.
    const aggregates = await this.repo
      .createQueryBuilder('a')
      .select('a.studentId', 'studentId')
      .addSelect('COUNT(*)', 'count')
      .addSelect('MAX(a.submittedAt)', 'latest')
      .where('a.sessionId = :sessionId', { sessionId })
      .groupBy('a.studentId')
      .orderBy('MAX(a.submittedAt)', 'DESC')
      .getRawMany<{ studentId: string; count: string; latest: string }>();

    const results: RespondentSummary[] = [];
    for (const agg of aggregates) {
      const latestAttempt = await this.repo.findOne({
        where: { sessionId, studentId: agg.studentId },
        order: { attempt: 'DESC' },
      });
      results.push({
        studentId: agg.studentId,
        attemptCount: Number(agg.count),
        latestScore: latestAttempt?.scoreJson ?? null,
        latestSubmittedAt: latestAttempt?.submittedAt ?? null,
      });
    }
    return results;
  }

  findByStudent(sessionId: string, studentId: string): Promise<TaskDemoAttemptRecord[]> {
    return this.repo.find({
      where: { sessionId, studentId },
      order: { attempt: 'ASC' },
    });
  }

  findLatestByStudent(sessionId: string, studentId: string): Promise<TaskDemoAttemptRecord | null> {
    return this.repo.findOne({
      where: { sessionId, studentId },
      order: { attempt: 'DESC' },
    });
  }
}
