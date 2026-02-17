// Lesson Plan Types - Simplified plain-text model

export type LessonPlanStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

// Curriculum standard (from get_curriculum_standards MCP tool)
export interface CurriculumStandard {
  id: number
  standardCode: string
  title: string
  stage: string
  standardType: string
  contentDomain: string
}

// Lesson plan attachment
export interface LessonPlanAttachment {
  id: string
  fileId: string
  fileName: string
  fileType: 'script' | 'audio' | 'ppt' | 'pdf' | 'other'
  mimeType: string
  size: number
  downloadUrl: string
  uploadedAt: string
  description?: string
}

export interface LessonPlan {
  id: string
  title: string
  subject: string
  gradeLevel: number
  durationMinutes: number
  lessonPlanCode: string | null
  status: LessonPlanStatus

  // Textbook metadata
  publisher: string | null
  volume: string | null
  chapterId: number | null
  chapterTitle: string | null

  // Curriculum standards (structured array from MCP query)
  curriculumRequirements: CurriculumStandard[]

  // 6 content fields (all plain text)
  objectives: string | null
  studentAnalysis: string | null
  materialsNeeded: string | null
  content: string | null
  assessmentMethods: string | null
  teachingMethods: string | null

  // Extra properties (key-value pairs)
  extraProperties: Record<string, string>

  // File attachments
  attachments: LessonPlanAttachment[]

  // Audit fields
  createBy: string | null
  createTime: string
  updateBy: string | null
  updateTime: string
  remark: string | null
  deleted: number
}

// Sync-related types
export const SYNC_FIELDS = [
  'title', 'subject', 'gradeLevel', 'durationMinutes', 'lessonPlanCode',
  'objectives', 'content', 'teachingMethods', 'materialsNeeded',
  'assessmentMethods', 'curriculumRequirements', 'studentAnalysis',
  'extraProperties', 'status', 'attachments'
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
  agentType?: string
  nestingLevel?: number
}

// Content block types for inline tool cards in chat
export interface TextBlock { type: 'text'; text: string }
export interface ToolBlock { type: 'tool'; tool: ToolActivity }
export type ContentBlock = TextBlock | ToolBlock

// Per-message token usage (compatible with SDK's TokenUsage)
export interface MessageTokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number  // SDK uses cacheReadTokens instead of cachedInputTokens
  // Extended fields (optional, may not be populated by SDK)
  cachedInputTokens?: number  // Deprecated: use cacheReadTokens
  estimatedCostUsd?: number
  model?: string
  requestCount?: number
}

// Message types
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'  // Added 'system' to match react-sdk
  content: string
  contentBlocks?: ContentBlock[]
  timestamp?: Date  // Made optional to match react-sdk
  outputUpdates?: OutputUpdate[]
  tokenUsage?: MessageTokenUsage
  isStreaming?: boolean  // Added to match react-sdk
}

export interface OutputUpdate {
  field: SyncField
  value: unknown
  preview: string
  synced?: boolean
  syncedAt?: Date
}

// Extended OutputUpdate with metadata for Global Sync Section
export interface PendingUpdateWithMeta {
  field: SyncField
  value: unknown
  preview: string
  synced?: boolean
  syncedAt?: Date
  roundId: string           // 来自哪个 message round (messageId)
  timestamp: number          // 用于排序
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

// Re-export from @ccaas/common for type consistency
export type {
  TextDeltaEvent,
  OutputUpdateEvent,
  ActiveSubAgent,
  SubAgentStartedEvent,
  SubAgentCompletedEvent,
} from '@ccaas/common'

// Import for local use in SessionState
import type { ActiveSubAgent } from '@ccaas/common'

// Note: AgentStatusEvent is kept local because @ccaas/common has nested AgentStatusError
// but the backend actually sends `error: string` directly
export interface AgentStatusEvent {
  status: 'running' | 'complete' | 'error' | 'cancelled'
  error?: string
  exitCode?: number | null
}

// Session state types for non-blocking chat
export interface SessionState {
  isMainProcessing: boolean      // 主 Claude 正在响应
  hasActiveSubAgents: boolean     // 有活跃的 SubAgent
  activeSubAgents: ActiveSubAgent[]
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
  parentToolUseId?: string  // Parent tool ID for hierarchical tracking
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
  title: string
  subject?: string
  gradeLevel?: number
  durationMinutes?: number
  lessonPlanCode?: string
  publisher?: string
  volume?: string
  chapterId?: number
  chapterTitle?: string
}

export interface UpdateLessonPlanInput {
  title?: string
  subject?: string
  gradeLevel?: number
  durationMinutes?: number
  lessonPlanCode?: string | null
  status?: LessonPlanStatus

  curriculumRequirements?: CurriculumStandard[]
  objectives?: string | null
  studentAnalysis?: string | null
  materialsNeeded?: string | null
  content?: string | null
  assessmentMethods?: string | null
  teachingMethods?: string | null

  extraProperties?: Record<string, string>
  remark?: string | null
}

// Helper type for empty lesson plan
export function createEmptyLessonPlan(): Omit<LessonPlan, 'id' | 'createTime' | 'updateTime'> {
  return {
    title: '',
    subject: '',
    gradeLevel: 1,
    durationMinutes: 45,
    lessonPlanCode: null,
    status: 'DRAFT',
    publisher: null,
    volume: null,
    chapterId: null,
    chapterTitle: null,
    curriculumRequirements: [],
    objectives: null,
    studentAnalysis: null,
    materialsNeeded: null,
    content: null,
    assessmentMethods: null,
    teachingMethods: null,
    extraProperties: {},
    attachments: [],
    createBy: null,
    updateBy: null,
    remark: null,
    deleted: 0,
  }
}

// Textbook types (used by CreateLessonPlanDialog cascading selectors)
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

// Todo tracking types - now using types from @ccaas/common
export type { EventTodoItem as TodoItem } from '@ccaas/common'

// TodoStats is solution-specific (extends common type)
export interface TodoStats {
  completed: number
  inProgress: number
  pending: number
  total: number
}

// Skill types (matching CCAAS Skill entity)
export interface Skill {
  id: string
  tenantId: string
  name: string
  slug: string
  description: string
  content: string
  enabled: boolean
  status: 'draft' | 'published'
  createdAt: string
  updatedAt: string
}

// Tab types for ChatPanel
export type TabType = 'messages' | 'files' | 'tasks'

export interface FileAttachmentState {
  isAttaching: boolean
  error: string | null
}

/**
 * FilesView component props
 *
 * Generic session file browser with optional attachment functionality.
 * Can be used standalone (file browsing only) or with attachment handler.
 */
export interface FilesViewProps {
  connection: any // UseAgentConnectionReturn
  sessionId: string

  // Optional: Provide to enable file attachment feature
  onAttachFile?: (file: any) => Promise<{ success: boolean }>
  attachButtonLabel?: string  // Default: "附加"
  attachButtonTitle?: string  // Default: "附加文件"
}
