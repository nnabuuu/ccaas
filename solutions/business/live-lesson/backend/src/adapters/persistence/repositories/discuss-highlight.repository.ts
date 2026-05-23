import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiscussHighlight } from '../entities/discuss-highlight.entity';
import type {
  DiscussHighlightRepoPort,
  DiscussHighlightUpsert,
  DiscussHighlightCountRow,
} from '../../../domain/ports/discuss-highlight-repo.port';
import type { DiscussHighlightRecord } from '../../../domain/types/discuss-highlight';

@Injectable()
export class TypeOrmDiscussHighlightRepository implements DiscussHighlightRepoPort {
  constructor(
    @InjectRepository(DiscussHighlight)
    private readonly repo: Repository<DiscussHighlight>,
  ) {}

  findBySession(sessionId: string): Promise<DiscussHighlightRecord[]> {
    return this.repo.find({ where: { sessionId }, order: { detectedAt: 'ASC' } });
  }

  async findTopGistsBySessionAndStudent(
    sessionId: string,
    studentId: string,
    limit: number,
  ): Promise<Array<Pick<DiscussHighlightRecord, 'gist'>>> {
    return this.repo.find({
      where: { sessionId, studentId },
      select: ['gist'],
      order: { detectedAt: 'DESC' },
      take: limit,
    });
  }

  async upsertHighlight(h: DiscussHighlightUpsert): Promise<void> {
    await this.repo.upsert(h, ['sessionId', 'studentId', 'taskNum', 'clusterId']);
  }

  countBySessionGroupByStudent(sessionId: string): Promise<DiscussHighlightCountRow[]> {
    return this.repo
      .createQueryBuilder('h')
      .select('h.studentId', 'studentId')
      .addSelect('h.studentName', 'studentName')
      .addSelect('COUNT(*)', 'cnt')
      .where('h.sessionId = :sessionId', { sessionId })
      .groupBy('h.studentId')
      .addGroupBy('h.studentName')
      .getRawMany<DiscussHighlightCountRow>();
  }
}
