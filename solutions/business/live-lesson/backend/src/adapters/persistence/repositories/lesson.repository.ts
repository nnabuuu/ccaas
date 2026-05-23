import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Lesson } from '../entities/lesson.entity';
import type { LessonRecord } from '../../../domain/types/lesson';
import type {
  LessonInsert,
  LessonListItem,
  LessonRepoPort,
  LessonSeedFields,
} from '../../../domain/ports/lesson-repo.port';

@Injectable()
export class TypeOrmLessonRepository implements LessonRepoPort {
  constructor(
    @InjectRepository(Lesson) private readonly repo: Repository<Lesson>,
  ) {}

  findById(id: string): Promise<LessonRecord | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByIds(ids: string[]): Promise<LessonRecord[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.repo.find({ where: { id: In(ids) } });
  }

  findAllSeedFields(): Promise<LessonSeedFields[]> {
    return this.repo.find({ select: ['id', 'lessonType', 'description'] }) as Promise<LessonSeedFields[]>;
  }

  findAllForList(): Promise<LessonListItem[]> {
    return this.repo.find({
      select: ['id', 'title', 'subject', 'gradeLevel', 'description', 'emoji', 'lessonType'],
    }) as Promise<LessonListItem[]>;
  }

  async insert(rec: LessonInsert): Promise<void> {
    const created = this.repo.create(rec);
    await this.repo.save(created);
  }

  save(record: LessonRecord): Promise<LessonRecord> {
    return this.repo.save(record as Lesson);
  }

  async update(id: string, patch: Partial<LessonRecord>): Promise<void> {
    await this.repo.update({ id }, patch as Partial<Lesson>);
  }
}
