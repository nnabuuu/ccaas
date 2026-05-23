import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, MoreThan, Repository } from 'typeorm';
import { ClassroomSession } from '../entities/classroom-session.entity';
import type { ClassroomSessionRecord } from '../../../domain/types/classroom-session';
import type {
  ClassroomSessionInsert,
  ClassroomSessionListOptions,
  ClassroomSessionRepoPort,
  ClassroomSessionStatus,
} from '../../../domain/ports/classroom-session-repo.port';

@Injectable()
export class TypeOrmClassroomSessionRepository implements ClassroomSessionRepoPort {
  constructor(
    @InjectRepository(ClassroomSession) private readonly repo: Repository<ClassroomSession>,
  ) {}

  findById(id: string): Promise<ClassroomSessionRecord | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByCode(code: string): Promise<ClassroomSessionRecord | null> {
    return this.repo.findOne({ where: { code } });
  }

  findStartedAtById(id: string): Promise<{ startedAt: Date | null } | null> {
    return this.repo.findOne({ where: { id }, select: ['startedAt'] }) as Promise<
      { startedAt: Date | null } | null
    >;
  }

  findStaleEnded(cutoff: Date): Promise<Array<Pick<ClassroomSessionRecord, 'id' | 'lessonId'>>> {
    return this.repo.find({
      where: { status: 'ended', endedAt: LessThan(cutoff) },
      select: ['id', 'lessonId'],
    });
  }

  findForBatchCheck(
    ids: string[],
    statuses: ClassroomSessionStatus[],
    cutoff: Date,
  ): Promise<ClassroomSessionRecord[]> {
    const whereClauses = statuses.map(status => ({
      id: In(ids),
      status,
      createdAt: MoreThan(cutoff),
    }));
    return this.repo.find({ where: whereClauses });
  }

  findAndCount(
    opts: ClassroomSessionListOptions,
  ): Promise<[ClassroomSessionRecord[], number]> {
    const where: Record<string, unknown> = {};
    if (opts.status) where.status = opts.status;
    return this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: opts.limit,
      skip: opts.offset,
    });
  }

  async insert(rec: ClassroomSessionInsert): Promise<ClassroomSessionRecord> {
    const created = this.repo.create(rec);
    return this.repo.save(created);
  }

  async update(id: string, patch: Partial<ClassroomSessionRecord>): Promise<void> {
    await this.repo.update({ id }, patch as Partial<ClassroomSession>);
  }
}
