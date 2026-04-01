/**
 * @kedge-agentic/react-sdk types
 *
 * Common types used by React SDK hooks. Domain-specific types
 * (e.g., LessonPlan, Explanation) remain in each solution.
 */

import type { TokenUsage } from '@kedge-agentic/common'

// Re-export TokenUsage for consumers
export type { TokenUsage }

// ==========================================
// FILE MANAGEMENT TYPES
// ==========================================

export interface FileMetadata {
  id: string
  filename: string
  originalPath: string
  mimeType: string | null
  size: number
  status: 'new' | 'modified' | 'synced'
  uploadedBy: 'agent' | 'user'
  currentVersion: string
  lastVersionAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface FileVersion {
  id: string
  fileId: string
  version: string
  contentHash: string
  size: number
  mimeType: string | null
  changelog: string | null
  uploadedBy: 'agent' | 'user'
  createdAt: Date
}

export interface FilePreviewData {
  content: string
  truncated: boolean
  encoding: 'utf8' | 'base64'
  mimeType: string
  size: number
}

export interface UseFilesOptions {
  connection: UseAgentConnectionReturn
  sessionId: string
  enabled?: boolean
}

export interface UseFilesReturn {
  files: FileMetadata[]
  isLoading: boolean
  error: Error | null
  newFilesCount: number
  hasNewFiles: boolean
  uploadFile: (file: File, targetPath?: string) => Promise<FileMetadata>
  downloadFile: (fileId: string) => Promise<void>
  deleteFile: (fileId: string) => Promise<void>
  markAsSynced: (fileId: string) => Promise<void>
  markAllSeen: () => Promise<void>
  refetch: () => Promise<void>
}

export interface UseFileVersionsOptions {
  connection: UseAgentConnectionReturn
  fileId: string
  enabled?: boolean
}

export interface UseFileVersionsReturn {
  versions: FileVersion[]
  isLoading: boolean
  error: Error | null
  createVersion: (changelog?: string) => Promise<FileVersion>
  rollbackToVersion: (version: string) => Promise<void>
  compareVersions: (from: string, to: string) => Promise<{
    from: FileVersion
    to: FileVersion
    sizeDiff: number
    hashChanged: boolean
  }>
  downloadVersion: (version: string) => Promise<void>
  refetch: () => Promise<void>
}

export interface UseFilePreviewOptions {
  fileId: string
  maxBytes?: number
  enabled?: boolean
  /** API key for X-API-Key header authentication */
  apiKey?: string
}

export interface UseFilePreviewReturn {
  preview: FilePreviewData | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

// Re-export event types from @kedge-agentic/common
export type {
  TextDeltaEvent,
  OutputUpdateEvent,
  AgentStatusEvent,
  ToolActivityEvent,
  ToolActivityPayload,
  AgentThinkingEvent,
  AgentThinkingPayload,
  TokenUsageEvent,
  TokenUsagePayload,
  ExplorationActivityEvent,
  ExplorationActivityPayload,
  TodoUpdatePayload,
  TodoUpdateEvent,
  Skill,
  ActiveSubAgent,
} from '@kedge-agentic/common'

// Re-export EventTodoItem as TodoItem for convenience
export type { EventTodoItem as TodoItem } from '@kedge-agentic/common'

// ============================================================================
// Todo Types
// ============================================================================

export interface TodoStats {
  completed: number
  inProgress: number
  pending: number
  total: number
}

// ============================================================================
// Unified Task Types (for Task Tracking System)
// ============================================================================

// ============================================================================
// Job Types (for background job tracking)
// ============================================================================

export interface JobInfo {
  id: string
  sessionId?: string
  messageId?: string
  type: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt?: string
  completedAt?: string
  progress?: { step: string; percent: number }
  metadata?: Record<string, unknown>
  resultFiles?: { name: string; path: string; size: number; mimeType: string }[]
  errorMessage?: string
}

export interface UnifiedTask {
  id: string
  type: 'subagent' | 'todo' | 'job'
  status: 'running' | 'completed' | 'failed' | 'pending' | 'in_progress' | 'cancelled'
  title: string
  description?: string
  startedAt?: Date
  completedAt?: Date
  duration?: number
  agentType?: string
  progress?: number
  activeForm?: string
  nestingLevel?: number
  // Job-specific fields
  jobId?: string
  jobType?: string
  resultFiles?: { name: string; path: string; size: number; mimeType: string }[]
  messageId?: string
  raw: import('@kedge-agentic/common').ActiveSubAgent | import('@kedge-agentic/common').EventTodoItem | JobInfo
}

export interface TaskGroups {
  active: UnifiedTask[]
  recentCompleted: UnifiedTask[]
  recentFailed: UnifiedTask[]
}

export interface TaskBadgeState {
  show: boolean
  color: 'green' | 'red' | 'amber' | 'blue'
  count?: number
  label: string
}

export interface UseTaskTrackingOptions {
  activeSubAgents: import('@kedge-agentic/common').ActiveSubAgent[]
  todoItems: import('@kedge-agentic/common').EventTodoItem[]
  jobs?: JobInfo[]
  maxHistorySize?: number
}

export interface UseTaskTrackingReturn {
  groups: TaskGroups
  badgeState: TaskBadgeState
  allTasks: UnifiedTask[]
  findTask: (id: string) => UnifiedTask | undefined
  clearHistory: () => void
}

export interface UseMessageSplitterOptions {
  /** Messages to split */
  messages: Message[]
  /** Enable message splitting. Defaults to true */
  enabled?: boolean
}

export interface UseMessageSplitterReturn {
  /** Split messages for rendering */
  splitMessages: SplitMessage[]
  /** Aggregated output updates from all assistant messages (deduplicated, latest per field) */
  outputUpdates: OutputUpdate[]
}

// ============================================================================
// Content Block Types (shared between solutions)
// ============================================================================

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
  endTime?: number  // Tool end timestamp (only present when phase='end')
  turnId?: string   // Turn identifier (CCAAS-provided, not from agent)
}

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ToolBlock {
  type: 'tool'
  tool: ToolActivity
}

export interface ThinkingBlock {
  type: 'thinking'
  thinkingId: string
  content: string
  isComplete?: boolean
}

export type ContentBlock = TextBlock | ToolBlock | ThinkingBlock

// ============================================================================
// Message Types
// ============================================================================

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  contentBlocks?: ContentBlock[]
  outputUpdates?: OutputUpdate[]
  tokenUsage?: TokenUsage
  timestamp?: Date
  createdAt?: string
  isStreaming?: boolean
}

