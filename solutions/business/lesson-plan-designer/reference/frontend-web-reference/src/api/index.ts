import request from '../utils/request'
import type {
  ApiResponse,
  PageResult,
  LoginRequest,
  LoginResponse,
  UserInfoResponse,
  Project,
  ProjectQuery,
  ProjectCreateRequest,
  ProjectUpdateRequest,
  LessonPlan,
  LessonPlanQuery,
  LessonPlanCreateRequest,
  LessonPlanUpdateRequest,
  Schedule,
  ScheduleQuery,
  ScheduleCreateRequest,
  ScheduleUpdateRequest,
  School,
  SchoolQuery,
  SchoolCreateRequest,
  SchoolUpdateRequest,
  Activity,
  ActivityQuery,
  ActivityCreateRequest,
  ActivityUpdateRequest,
  CurriculumStandard,
  CurriculumStandardQuery,
  CurriculumStandardTreeByStageQuery,
  CurriculumStandardTreeNode,
  Textbook,
  TextbookQuery,
  TextbookChapter,
  TextbookOptionsDTO,
  TestPaper,
  TestPaperQuery,
  TestPaperCreateRequest,
  TestPaperUpdateRequest,
  Comment,
  CommentQuery,
  CommentCreateRequest,
  CommentTreeNode,
  InternshipSchool,
  InternshipSchoolQuery,
  InternshipSchoolCreateRequest,
  InternshipSchoolUpdateRequest,
  Grade,
  SchoolClass,
  ProjectMember,
  AttentionItem,
  CourseAnalysis,
  QuestionBankItem,
  ResearchTopic,
  ResearchQuestion,
  CourseReflection,
  TeachingEvaluation,
  LessonPlanEvaluation
} from '@/types'

/**
 * Auth API
 */
export const authApi = {
  login(data: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    return request.post('/auth/login', data)
  },
  logout(): Promise<ApiResponse<void>> {
    return request.post('/auth/logout')
  },
  getTenantList(): Promise<ApiResponse<{ tenantId: string; companyName: string }[]>> {
    return request.get('/auth/tenant/list')
  }
}

/**
 * User API
 */
export const userApi = {
  getInfo(): Promise<ApiResponse<UserInfoResponse>> {
    return request.get('/system/user/getInfo')
  },
  getProfile(): Promise<ApiResponse<unknown>> {
    return request.get('/system/user/profile')
  },
  updateProfile(data: unknown): Promise<ApiResponse<void>> {
    return request.put('/system/user/profile', data)
  }
}

/**
 * Lesson Plan API
 */
export const lessonPlanApi = {
  getList(params: LessonPlanQuery = {}): Promise<PageResult<LessonPlan>> {
    return request.get('/normal/lessonplan/list', { params })
  },
  getById(id: number): Promise<ApiResponse<LessonPlan>> {
    return request.get(`/normal/lessonplan/${id}`)
  },
  create(data: LessonPlanCreateRequest): Promise<ApiResponse<LessonPlan>> {
    return request.post('/normal/lessonplan', data)
  },
  update(data: LessonPlanUpdateRequest): Promise<ApiResponse<void>> {
    return request.put('/normal/lessonplan', data)
  },
  delete(ids: number | number[]): Promise<ApiResponse<void>> {
    const idsStr = Array.isArray(ids) ? ids.join(',') : ids
    return request.delete(`/normal/lessonplan/${idsStr}`)
  },
  getCurriculumStandards(id: number): Promise<ApiResponse<CurriculumStandard[]>> {
    return request.get(`/normal/lessonplan/${id}/curriculum-standards`)
  },
  setCurriculumStandards(id: number, curriculumStandardIds: number[]): Promise<ApiResponse<void>> {
    return request.post(`/normal/lessonplan/${id}/curriculum-standards`, { curriculumStandardIds })
  },
  getTextbookChapters(id: number): Promise<ApiResponse<TextbookChapter[]>> {
    return request.get(`/normal/lessonplan/${id}/textbook-chapters`)
  },
  setTextbookChapters(id: number, textbookChapterIds: number[]): Promise<ApiResponse<void>> {
    return request.post(`/normal/lessonplan/${id}/textbook-chapters`, { textbookChapterIds })
  }
}

/**
 * School API
 */
