import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Or, Repository } from 'typeorm';
import { AiQuestion } from '../entities/ai-question.entity';
import type { AiQuestionRecord } from '../../../domain/types/ai-question';
import type {
  AiQuestionInsert,
  AiQuestionRepoPort,
} from '../../../domain/ports/ai-question-repo.port';

@Injectable()
export class TypeOrmAiQuestionRepository implements AiQuestionRepoPort {
  constructor(
    @InjectRepository(AiQuestion) private readonly repo: Repository<AiQuestion>,
  ) {}

  findBySession(sessionId: string): Promise<AiQuestionRecord[]> {
    return this.repo.find({ where: { sessionId }, order: { askedAt: 'ASC' } });
  }

  countAskByStudent(sessionId: string, studentId: string): Promise<number> {
    return this.repo.count({
      where: { sessionId, studentId, category: Or(Not('discuss'), IsNull()) },
    });
  }

  async insert(rec: AiQuestionInsert): Promise<void> {
    await this.repo.save(this.repo.create(rec));
  }
}
