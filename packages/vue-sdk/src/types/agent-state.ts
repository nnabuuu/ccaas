/**
 * Agent State Types
 *
 * Type definitions for centralized agent state management.
 */

/**
 * Agent status values
 */
export type AgentStatusType = 'idle' | 'running' | 'complete' | 'error'

/**
 * Reasoning phase values
 */
export type ReasoningPhase = '' | 'analyzing' | 'planning' | 'executing' | 'reviewing'

/**
 * Tool execution phases
 */
export type ToolPhase = 'start' | 'progress' | 'complete' | 'error'

/**
 * Tool activity information
 */
export interface ToolActivity {
  /** Tool name */
  toolName: string
  /** Unique tool call ID */
  toolId: string
  /** Current execution phase */
  phase: ToolPhase | ''
  /** Human-readable description */
  description: string
  /** Sub-agent type if applicable */
  agentType?: string
  /** Execution duration in ms */
  duration?: number
  /** Whether execution succeeded */
  success?: boolean | null
  /** Timestamp of activity */
  timestamp?: string
  /** Decision logic explaining why this step */
  decisionLogic?: {
    why: string
    benefit: string
    nextStep?: string
  }
}

/**
 * Todo item status
 */
export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

/**
 * Todo item from agent
 */
export interface TodoItem {
  /** Optional unique ID */
  id?: string
  /** Task description */
  content: string
  /** Current status */
  status: TodoStatus
  /** Description shown during execution */
  activeForm?: string
  /** Progress percentage (0-100) */
  progress?: number
  /** Optional sub-steps */
  subSteps?: Array<{
    label: string
    status: TodoStatus
  }>
}

/**
 * Output generation progress
 */
export interface OutputProgress {
  totalSteps: number
  completedSteps: number
  currentStep?: string
  percentage: number
}

/**
 * Token usage metrics
 */
export interface TokenUsage {
  input: number
  output: number
  total: number
}

/**
 * Goal narrative for display
 */
export interface GoalNarrative {
  title: string
  subject?: string
  chapter?: string
  edition?: string
}

/**
 * Centralized agent state
 */
export interface AgentState {
  // Connection
  clientId: string
  sessionId: string
  isConnected: boolean

  // Processing status
  isProcessing: boolean
  currentToolName: string
  currentSkillName: string
  currentAgentType: string

  // Tool activity
  currentToolActivity: ToolActivity | null
  toolActivityHistory: ToolActivity[]

  // Todos
  todoItems: TodoItem[]
  subagentTodos: TodoItem[]
  todoStats: {
    completed: number
    inProgress: number
    pending: number
    total: number
  }

  // Reasoning
  reasoningPhase: ReasoningPhase
  reasoningSummary: string

  // Output generation
  aiOutputGenerating: boolean
  aiOutputProgress: OutputProgress

  // Metrics
  tokenUsage: TokenUsage
  elapsedSeconds: number
  sessionStartedAt: string | null

  // Run tracking
  currentRunSeq?: number
  totalAgentRuns?: number

  // Goal narrative
  goalNarrative: GoalNarrative
}

/**
 * Default agent state
 */
export function createDefaultAgentState(): AgentState {
  return {
    clientId: '',
    sessionId: '',
    isConnected: false,
    isProcessing: false,
    currentToolName: '',
    currentSkillName: '',
    currentAgentType: '',
    currentToolActivity: null,
    toolActivityHistory: [],
    todoItems: [],
    subagentTodos: [],
    todoStats: { completed: 0, inProgress: 0, pending: 0, total: 0 },
    reasoningPhase: '',
    reasoningSummary: '',
    aiOutputGenerating: false,
    aiOutputProgress: { totalSteps: 0, completedSteps: 0, percentage: 0 },
    tokenUsage: { input: 0, output: 0, total: 0 },
    elapsedSeconds: 0,
    sessionStartedAt: null,
    currentRunSeq: undefined,
    totalAgentRuns: undefined,
    goalNarrative: { title: '', subject: '', chapter: '', edition: '' },
  }
}