export const schoolApi = {
  getList(params: SchoolQuery = {}): Promise<PageResult<School>> {
    return request.get('/system/school/list', { params })
  },
  getById(id: number): Promise<ApiResponse<School>> {
    return request.get(`/system/school/${id}`)
  },
  create(data: SchoolCreateRequest): Promise<ApiResponse<School>> {
    return request.post('/system/school', data)
  },
  update(data: SchoolUpdateRequest): Promise<ApiResponse<void>> {
    return request.put('/system/school', data)
  },
  delete(ids: number | number[]): Promise<ApiResponse<void>> {
    const idsStr = Array.isArray(ids) ? ids.join(',') : ids
    return request.delete(`/system/school/${idsStr}`)
  }
}

/**
 * Grade API
 */
export const gradeApi = {
  getList(params: { schoolId?: number; status?: number; pageNum?: number; pageSize?: number } = {}): Promise<PageResult<Grade>> {
    return request.get('/system/grade/list', { params })
  },
  getById(id: number): Promise<ApiResponse<Grade>> {
    return request.get(`/system/grade/${id}`)
  },
  create(data: Partial<Grade>): Promise<ApiResponse<Grade>> {
    return request.post('/system/grade', data)
  },
  update(data: Partial<Grade> & { id: number }): Promise<ApiResponse<void>> {
    return request.put('/system/grade', data)
  },
  delete(ids: number | number[]): Promise<ApiResponse<void>> {
    const idsStr = Array.isArray(ids) ? ids.join(',') : ids
    return request.delete(`/system/grade/${idsStr}`)
  }
}

/**
 * School Class API
 */
export const schoolClassApi = {
  getList(params: { gradeId?: number; schoolId?: number; status?: number } = {}): Promise<PageResult<SchoolClass>> {
    return request.get('/system/class/list', { params })
  },
  getById(id: number): Promise<ApiResponse<SchoolClass>> {
    return request.get(`/system/class/${id}`)
  },
  create(data: Partial<SchoolClass>): Promise<ApiResponse<SchoolClass>> {
    return request.post('/system/class', data)
  },
  update(data: Partial<SchoolClass> & { id: number }): Promise<ApiResponse<void>> {
    return request.put('/system/class', data)
  },
  delete(ids: number | number[]): Promise<ApiResponse<void>> {
    const idsStr = Array.isArray(ids) ? ids.join(',') : ids
    return request.delete(`/system/class/${idsStr}`)
  }
}

/**
 * Activity API (活动管理)
 */
export const activityApi = {
  getList(params: ActivityQuery = {}): Promise<PageResult<Activity>> {
    return request.get('/normal/activity/list', { params })
  },
  getById(id: number): Promise<ApiResponse<Activity>> {
    return request.get(`/normal/activity/${id}`)
  },
  create(data: ActivityCreateRequest): Promise<ApiResponse<Activity>> {
    return request.post('/normal/activity', data)
  },
  update(data: ActivityUpdateRequest): Promise<ApiResponse<void>> {
    return request.put('/normal/activity', data)
  },
  delete(ids: number | number[]): Promise<ApiResponse<void>> {
    const idsStr = Array.isArray(ids) ? ids.join(',') : ids
    return request.delete(`/normal/activity/${idsStr}`)
  }
}

/**
 * Project API
 * Note: Project uses 'title' field, NOT 'name'
 */
export const projectApi = {
  getList(params: ProjectQuery = {}): Promise<PageResult<Project>> {
    return request.get('/system/project/list', { params })
  },
  getById(id: number): Promise<ApiResponse<Project>> {
    return request.get(`/system/project/${id}`)
  },
  getByActivityId(activityId: number): Promise<ApiResponse<Project[]>> {
    return request.get(`/system/project/activity/${activityId}`)
  },
  getStandalone(): Promise<ApiResponse<Project[]>> {
    return request.get('/system/project/standalone')
  },
  getMyProjects(role?: string): Promise<ApiResponse<Project[]>> {
    return request.get('/system/project/my-projects', { params: role ? { role } : {} })
  },
  create(data: ProjectCreateRequest): Promise<ApiResponse<Project>> {
    return request.post('/system/project', data)
  },
  update(data: ProjectUpdateRequest): Promise<ApiResponse<void>> {
    return request.put('/system/project', data)
  },
  delete(ids: number | number[]): Promise<ApiResponse<void>> {
    const idsStr = Array.isArray(ids) ? ids.join(',') : ids
    return request.delete(`/system/project/${idsStr}`)
  }
}