// ============================================================================
// Message Splitting Types (for improved UX)
// ============================================================================

/**
 * Type of display segment after splitting a message
 */
export type SegmentType = 'text' | 'tool' | 'tool-group'

/**
 * A single display segment in a split message
 */
export interface DisplaySegment {
  /** Unique ID: ${messageId}-seg-${index} */
  id: string
  /** Segment type */
  type: SegmentType
  /** Content blocks for this segment */
  blocks: ContentBlock[]
  /** Whether this segment is currently streaming */
  isStreaming: boolean
}

/**
 * A message split into multiple display segments
 */
export interface SplitMessage {
  /** Original message ID */
  messageId: string
  /** Message role */
  role: 'user' | 'assistant' | 'system'
  /** Display segments */
  segments: DisplaySegment[]
  /** Token usage (from original message) */
  tokenUsage?: TokenUsage
  /** Timestamp (from original message) */
  timestamp?: Date
  /** Original unsplit message */
  original: Message
}

// ============================================================================
// Output Update / Sync Types
// ============================================================================

export interface OutputUpdate {
  field: string
  value: unknown
  /** Computed display label for sync UI. Always auto-generated from field name. */
  preview?: string
  /** Optional page routing key. When set, useOutputSync groups this update under the given page. */
  page?: string
  synced?: boolean
  syncedAt?: Date
  timestamp?: number
}

