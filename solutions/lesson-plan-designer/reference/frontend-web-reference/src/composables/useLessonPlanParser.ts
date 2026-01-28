/**
 * Lesson Plan Content Parser
 *
 * Handles parsing of lesson plan content JSON from various formats
 * (new structured format, legacy format, plain text) into a consistent structure.
 */

import type { LessonPlan } from '@/types'

// Content type definitions - exported for use in components
export interface CourseRequirements {
  contentIds: number[]
  academicIds: number[]
}

export interface LearningObjective {
  id: number
  content: string
  linkedRequirements: number[]
}

export interface PreparationTask {
  id: number
  content: string
  linkedObjectives: number[]
}

/** Sub-task for a learning task */
export interface SubTask {
  id: number
  name: string
  description?: string
  duration?: number
}

/** Assessment task for learning task evaluation */
export interface AssessmentTask {
  id: number
  type: 'formative' | 'diagnostic' | 'summative'
  method: 'observation' | 'questioning' | 'product' | 'test'
  criteria: string
  linkedSubTaskId: number | null
}

export interface LearningTask {
  id: number
  name: string
  description: string
  duration: number
  type: string
  linkedRequirements: number[]
  subTasks: SubTask[]
  assessmentTasks: AssessmentTask[]
}

export interface HomeworkTaskAuthenticity {
  scenario?: string
  role?: string
  audience?: string
  product?: string
}

export interface HomeworkTask {
  id: number
  name: string
  description: string
  type: string
  level: string
  isRequired: boolean
  estimatedTime: number
  linkedObjectives: number[]
  criteria: string
  authenticity: HomeworkTaskAuthenticity | null
}

/** Course requirement for linking to objectives */
export interface CourseRequirement {
  id: number
  type: 'content' | 'academic'
  label: string
  description?: string
}

export interface LessonPlanContent {
  courseRequirements: CourseRequirements
  textbookAnalysis: string
  learningObjectives: LearningObjective[]
  studentAnalysis: string
  preClassPreparation: PreparationTask[]
  learningTasks: LearningTask[]
  homeworkTasks: HomeworkTask[]
  courseware: string
  resources: string
}

// Legacy format types
interface LegacyObjectives {
  knowledge?: string
  process?: string
  emotion?: string
}

interface LegacyKeyPoints {
  key?: string
  difficulty?: string
}

interface LegacyContent {
  objectives?: LegacyObjectives
  keyPoints?: LegacyKeyPoints
  process?: string
  homework?: string
  reflection?: string
}

interface NewFormatContent {
  courseRequirements?: CourseRequirements | Record<string, unknown>
  textbookAnalysis?: string
  learningObjectives?: LearningObjective[] | string
  studentAnalysis?: string
  preClassPreparation?: PreparationTask[] | string
  learningTasks?: LearningTask[]
  learningProcess?: string
  homeworkTasks?: HomeworkTask[]
  homeworkAssessment?: string
  courseware?: string
  resources?: string
}

/**
 * Get default empty content structure
 * @returns Default content with all sections empty
 */
export function getDefaultContent(): LessonPlanContent {
  return {
    courseRequirements: { contentIds: [], academicIds: [] },
    textbookAnalysis: '',
    learningObjectives: [],
    studentAnalysis: '',
    preClassPreparation: [],
    learningTasks: [],
    homeworkTasks: [],
    courseware: '',
    resources: ''
  }
}

/**
 * Parse new format content
 * @param content - Parsed JSON content
 * @returns Normalized content structure
 */