/**
 * Project Member API
 */
export const projectMemberApi = {
  getList(params: { projectId?: number } = {}): Promise<PageResult<ProjectMember>> {
    return request.get('/system/project-member/list', { params })
  },
  getByProjectId(projectId: number): Promise<ApiResponse<ProjectMember[]>> {
    return request.get(`/system/project-member/project/${projectId}`)
  },
  addMember(data: Partial<ProjectMember>): Promise<ApiResponse<ProjectMember>> {
    return request.post('/system/project-member', data)
  },
  removeMember(id: number): Promise<ApiResponse<void>> {
    return request.delete(`/system/project-member/${id}`)
  }
}

/**
 * Test Paper API
 */
export const testPaperApi = {
  getList(params: TestPaperQuery = {}): Promise<PageResult<TestPaper>> {
    return request.get('/system/testpaper/list', { params })
  },
  getById(id: number): Promise<ApiResponse<TestPaper>> {
    return request.get(`/system/testpaper/${id}`)
  },
  create(data: TestPaperCreateRequest): Promise<ApiResponse<TestPaper>> {
    return request.post('/system/testpaper', data)
  },
  update(data: TestPaperUpdateRequest): Promise<ApiResponse<void>> {
    return request.put('/system/testpaper', data)
  },
  delete(ids: number | number[]): Promise<ApiResponse<void>> {
    const idsStr = Array.isArray(ids) ? ids.join(',') : ids
    return request.delete(`/system/testpaper/${idsStr}`)
  }
}

/**
 * Question Bank Item with Curriculum Standards response
 */
interface QuestionBankItemWithCurriculumStandards {
  question: QuestionBankItem
  curriculumStandards: CurriculumStandard[]
}

/**
 * Question Bank API
 * Note: Controller path changed from /system/question-bank to /normal/question-bank
 */
export const questionBankApi = {
  /** Admin view - list approved questions */
  getList(params: { subject?: string; questionType?: string; approvalStatus?: string; pageNum?: number; pageSize?: number } = {}): Promise<PageResult<QuestionBankItem>> {
    return request.get('/normal/question-bank/list', { params })
  },
  /** Student view - get my questions with optional status filter */
  getMyQuestions(params: { approvalStatus?: string; pageNum?: number; pageSize?: number } = {}): Promise<PageResult<QuestionBankItem>> {
    return request.get('/normal/question-bank/my-questions', { params })
  },
  /** Advisor view - get pending review queue */
  getReviewQueue(params: { pageNum?: number; pageSize?: number } = {}): Promise<PageResult<QuestionBankItem>> {
    return request.get('/normal/question-bank/review-queue', { params })
  },
  getById(id: number): Promise<ApiResponse<QuestionBankItem>> {
    return request.get(`/normal/question-bank/${id}`)
  },
  /** Get question with associated curriculum standards */
  getByIdWithStandards(id: number): Promise<ApiResponse<QuestionBankItemWithCurriculumStandards>> {
    return request.get(`/normal/question-bank/${id}/with-standards`)
  },
  create(data: Partial<QuestionBankItem>): Promise<ApiResponse<QuestionBankItem>> {
    return request.post('/normal/question-bank', data)
  },
  /** Create question with curriculum standard associations */
  createWithStandards(data: Partial<QuestionBankItem>, curriculumStandardIds?: number[]): Promise<ApiResponse<void>> {
    const params = curriculumStandardIds ? { curriculumStandardIds: curriculumStandardIds.join(',') } : {}
    return request.post('/normal/question-bank/with-standards', data, { params })
  },
  update(data: Partial<QuestionBankItem> & { id: number }): Promise<ApiResponse<void>> {
    return request.put('/normal/question-bank', data)
  },
  /** Update question with curriculum standard associations */
  updateWithStandards(data: Partial<QuestionBankItem> & { id: number }, curriculumStandardIds?: number[]): Promise<ApiResponse<void>> {
    const params = curriculumStandardIds ? { curriculumStandardIds: curriculumStandardIds.join(',') } : {}
    return request.put('/normal/question-bank/with-standards', data, { params })
  },
  delete(ids: number | number[]): Promise<ApiResponse<void>> {
    const idsStr = Array.isArray(ids) ? ids.join(',') : ids
    return request.delete(`/normal/question-bank/${idsStr}`)
  },
  // Workflow actions
  /** Submit question for review (student action) */
  submitForReview(id: number): Promise<ApiResponse<void>> {
    return request.put(`/normal/question-bank/${id}/submit`)
  },
  /** Approve question (advisor action) */
  approve(id: number): Promise<ApiResponse<void>> {
    return request.put(`/normal/question-bank/${id}/approve`)
  },
  /** Reject question / request revision (advisor action) */
  reject(id: number): Promise<ApiResponse<void>> {
    return request.put(`/normal/question-bank/${id}/reject`)
  },
  // Curriculum standard associations
  getCurriculumStandards(questionId: number): Promise<ApiResponse<CurriculumStandard[]>> {
    return request.get(`/normal/question-bank/${questionId}/curriculum-standards`)
  },
  setCurriculumStandards(questionId: number, curriculumStandardIds: number[]): Promise<ApiResponse<void>> {
    return request.put(`/normal/question-bank/${questionId}/curriculum-standards`, curriculumStandardIds)
  }
}

