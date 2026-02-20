import { IsString, IsOptional, IsArray, IsObject } from 'class-validator';

// Domain types
export interface LearningObjective {
  id: string;
  description: string;
  bloomLevel: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
  assessmentCriteria?: string;
}

export interface Standard {
  id: string;
  code: string;
  description: string;
}

export interface Material {
  id: string;
  name: string;
  type: 'textbook' | 'handout' | 'digital' | 'manipulative' | 'other';
  url?: string;
  notes?: string;
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  duration: number;
  type: 'introduction' | 'direct-instruction' | 'guided-practice' | 'independent-practice' | 'group' | 'assessment' | 'closure';
  instructions: string[];
  materials?: string[];
  teacherNotes?: string;
}

export interface Assessment {
  formative: string[];
  summative: string[];
  rubric?: string;
}

export interface Differentiation {
  struggling: string[];
  onLevel: string[];
  advanced: string[];
  ell?: string[];
  accommodations?: string[];
}

export interface LessonPlan {
  id: string;
  tenantId: string;
  title: string;
  subject: string;
  gradeLevel: string;
  duration: string;
  // Textbook information
  publisher?: string;
  volume?: string;
  chapterId?: number;
  chapterTitle?: string;
  // Content
  objectives: LearningObjective[];
  standards: Standard[];
  materials: Material[];
  activities: Activity[];
  assessment: Assessment;
  differentiation: Differentiation;
  status: 'draft' | 'review' | 'published';
  createdAt: string;
  updatedAt: string;
}

// Sync fields
export const SYNC_FIELDS = [
  'title', 'subject', 'gradeLevel', 'duration',
  'publisher', 'volume', 'chapterId', 'chapterTitle',
  'objectives', 'standards', 'materials', 'activities',
  'assessment', 'differentiation',
] as const;

export type SyncField = typeof SYNC_FIELDS[number];

// Database row type
export interface LessonPlanRow {
  id: string;
  tenant_id: string;
  title: string;
  subject: string;
  grade_level: string;
  duration: string;
  publisher: string | null;
  volume: string | null;
  chapter_id: number | null;
  chapter_title: string | null;
  objectives: string;
  standards: string;
  materials: string;
  activities: string;
  assessment: string;
  differentiation: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// DTOs
export class CreateLessonPlanDto {
  @IsString()
  tenantId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  gradeLevel?: string;

  @IsOptional()
  @IsString()
  duration?: string;

  @IsOptional()
  @IsString()
  publisher?: string;

  @IsOptional()
  @IsString()
  volume?: string;

  @IsOptional()
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
  @IsString()
  gradeLevel?: string;

  @IsOptional()
  @IsString()
  duration?: string;

  @IsOptional()
  @IsString()
  publisher?: string;

  @IsOptional()
  @IsString()
  volume?: string;

  @IsOptional()
  chapterId?: number;

  @IsOptional()
  @IsString()
  chapterTitle?: string;

  @IsOptional()
  @IsArray()
  objectives?: LearningObjective[];

  @IsOptional()
  @IsArray()
  standards?: Standard[];

  @IsOptional()
  @IsArray()
  materials?: Material[];

  @IsOptional()
  @IsArray()
  activities?: Activity[];

  @IsOptional()
  @IsObject()
  assessment?: Assessment;

  @IsOptional()
  @IsObject()
  differentiation?: Differentiation;

  @IsOptional()
  @IsString()
  status?: 'draft' | 'review' | 'published';
}

export class PatchFieldDto {
  @IsString()
  field: SyncField;

  value: unknown;
}
