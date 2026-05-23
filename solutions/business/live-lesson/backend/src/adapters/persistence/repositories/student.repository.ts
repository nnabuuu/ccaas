import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../entities/student.entity';
import type { StudentRecord } from '../../../domain/types/student';
import type {
  StudentCountBySessionRow,
  StudentInsert,
  StudentRepoPort,
} from '../../../domain/ports/student-repo.port';

@Injectable()
export class TypeOrmStudentRepository implements StudentRepoPort {
  constructor(
    @InjectRepository(Student) private readonly repo: Repository<Student>,
  ) {}

  findBySession(sessionId: string): Promise<StudentRecord[]> {
    return this.repo.find({ where: { sessionId }, order: { joinedAt: 'ASC' } });
  }

  countBySessionInIds(sessionIds: string[]): Promise<StudentCountBySessionRow[]> {
    if (sessionIds.length === 0) return Promise.resolve([]);
    return this.repo
      .createQueryBuilder('s')
      .select('s.sessionId', 'sessionId')
      .addSelect('COUNT(*)', 'count')
      .where('s.sessionId IN (:...ids)', { ids: sessionIds })
      .groupBy('s.sessionId')
      .getRawMany<StudentCountBySessionRow>();
  }

  findBySessionAndId(sessionId: string, studentId: string): Promise<StudentRecord | null> {
    return this.repo.findOne({ where: { id: studentId, sessionId } });
  }

  findBySessionAndName(sessionId: string, name: string): Promise<StudentRecord | null> {
    return this.repo.findOne({ where: { sessionId, name } });
  }

  async insert(rec: StudentInsert): Promise<StudentRecord> {
    const created = this.repo.create(rec);
    return this.repo.save(created);
  }

  save(record: StudentRecord): Promise<StudentRecord> {
    return this.repo.save(record as Student);
  }

  async update(id: string, patch: Partial<StudentRecord>): Promise<void> {
    await this.repo.update({ id }, patch as Partial<Student>);
  }
}