/**
 * Comment API
 */
export const commentApi = {
  getList(params: CommentQuery = {}): Promise<PageResult<Comment>> {
    return request.get('/system/comment/list', { params })
  },
  getByTargetId(targetType: string, targetId: number): Promise<ApiResponse<Comment[]>> {
    return request.get(`/system/comment/target/${targetType}/${targetId}`)
  },
  getThreaded(targetType: string, targetId: number): Promise<ApiResponse<CommentTreeNode[]>> {
    return request.get('/system/comment/threaded', { params: { targetType, targetId } })
  },
  create(data: CommentCreateRequest): Promise<ApiResponse<Comment>> {
    return request.post('/system/comment', data)
  },
  delete(id: number): Promise<ApiResponse<void>> {
    return request.delete(`/system/comment/${id}`)
  }
}

/**
 * Textbook API
 */
export const textbookApi = {
  getList(params: TextbookQuery = {}): Promise<PageResult<Textbook>> {
    return request.get('/system/textbook/list', { params })
  },
  getById(id: number): Promise<ApiResponse<Textbook>> {
    return request.get(`/system/textbook/${id}`)
  }
}

/**
 * Textbook Edition API (教材版本)
 * Provides cascading selector options for textbook edition selection
 */
export const textbookEditionApi = {
  /** Get distinct subjects */
  getSubjects(): Promise<ApiResponse<string[]>> {
    return request.get('/normal/textbook-edition/options/subjects')
  },
  /** Get grades for a subject */
  getGrades(subject?: string): Promise<ApiResponse<number[]>> {
    return request.get('/normal/textbook-edition/options/grades', { params: { subject } })
  },
  /** Get publishers for a subject and grade */
  getPublishers(subject?: string, grade?: number): Promise<ApiResponse<string[]>> {
    return request.get('/normal/textbook-edition/options/publishers', { params: { subject, grade } })
  },
  /** Get volumes for a subject and grade */
  getVolumes(subject?: string, grade?: number): Promise<ApiResponse<TextbookOptionsDTO[]>> {
    return request.get('/normal/textbook-edition/options/volumes', { params: { subject, grade } })
  },
  /** Get volumes by subject, grade, and publisher */
  getVolumesByPublisher(subject?: string, grade?: number, publisher?: string): Promise<ApiResponse<TextbookOptionsDTO[]>> {
    return request.get('/normal/textbook-edition/options/volumes-by-publisher', { params: { subject, grade, publisher } })
  },
  /** Get chapter tree for a textbook edition */
  getChapterTree(editionId: number): Promise<ApiResponse<TextbookChapter[]>> {
    return request.get(`/normal/textbook-edition/${editionId}/chapter-tree`)
  }
}

/**
 * Curriculum Standard API
 */
