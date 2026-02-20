/**
 * Type definitions barrel export
 *
 * Import types from here:
 *   import type { Project, LessonPlan, PageResult } from '@/types'
 */

// Entity types
export type {
  BaseEntity,
  School,
  Grade,
  SchoolClass,
  Project,
  Activity,
  LessonPlan,
  Schedule,
  CurriculumStandard,
  CurriculumStandardTreeNode,
  Textbook,
  TextbookEdition,
  TextbookChapter,
  TextbookOptionsDTO,
  TestPaper,
  Comment,
  CommentTreeNode,
  InternshipSchool,
  ProjectMember,
  User,
  Role,
  AttentionItem,
  CourseAnalysis,
  NotificationTemplate,
  NotificationDelivery,
  NotificationPreference,
  QuestionBankItem,
  QuestionBankItemWithCurriculumStandards,
  ApprovalStatus,
  ResearchTopic,
  ResearchQuestion,
  CourseReflection,
  TeachingEvaluation,
  LessonPlanEvaluation
} from './entities'

// Runtime type guards
export {
  isProject,
  isLessonPlan,
  isSchedule,
  isSchool
} from './entities'

// Lesson plan content types (from composable, re-exported for convenience)
export type {
  CourseRequirements,
  LearningObjective,
  PreparationTask,
  LearningTask,
  HomeworkTask,
  HomeworkTaskAuthenticity,
  CourseRequirement,
  AssessmentTask,
  SubTask,
  LessonPlanContent
} from '../composables/useLessonPlanParser'

// Agent Form Bridge types
export type {
  ApplyResult,
  FieldError,
  SubmitResult,
  FormFieldShape,
  FormDataShape,
  AgentFormHandlers,
  RegisterAgentForm,
  AgentFormInfo,
  PendingFormCommand
} from './agent-form'

// Lesson plan types
export type {
  TextbookAnalysisSection,
  TextbookAnalysisValue
} from './lesson-plan'

export {
  isTextbookAnalysisValue,
  textbookAnalysisToMarkdown
} from './lesson-plan'

// Agent message types (Manus UI style)
export type {
  TaskStatus,
  TaskActivity,
  AgentTask,
  RunMetadata,
  ToolIconMapping,
  ToolCall,
  Todo
} from './agent-message'

export {
  TOOL_ICON_MAP,
  getToolIconAndAction,
  extractToolParam,
  transformToTasks,
  toolCallToActivity
} from './agent-message'

// API types
export type {
  ApiResponse,
  PageQuery,
  PageResult,
  LoginRequest,
  LoginResponse,
  UserInfoResponse,
  CreateRequest,
  UpdateRequest,
  // Entity-specific types
  ProjectCreateRequest,
  ProjectUpdateRequest,
  ProjectQuery,
  LessonPlanCreateRequest,
  LessonPlanUpdateRequest,
  LessonPlanQuery,
  ScheduleCreateRequest,
  ScheduleUpdateRequest,
  ScheduleQuery,
  SchoolCreateRequest,
  SchoolUpdateRequest,
  SchoolQuery,
  ActivityCreateRequest,
  ActivityUpdateRequest,
  ActivityQuery,
  CurriculumStandardCreateRequest,
  CurriculumStandardUpdateRequest,
  CurriculumStandardQuery,
  CurriculumStandardTreeByStageQuery,
  TextbookCreateRequest,
  TextbookUpdateRequest,
  TextbookQuery,
  TestPaperCreateRequest,
  TestPaperUpdateRequest,
  TestPaperQuery,
  CommentCreateRequest,
  CommentUpdateRequest,
  CommentQuery,
  InternshipSchoolCreateRequest,
  InternshipSchoolUpdateRequest,
  InternshipSchoolQuery,
  // Utility types for API handling
  AxiosErrorShape,
  CreateResponse,
  FlexiblePageResult
} from './api'
