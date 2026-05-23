import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiscussTargetHit } from '../entities/discuss-target-hit.entity';
import type {
  DiscussTargetHitRepoPort,
  DiscussTargetHitUpsert,
  DiscussTargetHitCountRow,
} from '../../../domain/ports/discuss-target-hit-repo.port';
import type { DiscussTargetHitRecord } from '../../../domain/types/discuss-target-hit';

@Injectable()
export class TypeOrmDiscussTargetHitRepository implements DiscussTargetHitRepoPort {
  constructor(
    @InjectRepository(DiscussTargetHit)
    private readonly repo: Repository<DiscussTargetHit>,
  ) {}

  findBySession(sessionId: string): Promise<DiscussTargetHitRecord[]> {
    return this.repo.find({ where: { sessionId } });
  }

  async findTargetPointIdsBySessionAndStudent(
    sessionId: string,
    studentId: string,
  ): Promise<Array<Pick<DiscussTargetHitRecord, 'targetPointId'>>> {
    return this.repo.find({
      where: { sessionId, studentId },
      select: ['targetPointId'],
    });
  }

  async upsertHit(hit: DiscussTargetHitUpsert): Promise<void> {
    await this.repo.upsert(hit, ['sessionId', 'studentId', 'taskNum', 'targetPointId']);
  }

  countBySessionGroupByStudent(sessionId: string): Promise<DiscussTargetHitCountRow[]> {
    return this.repo
      .createQueryBuilder('t')
      .select('t.studentId', 'studentId')
      .addSelect('t.studentName', 'studentName')
      .addSelect('COUNT(*)', 'cnt')
      .where('t.sessionId = :sessionId', { sessionId })
      .groupBy('t.studentId')
      .addGroupBy('t.studentName')
      .getRawMany<DiscussTargetHitCountRow>();
  }
}