export function parseNewFormat(content: NewFormatContent): LessonPlanContent {
  let courseReqs: CourseRequirements = { contentIds: [], academicIds: [] }
  if (content.courseRequirements && typeof content.courseRequirements === 'object') {
    courseReqs = {
      contentIds: (content.courseRequirements as CourseRequirements).contentIds || [],
      academicIds: (content.courseRequirements as CourseRequirements).academicIds || []
    }
  }

  // Handle learningObjectives - can be string (old) or array (new)
  let objectives: LearningObjective[] = []
  if (Array.isArray(content.learningObjectives)) {
    objectives = content.learningObjectives
  } else if (typeof content.learningObjectives === 'string' && content.learningObjectives) {
    objectives = [{ id: Date.now(), content: content.learningObjectives, linkedRequirements: [] }]
  }

  // Handle preClassPreparation - can be string (legacy) or array (new)
  let preparationTasks: PreparationTask[] = []
  if (Array.isArray(content.preClassPreparation)) {
    preparationTasks = content.preClassPreparation
  } else if (typeof content.preClassPreparation === 'string' && content.preClassPreparation) {
    preparationTasks = [{ id: Date.now(), content: content.preClassPreparation, linkedObjectives: [] }]
  }

  // Handle learningTasks - can be string (legacy learningProcess) or array (new)
  let learningTasks: LearningTask[] = []
  if (Array.isArray(content.learningTasks)) {
    learningTasks = content.learningTasks
  } else if (typeof content.learningProcess === 'string' && content.learningProcess) {
    // Legacy format: convert markdown string to a single task with the content as description
    learningTasks = [{
      id: Date.now(),
      name: '学习任务',
      description: content.learningProcess,
      duration: 30,
      type: 'class',
      linkedRequirements: [],
      subTasks: [],
      assessmentTasks: []
    }]
  }

  // Handle homeworkTasks - can be string (legacy homeworkAssessment) or array (new)
  let homeworkTasks: HomeworkTask[] = []
  if (Array.isArray(content.homeworkTasks)) {
    homeworkTasks = content.homeworkTasks
  } else if (typeof content.homeworkAssessment === 'string' && content.homeworkAssessment) {
    // Legacy format: convert markdown string to a single task
    homeworkTasks = [{
      id: Date.now(),
      name: '作业任务',
      description: content.homeworkAssessment,
      type: 'practice',
      level: 'basic',
      isRequired: true,
      estimatedTime: 15,
      linkedObjectives: [],
      criteria: '',
      authenticity: null
    }]
  }

  return {
    courseRequirements: courseReqs,
    textbookAnalysis: content.textbookAnalysis || '',
    learningObjectives: objectives,
    studentAnalysis: content.studentAnalysis || '',
    preClassPreparation: preparationTasks,
    learningTasks: learningTasks,
    homeworkTasks: homeworkTasks,
    courseware: content.courseware || '',
    resources: content.resources || ''
  }
}

/**
 * Parse legacy format content
 * @param content - Parsed JSON content in legacy format
 * @returns Normalized content structure
 */
export function parseLegacyFormat(content: LegacyContent): LessonPlanContent {
  const migrated = getDefaultContent()

  if (content.objectives) {
    const parts: string[] = []
    if (content.objectives.knowledge) parts.push(content.objectives.knowledge)
    if (content.objectives.process) parts.push(content.objectives.process)
    if (content.objectives.emotion) parts.push(content.objectives.emotion)
    const legacyText = parts.join('\n')
    // Convert to array format
    migrated.learningObjectives = legacyText
      ? [{ id: Date.now(), content: legacyText, linkedRequirements: [] }]
      : []
  }

  if (content.keyPoints) {
    const parts: string[] = []
    if (content.keyPoints.key) parts.push('重点：' + content.keyPoints.key)
    if (content.keyPoints.difficulty) parts.push('难点：' + content.keyPoints.difficulty)
    migrated.studentAnalysis = parts.join('\n')
  }

  if (content.process) {
    migrated.learningTasks = [{
      id: Date.now(),
      name: '学习任务',
      description: content.process,
      duration: 30,
      type: 'class',
      linkedRequirements: [],
      subTasks: [],
      assessmentTasks: []
    }]
  }

  if (content.homework) {
    migrated.homeworkTasks = [{
      id: Date.now(),
      name: '作业任务',
      description: content.homework,
      type: 'practice',
      level: 'basic',
      isRequired: true,
      estimatedTime: 15,
      linkedObjectives: [],
      criteria: '',
      authenticity: null
    }]
  }

  if (content.reflection) migrated.resources = content.reflection

  return migrated
}

/**
 * Check if content is in new format
 * @param content - Parsed JSON content
 * @returns True if new format
 */
export function isNewFormat(content: Record<string, unknown>): boolean {
  return content.courseRequirements !== undefined || content.learningObjectives !== undefined
}

/**
 * Parse lesson plan content from any format
 * @param lessonPlan - The lesson plan object with content field
 * @returns Normalized content structure
 */
export function parseLessonPlanContent(lessonPlan: LessonPlan | null): LessonPlanContent {
  const defaults = getDefaultContent()

  if (!lessonPlan?.content) return defaults

  try {
    const content = JSON.parse(lessonPlan.content) as Record<string, unknown>
    if (isNewFormat(content)) {
      return parseNewFormat(content as NewFormatContent)
    }
    return parseLegacyFormat(content as LegacyContent)
  } catch {
    // Handle plain text as single objective
    const text = lessonPlan.objectives || ''
    return {
      ...defaults,
      learningObjectives: text ? [{ id: Date.now(), content: text, linkedRequirements: [] }] : [],
      // Store raw content in case it's useful
      resources: typeof lessonPlan.content === 'string' ? lessonPlan.content : ''
    }
  }
}

/**
 * Serialize parsed content back to JSON string for API
 * @param parsedContent - The parsed content structure
 * @returns JSON string
 */
export function serializeLessonPlanContent(parsedContent: LessonPlanContent): string {
  return JSON.stringify(parsedContent)
}
