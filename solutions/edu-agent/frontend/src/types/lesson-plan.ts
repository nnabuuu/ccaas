export interface LearningObjective {
  id: string
  description: string
  bloomLevel: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create'
  assessmentCriteria?: string
}

export interface Standard {
  id: string
  code: string
  description: string
}

export interface Material {
  id: string
  name: string
  type: 'textbook' | 'handout' | 'digital' | 'manipulative' | 'other'
  url?: string
  notes?: string
}

export interface Activity {
  id: string
  title: string
  description: string
  duration: number
  type: 'introduction' | 'direct-instruction' | 'guided-practice' | 'independent-practice' | 'group' | 'assessment' | 'closure'
  instructions: string[]
  materials?: string[]
  teacherNotes?: string
}

export interface Assessment {
  formative: string[]
  summative: string[]
  rubric?: string
}

export interface Differentiation {
  struggling: string[]
  onLevel: string[]
  advanced: string[]
  ell?: string[]
  accommodations?: string[]
}

export interface LessonPlan {
  [key: string]: unknown
  id: string
  tenantId: string
  title: string
  subject: string
  gradeLevel: string
  duration: string
  publisher?: string
  volume?: string
  chapterId?: number
  chapterTitle?: string
  objectives: LearningObjective[]
  standards: Standard[]
  materials: Material[]
  activities: Activity[]
  assessment: Assessment
  differentiation: Differentiation
  status: 'draft' | 'published'
  createdAt: string
  updatedAt: string
}

export type LessonPlanSyncField =
  | 'title' | 'subject' | 'gradeLevel' | 'duration'
  | 'objectives' | 'standards' | 'materials' | 'activities'
  | 'assessment' | 'differentiation'