export const curriculumStandardApi = {
  getList(params: CurriculumStandardQuery = {}): Promise<PageResult<CurriculumStandard>> {
    return request.get('/system/curriculum-standard/list', { params })
  },
  /**
   * @deprecated Use getTreeByStage instead
   */
  getTree(params: { subject?: string; gradeLevel?: number } = {}): Promise<ApiResponse<CurriculumStandardTreeNode[]>> {
    return request.get('/system/curriculum-standard/tree', { params })
  },
  /**
   * Get curriculum standards as tree structure grouped by content domain and level
   * This is the new stage-based API that replaces the grade-level based /tree endpoint
   *
   * @param params.subject - optional subject filter (数学, 物理, 化学)
   * @param params.stage - optional stage filter (义务教育阶段第一学段, etc.)
   * @param params.standardType - optional standard type filter (内容要求, 学业要求)
   */
  getTreeByStage(params: CurriculumStandardTreeByStageQuery = {}): Promise<ApiResponse<CurriculumStandardTreeNode[]>> {
    return request.get('/system/curriculum-standard/tree-by-stage', { params })
  }
}

/**
 * Schedule API (课程安排)
 */
export const scheduleApi = {
  getList(params: ScheduleQuery = {}): Promise<PageResult<Schedule>> {
    return request.get('/system/schedule/list', { params })
  },
  getById(id: number): Promise<ApiResponse<Schedule>> {
    return request.get(`/system/schedule/${id}`)
  },
  getByStudent(studentId: number): Promise<ApiResponse<Schedule[]>> {
    return request.get(`/system/schedule/student/${studentId}`)
  },
  getByLessonPlan(lessonPlanId: number): Promise<ApiResponse<Schedule[]>> {
    return request.get(`/system/schedule/lesson-plan/${lessonPlanId}`)
  },
  create(data: ScheduleCreateRequest): Promise<ApiResponse<Schedule>> {
    return request.post('/system/schedule', data)
  },
  update(data: ScheduleUpdateRequest): Promise<ApiResponse<void>> {
    return request.put('/system/schedule', data)
  },
  delete(ids: number | number[]): Promise<ApiResponse<void>> {
    const idsStr = Array.isArray(ids) ? ids.join(',') : ids
    return request.delete(`/system/schedule/${idsStr}`)
  },
  generate(data: unknown): Promise<ApiResponse<unknown>> {
    return request.post('/system/schedule/generate', data)
  },
  // Course Detail page extensions
  getFullById(id: number): Promise<ApiResponse<unknown>> {
    return request.get(`/system/schedule/${id}/full`)
  },
  saveSnapshot(data: { id: number; lessonPlanSnapshot: string }): Promise<ApiResponse<void>> {
    return request.put('/system/schedule/snapshot', data)
  },
  clearSnapshot(scheduleId: number): Promise<ApiResponse<void>> {
    return request.delete(`/system/schedule/snapshot/${scheduleId}`)
  }
}

/**
 * Course Analysis API
 */
export const courseAnalysisApi = {
  getList(params: { scheduleId?: number } = {}): Promise<PageResult<CourseAnalysis>> {
    return request.get('/system/course-analysis/list', { params })
  },
  getById(id: number): Promise<ApiResponse<CourseAnalysis>> {
    return request.get(`/system/course-analysis/${id}`)
  },
  create(data: Partial<CourseAnalysis>): Promise<ApiResponse<CourseAnalysis>> {
    return request.post('/system/course-analysis', data)
  },
  update(data: Partial<CourseAnalysis> & { id: number }): Promise<ApiResponse<void>> {
    return request.put('/system/course-analysis', data)
  },
  delete(ids: number | number[]): Promise<ApiResponse<void>> {
    const idsStr = Array.isArray(ids) ? ids.join(',') : ids
    return request.delete(`/system/course-analysis/${idsStr}`)
  }
}

/**
 * Internship School API
 */
export const internshipSchoolApi = {
  getList(params: InternshipSchoolQuery = {}): Promise<PageResult<InternshipSchool>> {
    return request.get('/system/internship/list', { params })
  },
  getById(id: number): Promise<ApiResponse<InternshipSchool>> {
    return request.get(`/system/internship/${id}`)
  },
  create(data: InternshipSchoolCreateRequest): Promise<ApiResponse<InternshipSchool>> {
    return request.post('/system/internship', data)
  },
  update(data: InternshipSchoolUpdateRequest): Promise<ApiResponse<void>> {
    return request.put('/system/internship', data)
  },
  delete(ids: number | number[]): Promise<ApiResponse<void>> {
    const idsStr = Array.isArray(ids) ? ids.join(',') : ids
    return request.delete(`/system/internship/${idsStr}`)
  }
}