export interface UndoEntry {
  field: string
  previousValue: unknown
  timestamp: number
}

// ============================================================================
// Solution Config Types
// ============================================================================

// Import and re-export from @kedge-agentic/common to avoid duplication
import type { McpServerConfig as McpServerConfigCommon } from '@kedge-agentic/common'
export type McpServerConfig = McpServerConfigCommon

export interface SolutionConfig {
  mcpServers?: Record<string, McpServerConfig>
  skillPath?: string | null
  skillSlug?: string | null
  /** Session templates defined in solution.json */
  sessionTemplates?: import('@kedge-agentic/common').SessionTemplateMap
  // NOTE: defaultSessionTemplate will be added in Phase 2
  // when we implement automatic fallback to default template
}

// ============================================================================
// Hook Option/Return Types
// ============================================================================

export interface UseAgentConnectionOptions {
  /** Server URL. Defaults to '/' (relative, proxied by Vite) */
  serverUrl?: string
  /** Session ID prefix, e.g., 'lpd', 'pe'. Used when tenantId is not provided. */
  sessionPrefix?: string
  /** Whether to auto-connect on mount. Defaults to true */
  autoConnect?: boolean
  /** Tenant ID for tenant-scoped localStorage persistence. When provided, sessionId uses conv_ prefix and is persisted. */
  tenantId?: string
  /** Force a new conversation, clearing any saved sessionId from localStorage */
  forceNewConversation?: boolean
  /** Explicit session ID. When provided, skips localStorage resolution. */
  sessionId?: string
  /** User ID for user-scoped session history */
  userId?: string
  /**
   * Transport to use for chat messages. Defaults to 'sse'.
   * - 'sse' (default): HTTP streaming via POST /messages. No WebSocket required.
   * - 'socket' (deprecated): Socket.IO transport. The backend /completion endpoint returns 410 Gone.
   */
  transport?: 'sse' | 'socket'
  /** API key for X-API-Key header authentication. When provided, all fetch calls include this key. */
  apiKey?: string
}

export interface UseAgentConnectionReturn {
  socket: import('socket.io-client').Socket | null
  connected: boolean
  clientId: string | null
  sessionId: string
  serverUrl: string
  error: string | null
  connect: () => void
  disconnect: () => void
  /** Clear current session storage and start a new conversation with a fresh sessionId */
  startNewConversation: () => void
  /** Switch to an existing session by ID */
  switchSession: (sessionId: string) => void
  /** Whether the backend session is known to exist (true after first sendMessage call) */
  sessionReady: boolean
  /** Called by useAgentChat when a message is about to be sent, marking the session as ready */
  markSessionReady: () => void
  /** API key for X-API-Key header authentication */
  apiKey?: string
}

export interface PageContext {
  pageType: string
  pageData: Record<string, unknown>
  metadata?: {
    timestamp?: number
    userId?: string
  }
}

export interface UseAgentChatOptions {
  connection: UseAgentConnectionReturn
  tenantId: string
  enabledSkills?: string[]
  onOutputUpdate?: (update: OutputUpdate) => void
  onTokenUsage?: (usage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number }) => void
  /**
   * Called when a tool_activity event is received from the per-turn SSE stream.
   * In SSE mode, useAgentStatus does not receive these events, so this callback
   * lets consumers track tool activity from the chat stream.
   */
  onToolActivity?: (activity: ToolActivity) => void
  /**
   * Called when an agent_thinking event is received from the per-turn SSE stream.
   * In SSE mode, useAgentStatus does not receive these events, so this callback
   * lets consumers track thinking state from the chat stream.
   */
  onThinkingUpdate?: (phase: 'start' | 'delta' | 'end', content?: string) => void
  /** Page context to send with every message (from usePageContext hook) */
  context?: PageContext | null
  /** Session template name to use (resolved from solution config) */
  sessionTemplate?: string
  /** User ID for session ownership (passed to backend on each message) */
  userId?: string
  /**
   * Transport mode for receiving events.
   * - 'socket': Use Socket.IO (default, backward compatible)
   * - 'sse': Use HTTP Streaming (SSE). No WebSocket required.
   *   POST /api/v1/sessions/:id/messages returns text/event-stream.
   */
  transport?: 'socket' | 'sse'
}

