/**
 * Entity type definitions for Normal Student System
 *
 * These types mirror the backend domain entities in ruoyi-normal module.
 * Field names must EXACTLY match the backend JSON serialization (camelCase).
 *
 * @see ruoyi-modules/ruoyi-normal/src/main/java/com/ruoyi/normal/domain/
 */

/**
 * Base entity fields from RuoYi BaseEntity
 *
 * RuoYi-Vue-Plus includes both username (createBy) and display name (createByName)
 * in API responses. The *Name fields are populated by the framework automatically.
 */
export interface BaseEntity {
  createBy?: string
  createByName?: string
  createTime?: string
  updateBy?: string
  updateByName?: string
  updateTime?: string
}

/**
 * School entity (学校/高校)
 */
export interface School extends BaseEntity {
  id: number
  schoolCode: string
  schoolName: string
  schoolType?: 'primary' | 'middle' | 'high' | 'university'
  province?: string
  city?: string
  district?: string
  address?: string
  contactPerson?: string
  contactPhone?: string
  contactEmail?: string
  status?: number // 0=active, 1=inactive
  description?: string
}

/**
 * Grade entity (年级)
 */
export interface Grade extends BaseEntity {
  id: number
  gradeName: string
  gradeLevel: number // 1-12
  schoolId: number
  description?: string
  status?: number
}

/**
 * SchoolClass entity (班级)
 */
export interface SchoolClass extends BaseEntity {
  id: number
  className: string
  classCode: string
  gradeId: number
  schoolId: number
  teacherId?: number
  studentCount?: number
  status?: number
  description?: string
}

/**
 * Project entity (项目)
 * Note: Uses 'title' NOT 'name' - this was the bug that motivated TypeScript migration
 */
export interface Project extends BaseEntity {
  id: number
  code: string
  title: string // NOT 'name'!
  description?: string
  type: 'research' | 'teaching' | 'practice' | 'other'
  status: 'draft' | 'in_progress' | 'completed' | 'archived'
  creatorId: number
  schoolId?: number
  startDate?: string
  endDate?: string
  phase?: 'PROPOSAL' | 'RESEARCH' | 'CONCLUSION'
  activityId?: number
  /** @deprecated Use computed count instead */
  memberCount?: number
}

/**
 * Activity entity (活动)
 */
export interface Activity extends BaseEntity {
  id: number
  title: string
  description?: string
  status?: 'draft' | 'active' | 'ended'
  startDate?: string
  endDate?: string
  creatorId?: number  // Optional - backend sets from authenticated user
}

/**
 * LessonPlan entity (教案)
 */
export interface LessonPlan extends BaseEntity {
  id: number
  lessonPlanCode: string
  title: string
  subject: string
  gradeLevel: number // 1-12
  durationMinutes: number
  objectives?: string
  content?: string
  teachingMethods?: string
  materialsNeeded?: string
  assessmentMethods?: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  schoolId: number

  // New fields: associations included by default from API
  textbookChapters?: TextbookChapter[]
  textbookChapterIds?: number[]
  curriculumStandards?: CurriculumStandard[]
  curriculumStandardIds?: number[]

  /** @deprecated Use textbookChapterIds */
  textbookChapterId?: number
  /** @deprecated Use association table */
  curriculumStandardIdsJson?: string
  /** @deprecated Use association table */
  textbookIds?: string
  /** @deprecated Use association table */
  sharedWith?: string
}

/**
 * Schedule entity (课程安排)
 */
export interface Schedule extends BaseEntity {
  id: number
  studentId?: number
  lessonPlanId?: number
  dayOfWeek?: number // 1-7 (Monday-Sunday)
  timeSlot?: string
  startDate?: string
  endDate?: string
  scheduleDate?: string
  startTime?: string
  endTime?: string
  courseName?: string
  subject?: string
  location?: string
  teacherId?: number
  schoolId?: number
  status?: 'active' | 'cancelled'
  remark?: string
  lessonPlanSnapshot?: string // JSON
  videoUrl?: string
}

/**
 * CurriculumStandard entity (课标)
 */