/**
 * Research Topic API
 */
export const researchTopicApi = {
  getList(params: { category?: string; status?: string; pageNum?: number; pageSize?: number } = {}): Promise<PageResult<ResearchTopic>> {
    return request.get('/system/research-topic/list', { params })
  },
  getById(id: number): Promise<ApiResponse<ResearchTopic>> {
    return request.get(`/system/research-topic/${id}`)
  },
  create(data: Partial<ResearchTopic>): Promise<ApiResponse<ResearchTopic>> {
    return request.post('/system/research-topic', data)
  },
  update(data: Partial<ResearchTopic> & { id: number }): Promise<ApiResponse<void>> {
    return request.put('/system/research-topic', data)
  },
  delete(ids: number | number[]): Promise<ApiResponse<void>> {
    const idsStr = Array.isArray(ids) ? ids.join(',') : ids
    return request.delete(`/system/research-topic/${idsStr}`)
  }
}

/**
 * Research Question API
 */
export const researchQuestionApi = {
  getList(params: { topicId?: number; status?: number; pageNum?: number; pageSize?: number } = {}): Promise<PageResult<ResearchQuestion>> {
    return request.get('/system/research-question/list', { params })
  },
  getById(id: number): Promise<ApiResponse<ResearchQuestion>> {
    return request.get(`/system/research-question/${id}`)
  },
  create(data: Partial<ResearchQuestion>): Promise<ApiResponse<ResearchQuestion>> {
    return request.post('/system/research-question', data)
  },
  update(data: Partial<ResearchQuestion> & { id: number }): Promise<ApiResponse<void>> {
    return request.put('/system/research-question', data)
  },
  delete(ids: number | number[]): Promise<ApiResponse<void>> {
    const idsStr = Array.isArray(ids) ? ids.join(',') : ids
    return request.delete(`/system/research-question/${idsStr}`)
  }
}

/**
 * Course Reflection API (教学反思)
 */
export const courseReflectionApi = {
  getList(params: { scheduleId?: number; pageNum?: number; pageSize?: number } = {}): Promise<PageResult<CourseReflection>> {
    return request.get('/system/course-reflection/list', { params })
  },
  getById(id: number): Promise<ApiResponse<CourseReflection>> {
    return request.get(`/system/course-reflection/${id}`)
  },
  getByScheduleId(scheduleId: number): Promise<ApiResponse<CourseReflection>> {
    return request.get(`/system/course-reflection/schedule/${scheduleId}`)
  },
  create(data: Partial<CourseReflection>): Promise<ApiResponse<CourseReflection>> {
    return request.post('/system/course-reflection', data)
  },
  update(data: Partial<CourseReflection> & { id: number }): Promise<ApiResponse<void>> {
    return request.put('/system/course-reflection', data)
  },
  delete(ids: number | number[]): Promise<ApiResponse<void>> {
    const idsStr = Array.isArray(ids) ? ids.join(',') : ids
    return request.delete(`/system/course-reflection/${idsStr}`)
  },
  triggerAiGeneration(scheduleId: number): Promise<ApiResponse<CourseReflection>> {
    return request.post(`/system/course-reflection/ai-generate/${scheduleId}`)
  }
}

/**
 * Lesson Plan Evaluation API (教案评价)
 */
