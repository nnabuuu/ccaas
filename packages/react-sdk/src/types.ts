/**
 * @ccaas/react-sdk types
 *
 * Common types used by React SDK hooks. Domain-specific types
 * (e.g., LessonPlan, Explanation) remain in each solution.
 */

// Re-export event types from @ccaas/common
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
} from '@ccaas/common'

// Re-export EventTodoItem as TodoItem for convenience
export type { EventTodoItem as TodoItem } from '@ccaas/common'

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
}

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ToolBlock {
  type: 'tool'
  tool: ToolActivity
}

export type ContentBlock = TextBlock | ToolBlock

// ============================================================================
// Message Types
// ============================================================================

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  contentBlocks?: ContentBlock[]
  outputUpdates?: OutputUpdate[]
  timestamp?: Date
  createdAt?: string
  isStreaming?: boolean
}

// ============================================================================
// Output Update / Sync Types
// ============================================================================

export interface OutputUpdate {
  field: string
  value: unknown
  preview: string
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

export interface McpServerConfig {
  command: string
  args: string[]
  description?: string
}

export interface SolutionConfig {
  mcpServers?: Record<string, McpServerConfig>
  skillPath?: string | null
  skillSlug?: string | null
}

// ============================================================================
// Hook Option/Return Types
// ============================================================================

export interface UseAgentConnectionOptions {
  /** Server URL. Defaults to '/' (relative, proxied by Vite) */
  serverUrl?: string
  /** Session ID prefix, e.g., 'lpd', 'pe' */
  sessionPrefix?: string
  /** Whether to auto-connect on mount. Defaults to true */
  autoConnect?: boolean
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
}

export interface UseAgentChatOptions {
  connection: UseAgentConnectionReturn
  tenantId: string
  mcpServers?: Record<string, McpServerConfig>
  skillPath?: string | null
  enabledSkillSlugs?: string[]
  onOutputUpdate?: (update: OutputUpdate) => void
  /** Solution config endpoint path, e.g., '/api/config'. If provided, fetched on mount. */
  solutionConfigEndpoint?: string
}

export interface SendMessageOptions {
  attachments?: { type: string; path: string }[]
  context?: Record<string, unknown>
}

export interface UseAgentChatReturn {
  messages: Message[]
  isProcessing: boolean
  currentStreamContent: string
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>
  clearMessages: () => void
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
  tokenUsage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number } | null
  todoItems: import('@ccaas/common').EventTodoItem[]
  todoStats: TodoStats
  activeSubAgents: import('@ccaas/common').ActiveSubAgent[]
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
}

export interface UseSkillsReturn {
  skills: import('@ccaas/common').Skill[]
  loading: boolean
  error: string | null
  searchQuery: string
  setSearchQuery: (q: string) => void
  filteredSkills: import('@ccaas/common').Skill[]
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
  todoItems?: import('@ccaas/common').EventTodoItem[]
  todoStats?: TodoStats | null
  activeSubAgents?: import('@ccaas/common').ActiveSubAgent[]
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
  mcpServers?: Record<string, McpServerConfig>
  skillPath?: string | null
  enabledSkillSlugs?: string[]
  attachments?: { type: string; path: string }[]
}