export interface CurriculumStandard extends BaseEntity {
  id: number
  standardCode: string
  title?: string
  subject: string
  /** @deprecated Use stage instead */
  gradeLevel?: number // 1-12
  /** Education stage (学段): 义务教育阶段第一学段, etc. */
  stage?: string
  /** Standard type: 内容要求 or 学业要求 */
  standardType?: string
  /** Content domain: 数与代数, 图形与几何, etc. */
  contentDomain?: string
  /** Level 1 hierarchy */
  level1?: string
  /** Level 2 hierarchy */
  level2?: string
  /** Level 3 hierarchy / actual content */
  level3?: string
  category?: string
  subcategory?: string
  description?: string
  content?: string
  version?: string
  effectiveDate?: string
  status?: number // 0=inactive, 1=active
}

/**
 * Tree node type for curriculum standard hierarchy
 */
export interface CurriculumStandardTreeNode extends CurriculumStandard {
  /** Whether this is a leaf node (actual standard) */
  isLeaf?: boolean
  children?: CurriculumStandardTreeNode[]
}

/**
 * Textbook entity (教材)
 */
export interface Textbook extends BaseEntity {
  id: number
  textbookCode: string
  title: string
  subject: string
  gradeLevel: number // 1-12
  publisher?: string
  edition?: string
  isbn?: string
  publicationYear?: number
  description?: string
  status?: number // 0=active, 1=inactive
}

/**
 * TextbookEdition entity (教材版本)
 */
export interface TextbookEdition extends BaseEntity {
  id: number
  subject: string
  publisher: string
  version?: string
  stage?: string
  grade: number
  volume: string
  status?: number // 0=inactive, 1=active
}

/**
 * TextbookChapter entity (教材章节)
 */
export interface TextbookChapter extends BaseEntity {
  id: number
  textbookEditionId: number
  parentId?: number
  chapterCode?: string
  title: string
  sortOrder?: number
  status?: number
  children?: TextbookChapter[]
}

/**
 * TextbookOptionsDTO for cascading selector
 */
export interface TextbookOptionsDTO {
  id: number
  label: string
}

/**
 * TestPaper entity (试卷)
 */
export interface TestPaper extends BaseEntity {
  id: number
  testPaperCode: string
  title: string
  subject: string
  gradeLevel: number
  totalScore: number
  durationMinutes: number
  description?: string
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  creatorId: number
  schoolId?: number
}

/**
 * Comment entity (评论)
 */
export interface Comment extends BaseEntity {
  id: number
  targetType: string // 'lesson_plan', 'project', etc.
  targetId: number
  content: string
  authorId?: number // Optional on create - derived from auth context by backend
  parentId?: number
  status?: number
}

/**
 * Threaded comment node for nested display
 */
export interface CommentTreeNode {
  id: number
  content: string
  userId: number
  userName?: string
  createTime: string
  replies: CommentTreeNode[]
}

/**
 * InternshipSchool entity (实习学校)
 */
export interface InternshipSchool extends BaseEntity {
  id: number
  schoolName: string
  schoolCode?: string
  province?: string
  city?: string
  district?: string
  address?: string
  contactPerson?: string
  contactPhone?: string
  contactEmail?: string
  capacity?: number
  status?: number
  description?: string
}

/**
 * ProjectMember entity (项目成员)
 */
export interface ProjectMember extends BaseEntity {
  id: number
  projectId: number
  userId: number
  role: 'leader' | 'member' | 'advisor'
  status?: number // 0=inactive, 1=active
  joinedAt?: string
}

/**
 * User info (from system module)
 */
export interface User {
  userId: number
  userName: string
  nickName: string
  email?: string
  phonenumber?: string
  sex?: string
  avatar?: string
  status?: string
  deptId?: number
  deptName?: string
  roles?: Role[]
}

/**
 * Role (from system module)
 */
export interface Role {
  roleId: number
  roleName: string
  roleKey: string
  status?: string
}

/**
 * AttentionItem entity (关注事项/Feed item)
 */
export interface AttentionItem extends BaseEntity {
  id: number
  userId?: number
  itemType?: string
  itemId?: number
  status?: number
  // Feed display properties
  category: 'pending' | 'updated' | 'reminder' | 'activity' | string
  title: string
  description?: string
  timestamp?: string
  isRead?: boolean
  targetPath?: string
}

/**
 * CourseAnalysis entity (课程分析)
 */
export interface CourseAnalysis extends BaseEntity {
  id: number
  scheduleId: number
  analysisContent?: string
  strengths?: string
  weaknesses?: string
  improvements?: string
  creatorId: number
}

/**
 * NotificationTemplate entity (通知模板)
 */