export const lessonPlanEvaluationApi = {
  getList(params: { scheduleId?: number; pageNum?: number; pageSize?: number } = {}): Promise<PageResult<LessonPlanEvaluation>> {
    return request.get('/system/lessonplan-evaluation/list', { params })
  },
  getById(id: number): Promise<ApiResponse<LessonPlanEvaluation>> {
    return request.get(`/system/lessonplan-evaluation/${id}`)
  },
  getByScheduleId(scheduleId: number): Promise<ApiResponse<LessonPlanEvaluation>> {
    return request.get(`/system/lessonplan-evaluation/schedule/${scheduleId}`)
  },
  create(data: Partial<LessonPlanEvaluation>): Promise<ApiResponse<LessonPlanEvaluation>> {
    return request.post('/system/lessonplan-evaluation', data)
  },
  update(data: Partial<LessonPlanEvaluation> & { id: number }): Promise<ApiResponse<void>> {
    return request.put('/system/lessonplan-evaluation', data)
  },
  delete(ids: number | number[]): Promise<ApiResponse<void>> {
    const idsStr = Array.isArray(ids) ? ids.join(',') : ids
    return request.delete(`/system/lessonplan-evaluation/${idsStr}`)
  },
  triggerAiGeneration(scheduleId: number, lessonPlanId: number): Promise<ApiResponse<LessonPlanEvaluation>> {
    return request.post('/system/lessonplan-evaluation/ai-generate', null, {
      params: { scheduleId, lessonPlanId }
    })
  }
}

/**
 * Teaching Evaluation API (授课评价)
 */
export const teachingEvaluationApi = {
  getList(params: { scheduleId?: number; pageNum?: number; pageSize?: number } = {}): Promise<PageResult<TeachingEvaluation>> {
    return request.get('/system/teaching-evaluation/list', { params })
  },
  getById(id: number): Promise<ApiResponse<TeachingEvaluation>> {
    return request.get(`/system/teaching-evaluation/${id}`)
  },
  getByScheduleId(scheduleId: number): Promise<ApiResponse<TeachingEvaluation>> {
    return request.get(`/system/teaching-evaluation/schedule/${scheduleId}`)
  },
  create(data: Partial<TeachingEvaluation>): Promise<ApiResponse<TeachingEvaluation>> {
    return request.post('/system/teaching-evaluation', data)
  },
  update(data: Partial<TeachingEvaluation> & { id: number }): Promise<ApiResponse<void>> {
    return request.put('/system/teaching-evaluation', data)
  },
  delete(ids: number | number[]): Promise<ApiResponse<void>> {
    const idsStr = Array.isArray(ids) ? ids.join(',') : ids
    return request.delete(`/system/teaching-evaluation/${idsStr}`)
  },
  triggerAiGeneration(scheduleId: number): Promise<ApiResponse<TeachingEvaluation>> {
    return request.post(`/system/teaching-evaluation/ai-generate/${scheduleId}`)
  }
}

/**
 * Attention Feed API
 * Aggregated feed of items requiring user attention
 */
export const attentionFeedApi = {
  /**
   * Get my attention feed
   */
  getMyFeed(params: { limit?: number } = {}): Promise<ApiResponse<AttentionItem[]>> {
    return request.get('/normal/attention-feed', { params })
  },

  /**
   * Get category counts for badges
   */
  getCategoryCounts(): Promise<ApiResponse<{
    pending: number
    updated: number
    reminder: number
    activity: number
  }>> {
    return request.get('/normal/attention-feed/counts')
  },

  /**
   * Mark a feed item as read
   */
  markAsRead(id: number): Promise<ApiResponse<void>> {
    return request.put(`/normal/attention-feed/${encodeURIComponent(String(id))}/read`)
  },

  /**
   * Mark all items as read
   */
  markAllAsRead(category?: string): Promise<ApiResponse<void>> {
    return request.put('/normal/attention-feed/read-all', null, {
      params: category ? { category } : {}
    })
  }
}

/**
 * Project Content API
 */
export const projectContentApi = {
  getList(params: { projectId?: number } = {}): Promise<PageResult<unknown>> {
    return request.get('/system/project-content/list', { params })
  },
  getByProjectId(projectId: number): Promise<ApiResponse<unknown[]>> {
    return request.get(`/system/project-content/project/${projectId}`)
  },
  getByProjectAndPhase(projectId: number, phase: string): Promise<ApiResponse<unknown[]>> {
    return request.get(`/system/project-content/project/${projectId}/phase/${phase}`)
  },
  getSection(projectId: number, phase: string, sectionType: string): Promise<ApiResponse<unknown>> {
    return request.get(`/system/project-content/project/${projectId}/phase/${phase}/section/${sectionType}`)
  },
  getById(id: number): Promise<ApiResponse<unknown>> {
    return request.get(`/system/project-content/${id}`)
  },
  create(data: unknown): Promise<ApiResponse<unknown>> {
    return request.post('/system/project-content', data)
  },
  update(data: unknown): Promise<ApiResponse<void>> {
    return request.put('/system/project-content', data)
  },
  delete(ids: number | number[]): Promise<ApiResponse<void>> {
    const idsStr = Array.isArray(ids) ? ids.join(',') : ids
    return request.delete(`/system/project-content/${idsStr}`)
  },
  addAttachment(id: number, attachment: unknown): Promise<ApiResponse<unknown>> {
    return request.post(`/system/project-content/${id}/attachment`, attachment)
  },
  removeAttachment(id: number, ossId: string): Promise<ApiResponse<void>> {
    return request.delete(`/system/project-content/${id}/attachment/${ossId}`)
  }
}

