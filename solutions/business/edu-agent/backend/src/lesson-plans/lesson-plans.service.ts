import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import { DATABASE_TOKEN } from '../database/database.module';
import {
  LessonPlan,
  LessonPlanRow,
  CreateLessonPlanDto,
  UpdateLessonPlanDto,
  SyncField,
} from './lesson-plans.types';

@Injectable()
export class LessonPlansService {
  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database.Database,
  ) {}

  private rowToLessonPlan(row: LessonPlanRow): LessonPlan {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      subject: row.subject,
      gradeLevel: row.grade_level,
      duration: row.duration,
      publisher: row.publisher || undefined,
      volume: row.volume || undefined,
      chapterId: row.chapter_id || undefined,
      chapterTitle: row.chapter_title || undefined,
      objectives: JSON.parse(row.objectives),
      standards: JSON.parse(row.standards),
      materials: JSON.parse(row.materials),
      activities: JSON.parse(row.activities),
      assessment: JSON.parse(row.assessment),
      differentiation: JSON.parse(row.differentiation),
      status: row.status as LessonPlan['status'],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  findAll(tenantId?: string): LessonPlan[] {
    let rows: LessonPlanRow[];
    if (tenantId) {
      rows = this.db
        .prepare('SELECT * FROM lesson_plans WHERE tenant_id = ? ORDER BY updated_at DESC')
        .all(tenantId) as LessonPlanRow[];
    } else {
      rows = this.db
        .prepare('SELECT * FROM lesson_plans ORDER BY updated_at DESC')
        .all() as LessonPlanRow[];
    }
    return rows.map((row) => this.rowToLessonPlan(row));
  }

  findById(id: string): LessonPlan | null {
    const row = this.db
      .prepare('SELECT * FROM lesson_plans WHERE id = ?')
      .get(id) as LessonPlanRow | undefined;
    return row ? this.rowToLessonPlan(row) : null;
  }

  findByIdOrFail(id: string): LessonPlan {
    const plan = this.findById(id);
    if (!plan) {
      throw new NotFoundException(`Lesson plan ${id} not found`);
    }
    return plan;
  }

  create(dto: CreateLessonPlanDto): LessonPlan {
    const now = new Date().toISOString();
    const id = uuidv4();

    const plan: LessonPlan = {
      id,
      tenantId: dto.tenantId,
      title: dto.title,
      subject: dto.subject || '',
      gradeLevel: dto.gradeLevel || '',
      duration: dto.duration || '',
      publisher: dto.publisher,
      volume: dto.volume,
      chapterId: dto.chapterId,
      chapterTitle: dto.chapterTitle,
      objectives: [],
      standards: [],
      materials: [],
      activities: [],
      assessment: { formative: [], summative: [] },
      differentiation: { struggling: [], onLevel: [], advanced: [] },
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    this.db.prepare(`
      INSERT INTO lesson_plans (
        id, tenant_id, title, subject, grade_level, duration,
        publisher, volume, chapter_id, chapter_title,
        objectives, standards, materials, activities,
        assessment, differentiation, status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `).run(
      plan.id,
      plan.tenantId,
      plan.title,
      plan.subject,
      plan.gradeLevel,
      plan.duration,
      plan.publisher || null,
      plan.volume || null,
      plan.chapterId || null,
      plan.chapterTitle || null,
      JSON.stringify(plan.objectives),
      JSON.stringify(plan.standards),
      JSON.stringify(plan.materials),
      JSON.stringify(plan.activities),
      JSON.stringify(plan.assessment),
      JSON.stringify(plan.differentiation),
      plan.status,
      plan.createdAt,
      plan.updatedAt,
    );

    return plan;
  }

  update(id: string, dto: UpdateLessonPlanDto): LessonPlan {
    const existing = this.findByIdOrFail(id);
    const now = new Date().toISOString();

    const updated: LessonPlan = {
      ...existing,
      title: dto.title ?? existing.title,
      subject: dto.subject ?? existing.subject,
      gradeLevel: dto.gradeLevel ?? existing.gradeLevel,
      duration: dto.duration ?? existing.duration,
      publisher: dto.publisher ?? existing.publisher,
      volume: dto.volume ?? existing.volume,
      chapterId: dto.chapterId ?? existing.chapterId,
      chapterTitle: dto.chapterTitle ?? existing.chapterTitle,
      objectives: dto.objectives ?? existing.objectives,
      standards: dto.standards ?? existing.standards,
      materials: dto.materials ?? existing.materials,
      activities: dto.activities ?? existing.activities,
      assessment: dto.assessment ?? existing.assessment,
      differentiation: dto.differentiation ?? existing.differentiation,
      status: dto.status ?? existing.status,
      updatedAt: now,
    };

    this.db.prepare(`
      UPDATE lesson_plans SET
        title = ?, subject = ?, grade_level = ?, duration = ?,
        publisher = ?, volume = ?, chapter_id = ?, chapter_title = ?,
        objectives = ?, standards = ?, materials = ?, activities = ?,
        assessment = ?, differentiation = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(
      updated.title,
      updated.subject,
      updated.gradeLevel,
      updated.duration,
      updated.publisher || null,
      updated.volume || null,
      updated.chapterId || null,
      updated.chapterTitle || null,
      JSON.stringify(updated.objectives),
      JSON.stringify(updated.standards),
      JSON.stringify(updated.materials),
      JSON.stringify(updated.activities),
      JSON.stringify(updated.assessment),
      JSON.stringify(updated.differentiation),
      updated.status,
      updated.updatedAt,
      id,
    );

    return updated;
  }

  patchField(id: string, field: SyncField, value: unknown): LessonPlan {
    this.findByIdOrFail(id);
    const now = new Date().toISOString();

    const fieldToColumn: Record<SyncField, string> = {
      title: 'title',
      subject: 'subject',
      gradeLevel: 'grade_level',
      duration: 'duration',
      publisher: 'publisher',
      volume: 'volume',
      chapterId: 'chapter_id',
      chapterTitle: 'chapter_title',
      objectives: 'objectives',
      standards: 'standards',
      materials: 'materials',
      activities: 'activities',
      assessment: 'assessment',
      differentiation: 'differentiation',
    };

    const column = fieldToColumn[field];
    const isJsonField = ['objectives', 'standards', 'materials', 'activities', 'assessment', 'differentiation'].includes(field);
    const dbValue = isJsonField ? JSON.stringify(value) : value;

    this.db.prepare(`UPDATE lesson_plans SET ${column} = ?, updated_at = ? WHERE id = ?`).run(
      dbValue,
      now,
      id,
    );

    return this.findByIdOrFail(id);
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM lesson_plans WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