export interface SendMessageOptions {
  attachments?: { type: string; path: string }[]
  context?: Record<string, unknown>
}

export interface UseAgentChatReturn {
  messages: Message[]
  isProcessing: boolean
  isLoadingHistory: boolean
  /**
   * The current streaming text content. This value mirrors the `content`
   * of the last assistant message in `messages[]` while it has `isStreaming: true`.
   *
   * **IMPORTANT**: Do NOT render this separately if you already render
   * `messages[]` in a loop — the streaming message's `content` is updated
   * in real-time and will cause duplicate text. Use this only for non-rendering
   * purposes such as scroll triggers or conditional UI checks.
   *
   * To display streaming text, simply render `messages[]` — the last assistant
   * message will have live-updating `content` and `contentBlocks`.
   */
  currentStreamContent: string
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>
  clearMessages: () => void
  /** Clear messages and start a new conversation (new sessionId, new storage) */
  clearConversation: () => void
  cancelProcessing: () => void
}

export interface UseAgentStatusOptions {
  connection: UseAgentConnectionReturn
}

export type AgentStatusValue = 'idle' | 'thinking' | 'running' | 'exploring' | 'executing' | 'complete' | 'error'

export interface UseAgentStatusReturn {
  agentStatus: AgentStatusValue
  isProcessing: boolean
  activeTools: Map<string, ToolActivity>
  isThinking: boolean
  thinkingContent: string
  thinkingStartTime: number | null  // 思考开始时间戳
  thinkingVerb: string               // 当前思考动词
  tokenUsage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number } | null
  todoItems: import('@kedge-agentic/common').EventTodoItem[]
  todoStats: TodoStats
  activeSubAgents: import('@kedge-agentic/common').ActiveSubAgent[]
  jobs: JobInfo[]
  currentActivity: string
}

export interface UseOutputSyncOptions {
  /** 'manual': user clicks sync button. 'auto': sync on receive. */
  mode: 'manual' | 'auto'
  /** Solution-provided field normalization function */
  normalizeField?: (field: string, value: unknown) => unknown
  /** Undo timeout in milliseconds. Defaults to 30000. */
  undoTimeout?: number
}

export interface UseOutputSyncReturn<T extends Record<string, unknown>> {
  pendingUpdates: Map<string, OutputUpdate>
  /** Updates grouped by page key. Updates without a page are under '__default__'. */
  pendingUpdatesByPage: Map<string, Map<string, OutputUpdate>>
  /** Returns pending updates for a specific page (or '__default__' when page is undefined). */
  getPendingUpdatesForPage: (page?: string) => Map<string, OutputUpdate>
  modifiedFields: Set<string>
  handleOutputUpdate: (update: OutputUpdate) => void
  syncToForm: (field: string, currentData: T, setData: React.Dispatch<React.SetStateAction<T>>) => void
  syncAllToForm: (currentData: T, setData: React.Dispatch<React.SetStateAction<T>>) => void
  discardUpdate: (field: string) => void
  undoSync: (field: string, currentData: T, setData: React.Dispatch<React.SetStateAction<T>>) => void
  canUndo: (field: string) => boolean
  reset: () => void
}

export interface UseSkillsOptions {
  serverUrl?: string
  tenantId: string
  apiKey?: string
}