/**
 * Project Reflection API (项目反思)
 */
export const projectReflectionApi = {
  getList(params: { projectId?: number } = {}): Promise<PageResult<unknown>> {
    return request.get('/normal/project-reflection/list', { params })
  },
  getById(id: number): Promise<ApiResponse<unknown>> {
    return request.get(`/normal/project-reflection/${id}`)
  },
  getByProjectId(projectId: number): Promise<ApiResponse<unknown[]>> {
    return request.get(`/normal/project-reflection/project/${projectId}`)
  },
  getByProjectIdAndPhase(projectId: number, phase: string): Promise<ApiResponse<unknown>> {
    return request.get(`/normal/project-reflection/project/${projectId}/phase/${phase}`)
  },
  create(data: unknown): Promise<ApiResponse<unknown>> {
    return request.post('/normal/project-reflection', data)
  },
  update(data: unknown): Promise<ApiResponse<void>> {
    return request.put('/normal/project-reflection', data)
  },
  delete(ids: number | number[]): Promise<ApiResponse<void>> {
    const idsStr = Array.isArray(ids) ? ids.join(',') : ids
    return request.delete(`/normal/project-reflection/${idsStr}`)
  }
}

/**
 * Project Evaluation API (项目评价)
 */
export const projectEvaluationApi = {
  getList(params: { projectId?: number } = {}): Promise<PageResult<unknown>> {
    return request.get('/normal/project-evaluation/list', { params })
  },
  getById(id: number): Promise<ApiResponse<unknown>> {
    return request.get(`/normal/project-evaluation/${id}`)
  },
  getByProjectId(projectId: number): Promise<ApiResponse<unknown[]>> {
    return request.get(`/normal/project-evaluation/project/${projectId}`)
  },
  getByProjectIdAndEvaluator(projectId: number, evaluatorId: number): Promise<ApiResponse<unknown>> {
    return request.get(`/normal/project-evaluation/project/${projectId}/evaluator/${evaluatorId}`)
  },
  create(data: unknown): Promise<ApiResponse<unknown>> {
    return request.post('/normal/project-evaluation', data)
  },
  update(data: unknown): Promise<ApiResponse<void>> {
    return request.put('/normal/project-evaluation', data)
  },
  delete(ids: number | number[]): Promise<ApiResponse<void>> {
    const idsStr = Array.isArray(ids) ? ids.join(',') : ids
    return request.delete(`/normal/project-evaluation/${idsStr}`)
  },
  submit(id: number): Promise<ApiResponse<void>> {
    return request.post(`/normal/project-evaluation/${id}/submit`)
  }
}

/**
 * OSS File Upload API
 */
export const ossApi = {
  /**
   * Upload a file to OSS storage
   */
  upload(file: File): Promise<ApiResponse<{ url: string; fileName: string; ossId: string }>> {
    const formData = new FormData()
    formData.append('file', file)
    return request.post('/resource/oss/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }
}

export default {
  authApi,
  userApi,
  lessonPlanApi,
  schoolApi,
  gradeApi,
  schoolClassApi,
  activityApi,
  projectApi,
  projectMemberApi,
  projectContentApi,
  projectReflectionApi,
  projectEvaluationApi,
  testPaperApi,
  questionBankApi,
  commentApi,
  textbookApi,
  textbookEditionApi,
  curriculumStandardApi,
  scheduleApi,
  courseAnalysisApi,
  internshipSchoolApi,
  researchTopicApi,
  researchQuestionApi,
  courseReflectionApi,
  lessonPlanEvaluationApi,
  teachingEvaluationApi,
  attentionFeedApi,
  ossApi
}
