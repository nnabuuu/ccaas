/**
 * API type definitions for Normal Student System
 *
 * These types define the API request/response structures used by RuoYi-Vue-Plus.
 */

/**
 * Generic API response wrapper from RuoYi
 */
export interface ApiResponse<T = unknown> {
  code: number
  msg: string
  data: T
}

/**
 * Page query parameters
 */
export interface PageQuery {
  pageNum?: number
  pageSize?: number
  orderByColumn?: string
  isAsc?: 'asc' | 'desc'
}

/**
 * Paginated response from TableDataInfo
 * Note: `data` is included for backward compatibility with some API patterns
 */
export interface PageResult<T> {
  total: number
  rows: T[]
  data?: T[]  // Some APIs return data instead of rows
  code: number
  msg: string
}

/**
 * Login request
 */
export interface LoginRequest {
  username: string
  password: string
  code?: string
  uuid?: string
  clientId?: string
  grantType?: string
}

/**
 * Login response
 */
export interface LoginResponse {
  access_token: string
  expires_in: number
  client_id?: string
}

/**
 * User info response (from /system/user/getInfo)
 */
export interface UserInfoResponse {
  user: {
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
  }
  roles: string[]
  permissions: string[]
}

// ============================================================================
// Generic CRUD request types
// ============================================================================

/**
 * Create request - omits id and audit fields
 */
export type CreateRequest<T> = Omit<T, 'id' | 'createBy' | 'createTime' | 'updateBy' | 'updateTime'>

/**
 * Update request - requires id
 */
export type UpdateRequest<T> = Partial<T> & { id: number }

// ============================================================================
// Entity-specific request types
// ============================================================================

import type {
  Project,
  LessonPlan,
  Schedule,
  School,
  Activity,
  CurriculumStandard,
  Textbook,
  TestPaper,
  Comment,
  InternshipSchool
} from './entities'

// Project
// Explicitly make creatorId optional in create request since it can be auto-filled by backend
export type ProjectCreateRequest = Omit<CreateRequest<Project>, 'creatorId'> & { creatorId?: number }
export type ProjectUpdateRequest = UpdateRequest<Project>
export interface ProjectQuery extends PageQuery {
  title?: string
  code?: string
  type?: string
  status?: string
  creatorId?: number
  schoolId?: number
  activityId?: number
}

// LessonPlan
export type LessonPlanCreateRequest = CreateRequest<LessonPlan>
export type LessonPlanUpdateRequest = UpdateRequest<LessonPlan>
export interface LessonPlanQuery extends PageQuery {
  title?: string
  lessonPlanCode?: string
  subject?: string
  gradeLevel?: number
  gradeId?: number
  status?: string
  schoolId?: number
  createBy?: number
}

// Schedule
export type ScheduleCreateRequest = CreateRequest<Schedule>
export type ScheduleUpdateRequest = UpdateRequest<Schedule>
export interface ScheduleQuery extends PageQuery {
  studentId?: number
  lessonPlanId?: number
  teacherId?: number
  schoolId?: number
  gradeId?: number
  scheduleDate?: string
  subject?: string
  status?: string | number
  startDateBegin?: string
  startDateEnd?: string
  createBy?: number
}

// Grade
export interface GradeQuery extends PageQuery {
  schoolId?: number
  status?: number
}

// School
export type SchoolCreateRequest = CreateRequest<School>
export type SchoolUpdateRequest = UpdateRequest<School>
export interface SchoolQuery extends PageQuery {
  schoolName?: string
  schoolCode?: string
  schoolType?: string
  province?: string
  city?: string
  status?: number
}

// Activity
export type ActivityCreateRequest = CreateRequest<Activity>
export type ActivityUpdateRequest = UpdateRequest<Activity>
export interface ActivityQuery extends PageQuery {
  title?: string
  status?: string
  creatorId?: number
}

// CurriculumStandard
export type CurriculumStandardCreateRequest = CreateRequest<CurriculumStandard>
export type CurriculumStandardUpdateRequest = UpdateRequest<CurriculumStandard>
export interface CurriculumStandardQuery extends PageQuery {
  standardCode?: string
  subject?: string
  /** Education stage (学段): 义务教育阶段第一学段, etc. */
  stage?: string
  /** Standard type: 内容要求 or 学业要求 */
  standardType?: string
  /** Content domain: 数与代数, 图形与几何, etc. */
  contentDomain?: string
  category?: string
  status?: number
}

/**
 * Query parameters for stage-based curriculum standard tree
 */
export interface CurriculumStandardTreeByStageQuery {
  subject?: string
  /** Education stage (学段): 义务教育阶段第一学段, etc. */
  stage?: string
  /** Standard type: 内容要求 or 学业要求 */
  standardType?: string
}

// Textbook
export type TextbookCreateRequest = CreateRequest<Textbook>
export type TextbookUpdateRequest = UpdateRequest<Textbook>
export interface TextbookQuery extends PageQuery {
  textbookCode?: string
  title?: string
  subject?: string
  gradeLevel?: number
  publisher?: string
  status?: number
}

// TestPaper
export type TestPaperCreateRequest = CreateRequest<TestPaper>
export type TestPaperUpdateRequest = UpdateRequest<TestPaper>
export interface TestPaperQuery extends PageQuery {
  testPaperCode?: string
  title?: string
  subject?: string
  gradeLevel?: number
  status?: string
  creatorId?: number
}

// Comment
export type CommentCreateRequest = CreateRequest<Comment>
export type CommentUpdateRequest = UpdateRequest<Comment>
export interface CommentQuery extends PageQuery {
  targetType?: string
  targetId?: number
  authorId?: number
  status?: number
}

// InternshipSchool
export type InternshipSchoolCreateRequest = CreateRequest<InternshipSchool>
export type InternshipSchoolUpdateRequest = UpdateRequest<InternshipSchool>
export interface InternshipSchoolQuery extends PageQuery {
  schoolName?: string
  province?: string
  city?: string
  status?: number
}

// ============================================================================
// Common utility types for API handling
// ============================================================================

/**
 * Axios error shape - used for type assertions in catch blocks
 * when accessing response data from axios errors
 */
export interface AxiosErrorShape {
  response?: {
    status?: number
    data?: {
      msg?: string
      code?: number
    }
  }
  message?: string
}

/**
 * Create response that may be wrapped or unwrapped
 * Used when API sometimes returns { data: { id } } and sometimes { id }
 */
export interface CreateResponse<T = { id: number }> {
  data?: T
  id?: number
}

/**
 * Flexible page result for APIs that return rows in different places
 */
export interface FlexiblePageResult<T> {
  data?: { rows?: T[]; total?: number }
  rows?: T[]
  total?: number
}
