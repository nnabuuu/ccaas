import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import { DATABASE_TOKEN } from '../database/database.module';
import {
  LessonPlan,
  LessonPlanRow,
  CurriculumStandard,
  CreateLessonPlanDto,
  UpdateLessonPlanDto,
  SyncField,
  LessonPlanStatus,
  LessonPlanAttachment,
  AddAttachmentDto,
} from './lesson-plans.types';

@Injectable()
export class LessonPlansService {
  private readonly logger = { log: console.log, error: console.error };

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database.Database,
  ) {}

  private rowToLessonPlan(row: LessonPlanRow): LessonPlan {
    let extraProperties: Record<string, string> = {};
    if (row.extra_properties) {
      try {
        extraProperties = JSON.parse(row.extra_properties);
      } catch {
        extraProperties = {};
      }
    }

    let curriculumRequirements: CurriculumStandard[] = [];
    if (row.curriculum_requirements) {
      try {
        curriculumRequirements = JSON.parse(row.curriculum_requirements);
      } catch {
        curriculumRequirements = [];
      }
    }

    let attachments: LessonPlanAttachment[] = [];
    if (row.attachments) {
      try {
        attachments = JSON.parse(row.attachments);
      } catch {
        attachments = [];
      }
    }

    return {
      id: row.id,
      title: row.title,
      subject: row.subject,
      gradeLevel: row.grade_level,
      durationMinutes: row.duration_minutes,
      lessonPlanCode: row.lesson_plan_code,
      status: row.status as LessonPlanStatus,

      publisher: row.publisher,
      volume: row.volume,
      chapterId: row.chapter_id,
      chapterTitle: row.chapter_title,

      curriculumRequirements,
      objectives: row.objectives,
      studentAnalysis: row.student_analysis,
      materialsNeeded: row.materials_needed,
      content: row.content,
      assessmentMethods: row.assessment_methods,
      teachingMethods: row.teaching_methods,

      extraProperties,
      attachments,

      createBy: row.create_by,
      createTime: row.create_time,
      updateBy: row.update_by,
      updateTime: row.update_time,
      remark: row.remark,
      deleted: row.deleted,
    };
  }

  findAll(): LessonPlan[] {
    const rows = this.db
      .prepare('SELECT * FROM lesson_plans WHERE deleted = 0 ORDER BY update_time DESC')
      .all() as LessonPlanRow[];
    return rows.map((row) => this.rowToLessonPlan(row));
  }

  findById(id: string): LessonPlan | null {
    const row = this.db
      .prepare('SELECT * FROM lesson_plans WHERE id = ? AND deleted = 0')
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

    this.db.prepare(`
      INSERT INTO lesson_plans (
        id, title, subject, grade_level, duration_minutes,
        lesson_plan_code, publisher, volume, chapter_id, chapter_title,
        status, create_time, update_time
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        'DRAFT', ?, ?
      )
    `).run(
      id,
      dto.title,
      dto.subject || '',
      dto.gradeLevel || 1,
      dto.durationMinutes || 45,
      dto.lessonPlanCode || null,
      dto.publisher || null,
      dto.volume || null,
      dto.chapterId || null,
      dto.chapterTitle || null,
      now,
      now,
    );

    return this.findByIdOrFail(id);
  }

  update(id: string, dto: UpdateLessonPlanDto): LessonPlan {
    const existing = this.findByIdOrFail(id);
    const now = new Date().toISOString();

    const updated: LessonPlan = {
      ...existing,
      title: dto.title ?? existing.title,
      subject: dto.subject ?? existing.subject,
      gradeLevel: dto.gradeLevel ?? existing.gradeLevel,
      durationMinutes: dto.durationMinutes ?? existing.durationMinutes,
      lessonPlanCode: dto.lessonPlanCode !== undefined ? dto.lessonPlanCode : existing.lessonPlanCode,
      status: dto.status ?? existing.status,
      publisher: dto.publisher !== undefined ? dto.publisher : existing.publisher,
      volume: dto.volume !== undefined ? dto.volume : existing.volume,
      chapterId: dto.chapterId !== undefined ? dto.chapterId : existing.chapterId,
      chapterTitle: dto.chapterTitle !== undefined ? dto.chapterTitle : existing.chapterTitle,
      curriculumRequirements: dto.curriculumRequirements !== undefined ? dto.curriculumRequirements : existing.curriculumRequirements,
      objectives: dto.objectives !== undefined ? dto.objectives : existing.objectives,
      studentAnalysis: dto.studentAnalysis !== undefined ? dto.studentAnalysis : existing.studentAnalysis,
      materialsNeeded: dto.materialsNeeded !== undefined ? dto.materialsNeeded : existing.materialsNeeded,
      content: dto.content !== undefined ? dto.content : existing.content,
      assessmentMethods: dto.assessmentMethods !== undefined ? dto.assessmentMethods : existing.assessmentMethods,
      teachingMethods: dto.teachingMethods !== undefined ? dto.teachingMethods : existing.teachingMethods,
      extraProperties: dto.extraProperties ?? existing.extraProperties,
      remark: dto.remark !== undefined ? dto.remark : existing.remark,
      updateTime: now,
    };

    this.db.prepare(`
      UPDATE lesson_plans SET
        title = ?, subject = ?, grade_level = ?, duration_minutes = ?,
        lesson_plan_code = ?, status = ?,
        publisher = ?, volume = ?, chapter_id = ?, chapter_title = ?,
        curriculum_requirements = ?, objectives = ?, student_analysis = ?,
        materials_needed = ?, content = ?, assessment_methods = ?,
        teaching_methods = ?, extra_properties = ?, attachments = ?,
        remark = ?, update_time = ?
      WHERE id = ?
    `).run(
      updated.title,
      updated.subject,
      updated.gradeLevel,
      updated.durationMinutes,
      updated.lessonPlanCode,
      updated.status,
      updated.publisher,
      updated.volume,
      updated.chapterId,
      updated.chapterTitle,
      JSON.stringify(updated.curriculumRequirements),
      updated.objectives,
      updated.studentAnalysis,
      updated.materialsNeeded,
      updated.content,
      updated.assessmentMethods,
      updated.teachingMethods,
      JSON.stringify(updated.extraProperties),
      JSON.stringify(updated.attachments),
      updated.remark,
      updated.updateTime,
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
      durationMinutes: 'duration_minutes',
      lessonPlanCode: 'lesson_plan_code',
      objectives: 'objectives',
      content: 'content',
      teachingMethods: 'teaching_methods',
      materialsNeeded: 'materials_needed',
      assessmentMethods: 'assessment_methods',
      curriculumRequirements: 'curriculum_requirements',
      studentAnalysis: 'student_analysis',
      extraProperties: 'extra_properties',
      status: 'status',
      attachments: 'attachments',
    };

    const column = fieldToColumn[field];
    // extraProperties, curriculumRequirements, and attachments need JSON serialization
    const dbValue = (field === 'extraProperties' || field === 'curriculumRequirements' || field === 'attachments')
      ? JSON.stringify(value)
      : value;

    this.db.prepare(`UPDATE lesson_plans SET ${column} = ?, update_time = ? WHERE id = ?`).run(
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

  // Attachment methods
  removeAttachment(lessonPlanId: string, attachmentId: string): LessonPlan {
    const plan = this.findByIdOrFail(lessonPlanId);
    const attachments = (plan.attachments || []).filter(a => a.id !== attachmentId);

    const now = new Date().toISOString();
    this.db.prepare('UPDATE lesson_plans SET attachments = ?, update_time = ? WHERE id = ?').run(
      JSON.stringify(attachments),
      now,
      lessonPlanId,
    );

    return this.findByIdOrFail(lessonPlanId);
  }

  getAttachments(lessonPlanId: string): LessonPlanAttachment[] {
    const plan = this.findByIdOrFail(lessonPlanId);
    return plan.attachments || [];
  }

  /**
   * Add attachment from MCP (file already registered with CCAAS)
   */
  async addAttachmentFromMcp(
    lessonPlanId: string,
    sessionId: string,
    dto: AddAttachmentDto,
  ): Promise<LessonPlan> {
    this.logger.log(`[Attachment] Received request - lessonPlanId: ${lessonPlanId}`);
    this.logger.log(`[Attachment] DTO:`, JSON.stringify(dto, null, 2));

    const { fileId, fileName, fileType, mimeType, size, description, downloadUrl } = dto;

    if (!fileId || !fileName) {
      this.logger.error('[Attachment] Missing required fields:', { fileId, fileName });
      throw new BadRequestException('Missing required fields: fileId, fileName');
    }

    // Just create metadata reference (no file copying)
    const attachment: LessonPlanAttachment = {
      id: uuidv4(),
      fileId,        // From CCAAS
      fileName,
      fileType: fileType || this.inferFileType(fileName),
      mimeType: mimeType || this.inferMimeType(fileName),
      size: size || 0,
      downloadUrl: downloadUrl || `http://localhost:3001/api/v1/files/${fileId}/download`,
      uploadedAt: new Date().toISOString(),
      description,
    };

    this.logger.log('[Attachment] Created attachment metadata:', JSON.stringify(attachment, null, 2));

    const result = this.addAttachmentToLessonPlan(lessonPlanId, attachment);
    this.logger.log('[Attachment] Successfully added to lesson plan');

    return result;
  }

  /**
   * Add attachment to lesson plan
   */
  private addAttachmentToLessonPlan(
    lessonPlanId: string,
    attachment: LessonPlanAttachment,
  ): LessonPlan {
    this.logger.log(`[DB] Adding attachment to lesson plan: ${lessonPlanId}`);

    const plan = this.findByIdOrFail(lessonPlanId);
    this.logger.log(`[DB] Found lesson plan: ${plan.id}, current attachments count: ${plan.attachments?.length || 0}`);

    const attachments = [...(plan.attachments || []), attachment];
    this.logger.log(`[DB] New attachments count: ${attachments.length}`);

    const now = new Date().toISOString();

    try {
      this.db.prepare('UPDATE lesson_plans SET attachments = ?, update_time = ? WHERE id = ?').run(
        JSON.stringify(attachments),
        now,
        lessonPlanId,
      );
      this.logger.log(`[DB] Successfully saved attachment to database - fileId: ${attachment.fileId}`);
    } catch (error) {
      this.logger.error(`[DB] Failed to save attachment to database: ${error.message}`);
      throw error;
    }

    const updatedPlan = this.findByIdOrFail(lessonPlanId);
    this.logger.log(`[DB] Verified - updated plan has ${updatedPlan.attachments?.length || 0} attachments`);

    return updatedPlan;
  }

  // Helper: Infer file type from file name or MIME type
  private inferFileType(fileName: string): 'script' | 'audio' | 'ppt' | 'pdf' | 'other' {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (ext === 'md' || ext === 'txt') return 'script';
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
    if (['ppt', 'pptx'].includes(ext)) return 'ppt';
    if (ext === 'pdf') return 'pdf';
    return 'other';
  }

  // Helper: Infer MIME type from file name
  private inferMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      'md': 'text/markdown',
      'txt': 'text/plain',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'm4a': 'audio/mp4',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'pdf': 'application/pdf',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}