export interface NotificationTemplate extends BaseEntity {
  id: number
  templateCode: string
  title: string
  content: string
  channel: 'email' | 'sms' | 'push'
  status?: number
}

/**
 * NotificationDelivery entity (通知发送记录)
 */
export interface NotificationDelivery extends BaseEntity {
  id: number
  templateId: number
  recipientId: number
  channel: string
  status: 'pending' | 'sent' | 'failed'
  sentAt?: string
  errorMessage?: string
}

/**
 * NotificationPreference entity (通知偏好)
 */
export interface NotificationPreference extends BaseEntity {
  id: number
  userId: number
  channel: string
  enabled: boolean
  notificationType?: string
}

/**
 * Approval status for question bank items
 */
export type ApprovalStatus = 'draft' | 'submitted' | 'approved' | 'needs_revision'

/**
 * QuestionBankItem entity (题库题目)
 */
export interface QuestionBankItem extends BaseEntity {
  id: number
  questionCode?: string
  title: string
  content: string
  questionType: 'single_choice' | 'multiple_choice' | 'true_false' | 'fill_blank' | 'essay'
  subject?: string
  gradeLevel?: number
  difficulty?: number // 1-5
  options?: string // JSON for choices
  answer?: string
  explanation?: string
  tags?: string
  status?: number
  creatorId?: number
  /** Approval workflow status */
  approvalStatus?: ApprovalStatus
  /** Optional metadata JSON */
  metadata?: string
}

/**
 * QuestionBankItem with associated curriculum standards
 */
export interface QuestionBankItemWithCurriculumStandards {
  question: QuestionBankItem
  curriculumStandards: CurriculumStandard[]
}

/**
 * ResearchTopic entity (研究选题)
 */
export interface ResearchTopic extends BaseEntity {
  id: number
  title: string
  description?: string
  category?: string
  status?: 'draft' | 'approved' | 'in_progress' | 'completed'
  creatorId?: number
  projectId?: number
}

/**
 * ResearchQuestion entity (研究问题)
 */
export interface ResearchQuestion extends BaseEntity {
  id: number
  topicId: number
  content: string
  sequence?: number
  status?: number
  answer?: string
}

/**
 * CourseReflection entity (教学反思)
 */
export interface CourseReflection extends BaseEntity {
  id: number
  scheduleId: number
  content?: string
  aiContent?: string
  aiStatus?: 'not_started' | 'in_progress' | 'completed' | 'failed'
  aiGeneratedAt?: string
  status?: 'draft' | 'published'
}

/**
 * TeachingEvaluation entity (授课评价)
 */
export interface TeachingEvaluation extends BaseEntity {
  id: number
  scheduleId: number
  reviewerId?: number
  videoId?: number
  introductionScore?: number
  processControlScore?: number
  interactionScore?: number
  timeManagementScore?: number
  visualAidsScore?: number
  overallScore?: number
  comment?: string
  isAiGenerated?: number
  status?: string
}

/**
 * LessonPlanEvaluation entity (教案评价)
 */
export interface LessonPlanEvaluation extends BaseEntity {
  id: number
  scheduleId: number
  lessonPlanId?: number
  reviewerId?: number
  objectiveDesignScore?: number
  contentOrganizationScore?: number
  taskDesignScore?: number
  homeworkDesignScore?: number
  resourcePreparationScore?: number
  overallScore?: number
  comment?: string
  isAiGenerated?: number
  status?: string
}

// ============================================================================
// Runtime Type Guards
// ============================================================================

/**
 * Type guard for Project entity
 * Use at API boundaries to catch backend schema changes at runtime
 */
export function isProject(data: unknown): data is Project {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'title' in data &&
    typeof (data as Project).id === 'number' &&
    typeof (data as Project).title === 'string'
  )
}

/**
 * Type guard for LessonPlan entity
 */
export function isLessonPlan(data: unknown): data is LessonPlan {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'title' in data &&
    'subject' in data &&
    typeof (data as LessonPlan).id === 'number' &&
    typeof (data as LessonPlan).title === 'string'
  )
}

/**
 * Type guard for Schedule entity
 */
export function isSchedule(data: unknown): data is Schedule {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    typeof (data as Schedule).id === 'number'
  )
}

/**
 * Type guard for School entity
 */
export function isSchool(data: unknown): data is School {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'schoolName' in data &&
    typeof (data as School).id === 'number' &&
    typeof (data as School).schoolName === 'string'
  )
}