export interface UseSkillsReturn {
  skills: import('@kedge-agentic/common').Skill[]
  loading: boolean
  error: string | null
  searchQuery: string
  setSearchQuery: (q: string) => void
  filteredSkills: import('@kedge-agentic/common').Skill[]
  toggleSkill: (skillId: string) => Promise<void>
  enabledSkillIds: Set<string>
  isSkillEnabled: (skillId: string) => boolean
  refresh: () => Promise<void>
}

// ============================================================================
// Color Scheme Types (for Chat UI components)
// ============================================================================

export type ColorScheme = 'blue' | 'primary' | 'indigo' | 'emerald' | 'violet'

export interface ColorClasses {
  bg: string
  text: string
  ring: string
  hover: string
  lightBg: string
}

export const COLOR_MAP: Record<ColorScheme, ColorClasses> = {
  blue:    { bg: 'bg-blue-500',    text: 'text-blue-600',    ring: 'ring-blue-500',    hover: 'hover:bg-blue-600',    lightBg: 'bg-blue-100' },
  primary: { bg: 'bg-primary-500', text: 'text-primary-600', ring: 'ring-primary-500', hover: 'hover:bg-primary-600', lightBg: 'bg-primary-100' },
  indigo:  { bg: 'bg-indigo-500',  text: 'text-indigo-600',  ring: 'ring-indigo-500',  hover: 'hover:bg-indigo-600',  lightBg: 'bg-indigo-100' },
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-600', ring: 'ring-emerald-500', hover: 'hover:bg-emerald-600', lightBg: 'bg-emerald-100' },
  violet:  { bg: 'bg-violet-500',  text: 'text-violet-600',  ring: 'ring-violet-500',  hover: 'hover:bg-violet-600',  lightBg: 'bg-violet-100' },
}

// ============================================================================
// Chat Layout Types
// ============================================================================

export type ChatLayoutMode = 'default' | 'overlay' | 'side-by-side'

export interface UseChatLayoutReturn {
  mode: ChatLayoutMode
  setMode: (mode: ChatLayoutMode) => void
  isCollapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  overlayWidth: number
  isResizing: boolean
  overlayResizeProps: { onMouseDown: (e: React.MouseEvent) => void }
}

// ============================================================================
// Chat Component Props
// ============================================================================

export interface ChatPanelProps {
  messages: Message[]
  isProcessing: boolean
  connected: boolean
  colorScheme?: ColorScheme
  title?: string
  emptyStateText?: string
  emptyStateSubtext?: string
  placeholder?: string
  activeTools?: Map<string, ToolActivity>
  isThinking?: boolean
  thinkingContent?: string
  thinkingStartTime?: number | null  // 新增
  thinkingVerb?: string              // 新增
  todoItems?: import('@kedge-agentic/common').EventTodoItem[]
  todoStats?: TodoStats | null
  activeSubAgents?: import('@kedge-agentic/common').ActiveSubAgent[]
  tokenUsage?: TokenUsage | null     // Session-level token usage
  onSendMessage: (content: string) => void
  onCancel?: () => void
  renderMessage?: (message: Message) => React.ReactNode
  renderQuickActions?: () => React.ReactNode
  renderActivityDetails?: () => React.ReactNode
}

export interface MessageBubbleProps {
  message: Message
  colorScheme?: ColorScheme
  renderContent?: (content: string, isUser: boolean) => React.ReactNode
  children?: React.ReactNode
}

export interface ChatSectionProps {
  mode: ChatLayoutMode
  isCollapsed: boolean
  onModeChange: (mode: ChatLayoutMode) => void
  onToggleCollapse: () => void
  colorScheme?: ColorScheme
  footer?: React.ReactNode
  children: React.ReactNode
}

// ============================================================================
// API Client Types
// ============================================================================

export interface ApiClientOptions {
  baseUrl?: string
  tenantId: string
}

export interface CompletionParams {
  clientId: string
  message: string
  tenantId: string
  enabledSkills?: string[]
  attachments?: { type: string; path: string }[]
  templateName?: string
}
