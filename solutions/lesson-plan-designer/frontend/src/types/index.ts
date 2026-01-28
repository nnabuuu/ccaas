// Lesson Plan Types

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
  duration: number // minutes
  type: 'introduction' | 'direct-instruction' | 'guided-practice' |
        'independent-practice' | 'group' | 'assessment' | 'closure'
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
  id: string
  tenantId: string
  title: string
  subject: string
  gradeLevel: string
  duration: string
  // Textbook information
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

  status: 'draft' | 'review' | 'published'
  createdAt: string
  updatedAt: string
}

// Sync-related types
export const SYNC_FIELDS = [
  'title', 'subject', 'gradeLevel', 'duration',
  'publisher', 'volume', 'chapterId', 'chapterTitle',
  'objectives', 'standards', 'materials', 'activities',
  'assessment', 'differentiation'
] as const

export type SyncField = typeof SYNC_FIELDS[number]

// Tool activity for inline rendering
export interface ToolActivity {
  toolName: string
  toolId: string
  phase: 'start' | 'progress' | 'end'
  timestamp: Date
  duration?: number
  success?: boolean
  description?: string
  toolInput?: unknown
  toolOutput?: unknown
  toolError?: string
}

// Content block types for inline tool cards in chat
export interface TextBlock { type: 'text'; text: string }
export interface ToolBlock { type: 'tool'; tool: ToolActivity }
export type ContentBlock = TextBlock | ToolBlock

// Message types
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  contentBlocks?: ContentBlock[]
  timestamp: Date
  outputUpdates?: OutputUpdate[]
}

export interface OutputUpdate {
  field: SyncField
  value: unknown
  preview: string
  synced?: boolean
  syncedAt?: Date
}

// Sync state types
export interface SyncState {
  pendingUpdates: Map<SyncField, OutputUpdate>
  modifiedFields: Set<SyncField>
  undoStack: UndoEntry[]
}

export interface UndoEntry {
  field: SyncField
  previousValue: unknown
  timestamp: number
}

// Socket event types
export interface ChatEvent {
  sessionId: string
  message: string
  tenantId: string
  context: {
    lessonPlanId: string
    currentForm: Partial<LessonPlan>
  }
}

// Re-export from @ccaas/shared for type consistency
export type { TextDeltaEvent, OutputUpdateEvent } from '@ccaas/shared'

// Note: AgentStatusEvent is kept local because @ccaas/shared has nested AgentStatusError
// but the backend actually sends `error: string` directly
export interface AgentStatusEvent {
  status: 'running' | 'complete' | 'error'
  error?: string
  exitCode?: number | null
}

// Tool activity event (from event-mapper.service.ts)
export interface ToolActivityEvent {
  toolName: string
  toolId: string
  phase: 'start' | 'end'
  description: string
  toolInput?: Record<string, unknown>
  toolOutput?: string
  success?: boolean
  duration?: number
  agentType?: string
  nestingLevel?: number
  timestamp?: string
}

// Exploration activity event
export interface ExplorationActivityEvent {
  action: 'search' | 'read' | 'glob' | 'grep' | 'analyze'
  target: string
  agentType?: string
  phase: 'start' | 'complete'
  resultCount?: number
  resultSummary?: string
  durationMs?: number
}

// Agent thinking event
export interface AgentThinkingEvent {
  phase: 'start' | 'delta' | 'end'
  content?: string
  thinkingId?: string
}

// Token usage event
export interface TokenUsageEvent {
  inputTokens: number
  outputTokens: number
  cachedInputTokens?: number
  sessionTotalTokens?: number
  sessionInputTokens?: number
  sessionOutputTokens?: number
  model?: string
}

// API types
export interface CreateLessonPlanInput {
  tenantId: string
  title: string
  subject?: string
  gradeLevel?: string
  duration?: string
  publisher?: string
  volume?: string
  chapterId?: number
  chapterTitle?: string
}

export interface UpdateLessonPlanInput {
  title?: string
  subject?: string
  gradeLevel?: string
  duration?: string
  objectives?: LearningObjective[]
  standards?: Standard[]
  materials?: Material[]
  activities?: Activity[]
  assessment?: Assessment
  differentiation?: Differentiation
  status?: 'draft' | 'review' | 'published'
}

// Helper type for empty lesson plan
export function createEmptyLessonPlan(tenantId: string): Omit<LessonPlan, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    tenantId,
    title: '',
    subject: '',
    gradeLevel: '',
    duration: '',
    objectives: [],
    standards: [],
    materials: [],
    activities: [],
    assessment: { formative: [], summative: [] },
    differentiation: { struggling: [], onLevel: [], advanced: [] },
    status: 'draft',
  }
}

// Bloom's Taxonomy labels
export const BLOOM_LEVELS: Record<LearningObjective['bloomLevel'], string> = {
  remember: '记忆',
  understand: '理解',
  apply: '应用',
  analyze: '分析',
  evaluate: '评价',
  create: '创造',
}

// Activity type labels
export const ACTIVITY_TYPES: Record<Activity['type'], string> = {
  'introduction': '导入',
  'direct-instruction': '讲授',
  'guided-practice': '引导练习',
  'independent-practice': '独立练习',
  'group': '小组活动',
  'assessment': '评估',
  'closure': '总结',
}

// Textbook types
export interface TextbookSubject {
  id: string
  label: string
}

export interface TextbookGrade {
  id: number
  label: string
  stage: string
}

export interface TextbookPublisher {
  id: string
  label: string
}

export interface TextbookVolume {
  id: string
  label: string
}

export interface TextbookChapter {
  id: number
  title: string
  children?: TextbookChapter[]
}

// Skill types (matching CCAAS Skill entity)
export interface Skill {
  id: string
  tenantId: string
  name: string
  slug: string
  description: string
  /**
   * Skill prompt content (CCAAS uses 'content', not 'prompt')
   */
  content: string
  /**
   * Whether the skill is enabled (persisted in CCAAS database)
   */
  enabled: boolean
  status: 'draft' | 'published'
  createdAt: string
  updatedAt: string
}
