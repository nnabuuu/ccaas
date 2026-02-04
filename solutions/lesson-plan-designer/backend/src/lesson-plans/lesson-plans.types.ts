import { IsString, IsOptional, IsNumber, IsObject, IsUUID, IsIn, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Fields that can be synced via write_output
export const SYNC_FIELDS = [
  'title',
  'subject',
  'gradeLevel',
  'durationMinutes',
  'lessonPlanCode',
  'objectives',
  'content',
  'teachingMethods',
  'materialsNeeded',
  'assessmentMethods',
  'curriculumRequirements',
  'studentAnalysis',
  'extraProperties',
  'status',
  'attachments',
] as const;

export type SyncField = typeof SYNC_FIELDS[number];

export type LessonPlanStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface CurriculumStandard {
  id: number;
  standardCode: string;
  title: string;
  stage: string;
  standardType: string;
  contentDomain: string;
}

export interface LessonPlanAttachment {
  id: string;
  fileId: string;
  fileName: string;
  fileType: 'script' | 'audio' | 'ppt' | 'pdf' | 'other';
  mimeType: string;
  size: number;
  downloadUrl: string;
  uploadedAt: string;
  description?: string;
}

export interface LessonPlan {
  id: string;
  title: string;
  subject: string;
  gradeLevel: number;
  durationMinutes: number;
  lessonPlanCode: string | null;
  status: LessonPlanStatus;

  // Textbook metadata
  publisher: string | null;
  volume: string | null;
  chapterId: number | null;
  chapterTitle: string | null;

  // Curriculum standards (structured array, stored as JSON)
  curriculumRequirements: CurriculumStandard[];

  // 6 content fields (all plain text)
  objectives: string | null;
  studentAnalysis: string | null;
  materialsNeeded: string | null;
  content: string | null;
  assessmentMethods: string | null;
  teachingMethods: string | null;

  // Extra properties (key-value pairs)
  extraProperties: Record<string, string>;

  // File attachments
  attachments: LessonPlanAttachment[];

  // Audit fields
  createBy: string | null;
  createTime: string;
  updateBy: string | null;
  updateTime: string;
  remark: string | null;
  deleted: number;
}

// Database row type (snake_case)
export interface LessonPlanRow {
  id: string;
  title: string;
  subject: string;
  grade_level: number;
  duration_minutes: number;
  lesson_plan_code: string | null;
  status: string;

  publisher: string | null;
  volume: string | null;
  chapter_id: number | null;
  chapter_title: string | null;

  curriculum_requirements: string | null; // JSON string of CurriculumStandard[]
  objectives: string | null;
  student_analysis: string | null;
  materials_needed: string | null;
  content: string | null;
  assessment_methods: string | null;
  teaching_methods: string | null;

  extra_properties: string | null; // JSON string
  attachments: string | null; // JSON string of LessonPlanAttachment[]

  create_by: string | null;
  create_time: string;
  update_by: string | null;
  update_time: string;
  remark: string | null;
  deleted: number;
}

// DTOs
export class CreateLessonPlanDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsNumber()
  gradeLevel?: number;

  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  lessonPlanCode?: string;

  @IsOptional()
  @IsString()
  publisher?: string;

  @IsOptional()
  @IsString()
  volume?: string;

  @IsOptional()
  @IsNumber()
  chapterId?: number;

  @IsOptional()
  @IsString()
  chapterTitle?: string;
}

export class UpdateLessonPlanDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsNumber()
  gradeLevel?: number;

  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  lessonPlanCode?: string | null;

  @IsOptional()
  @IsString()
  status?: LessonPlanStatus;

  @IsOptional()
  @IsString()
  publisher?: string | null;

  @IsOptional()
  @IsString()
  volume?: string | null;

  @IsOptional()
  @IsNumber()
  chapterId?: number | null;

  @IsOptional()
  @IsString()
  chapterTitle?: string | null;

  @IsOptional()
  curriculumRequirements?: CurriculumStandard[];

  @IsOptional()
  @IsString()
  objectives?: string | null;

  @IsOptional()
  @IsString()
  studentAnalysis?: string | null;

  @IsOptional()
  @IsString()
  materialsNeeded?: string | null;

  @IsOptional()
  @IsString()
  content?: string | null;

  @IsOptional()
  @IsString()
  assessmentMethods?: string | null;

  @IsOptional()
  @IsString()
  teachingMethods?: string | null;

  @IsOptional()
  @IsObject()
  extraProperties?: Record<string, string>;

  @IsOptional()
  @IsString()
  remark?: string | null;
}

export class PatchFieldDto {
  @IsString()
  field: SyncField;

  value: unknown;
}

export class AddAttachmentDto {
  @IsUUID()
  fileId: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsIn(['script', 'audio', 'ppt', 'pdf', 'other'])
  fileType?: 'script' | 'audio' | 'ppt' | 'pdf' | 'other';

  @IsOptional()
  @IsString()
  description?: string;

  // MCP-provided metadata (when adding attachment from MCP)
  @IsOptional()
  @IsString()
  _originalPath?: string;  // Relative path in session workspace

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsNumber()
  size?: number;
}
