/**
 * Agent Message Types for Manus UI Style Display
 *
 * These types support the hierarchical task structure:
 * - AgentTask: A collapsible task with activities inside
 * - TaskActivity: Individual tool calls or narrative text within a task
 * - RunMetadata: Metadata for sub-agent runs (for history/rollback)
 */

/**
 * Status of a task or activity
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed'

/**
 * A single activity within a task - either a tool call or narrative text
 */
export interface TaskActivity {
  /** Activity type */
  type: 'tool' | 'narrative'

  /** Unique identifier for the activity */
  id: string

  // For tool type:
  /** Tool name (e.g., 'read_reference_data', 'write_output') */
  toolName?: string

  /** Display icon (emoji) */
  toolIcon?: string

  /** Human-readable action verb (e.g., '搜索', '生成', '查阅') */
  toolAction?: string

  /** Tool parameter preview (truncated) */
  toolParam?: string

  /** Tool execution status */
  status?: 'running' | 'completed' | 'error'

  /** Duration in milliseconds */
  duration?: number

  /** Tool input parameters (for expandable details) */
  toolInput?: unknown

  /** Tool output result (for expandable details) */
  toolOutput?: string

  /** Tool error message (for expandable details) */
  toolError?: string

  // For narrative type:
  /** Narrative text displayed between tool activities */
  text?: string
}

/**
 * A task grouping multiple activities (Manus UI style)
 */
export interface AgentTask {
  /** Unique task identifier */
  id: string

  /** Task title (displayed in collapsible header) */
  title: string

  /** Task status */
  status: TaskStatus

  /** Summary text displayed after task completion */
  summary?: string

  /** Activities within this task */
  activities: TaskActivity[]

  /** Whether the task card is expanded */
  expanded?: boolean

  /** Token usage for this task (optional) */
  tokens?: number

  /** Duration in seconds (optional) */
  durationSeconds?: number

  /** Run sequence number (for rollback, e.g., "Run 2 of 3") */
  runSeq?: number

  /** Total runs (for rollback, e.g., "Run 2 of 3") */
  totalRuns?: number
}

/**
 * Metadata for a sub-agent run (used for history/rollback)
 */
export interface RunMetadata {
  /** Run sequence number (1-based) */
  seq: number

  /** ISO 8601 timestamp when run started */
  startedAt: string

  /** ISO 8601 timestamp when run completed (optional, may be in progress) */
  completedAt?: string

  /** Sub-agent type (e.g., 'lesson-plan-designer') */
  agentType: string

  /** Human-readable label for the run (e.g., '教材分析') */
  label?: string

  /** Sections generated in this run */
  sections?: string[]

  /** Token usage for this run */
  tokens?: {
    input: number
    output: number
    total: number
  }

  /** Run status */
  status: 'generating' | 'completed' | 'error'
}

/**
 * Tool icon and action mapping
 */
export interface ToolIconMapping {
  icon: string
  action: string
}

/**
 * Tool icon/action map for known tools
 *
 * Manus UI style icons (circled symbols):
 * - Q = search/query
 * - ⊘ = browse/navigate/click
 * - ✎ = write/create/edit
 * - ◉ = read/fetch data
 * - ☐ = task/todo
 */
export const TOOL_ICON_MAP: Record<string, ToolIconMapping> = {
  // Search/lookup tools (Q = Query)
  'search': { icon: 'Q', action: '搜索' },
  'search_curriculum_standards': { icon: 'Q', action: '查询课标' },
  'read_reference_data': { icon: '◉', action: '查阅' },

  // Navigation/browsing tools (⊘ = Browse)
  'navigate': { icon: '⊘', action: '跳转' },
  'mcp__ui_control__navigate': { icon: '⊘', action: '跳转' },
  'mcp__ui_control__read_page': { icon: '⊘', action: '读取页面' },
  'mcp__ui_control__click': { icon: '⊘', action: '点击' },

  // Write/generate tools (✎ = Edit/Write)
  'write': { icon: '✎', action: '写入' },
  'write_output': { icon: '✎', action: '生成' },
  'mcp__ui_control__fill_form': { icon: '✎', action: '填写' },
  'mcp__ui_control__apply_form_data': { icon: '✎', action: '更新' },

  // Data/fetch tools (◉ = Data)
  'get_lesson_plan': { icon: '◉', action: '获取教案' },
  'get_session_context': { icon: '◉', action: '加载上下文' },
  'api_call_readonly': { icon: '◉', action: '查询' },
  'read': { icon: '◉', action: '读取' },

  // Task management (☐ = Task)
  'todo_write': { icon: '☐', action: '更新任务' },

  // Default fallback
  'task': { icon: '⚙', action: '处理' },
}

/**
 * Get icon and action for a tool name
 */
export function getToolIconAndAction(toolName: string): ToolIconMapping {
  return TOOL_ICON_MAP[toolName] || { icon: '⚙️', action: toolName }
}

/**
 * Extract a short parameter preview from tool input
 */
export function extractToolParam(toolName: string, input: unknown): string {
  if (!input || typeof input !== 'object') return ''

  const obj = input as Record<string, unknown>

  // Common parameter extraction patterns
  if (obj.path && typeof obj.path === 'string') {
    return truncateParam(obj.path, 40)
  }

  if (obj.url && typeof obj.url === 'string') {
    return truncateParam(obj.url, 40)
  }

  if (obj.query && typeof obj.query === 'string') {
    return truncateParam(obj.query, 40)
  }

  if (obj.selector && typeof obj.selector === 'string') {
    return truncateParam(obj.selector, 30)
  }

  if (obj.fields && typeof obj.fields === 'object') {
    const fieldCount = Object.keys(obj.fields as object).length
    return `${fieldCount} 个字段`
  }

  // For search_curriculum_standards, extract subject/stage
  if (toolName === 'search_curriculum_standards') {
    const parts: string[] = []
    if (obj.subject) parts.push(String(obj.subject))
    if (obj.stage) parts.push(String(obj.stage))
    if (parts.length > 0) return truncateParam(parts.join('/'), 30)
  }

  // For write_output, show the module being written
  if (toolName === 'write_output') {
    if (obj.module) return truncateParam(String(obj.module), 30)
    if (obj.content && typeof obj.content === 'string') {
      return truncateParam(obj.content.substring(0, 50), 40)
    }
  }

  return ''
}

/**
 * Truncate parameter string with ellipsis
 */
function truncateParam(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.substring(0, maxLen - 3) + '...'
}

/**
 * ToolCall interface (from existing code)
 */
export interface ToolCall {
  name: string
  input?: unknown
  output?: string
  status: 'success' | 'error' | 'pending'
}

/**
 * Todo interface (from existing code)
 */
export interface Todo {
  id?: string
  content: string
  status: TaskStatus
  activeForm?: string
}

/**
 * Plan Proposal - Agent's plan for generating lesson plan sections
 * Sent from backend when agent analyzes what needs to be generated
 */
export interface PlanProposalSection {
  /** Section ID (e.g., 'textbookAnalysis') */
  id: string
  /** Section label (e.g., '教材分析') */
  label: string
  /** Reason why this section needs generation */
  reason: string
}

export interface PlanProposalContext {
  /** Lesson plan ID (if editing existing) */
  lessonPlanId?: number
  /** Subject (e.g., '数学') */
  subject?: string
  /** Grade level (1-12) */
  gradeLevel?: number
  /** Lesson title */
  title?: string
  /** Textbook chapter */
  chapterTitle?: string
}

export interface PlanProposal {
  /** Unique trace ID for this plan */
  traceId: string
  /** Sections planned for generation */
  sections: PlanProposalSection[]
  /** Context information about the lesson plan */
  context: PlanProposalContext
}

/**
 * Transform existing toolCalls and todos into AgentTask structure
 * This is the main conversion function for the UI
 */
export function transformToTasks(
  toolCalls: ToolCall[],
  todos: Todo[]
): AgentTask[] {
  // If we have todos, use them as the primary task structure
  if (todos.length > 0) {
    return todos.map((todo, index) => {
      const { icon, action } = getToolIconAndAction('task')

      return {
        id: todo.id || `task-${index}-${Date.now()}`,
        title: todo.content,
        status: todo.status,
        expanded: todo.status === 'in_progress',
        activities: []  // Activities will be populated from real-time tool events
      }
    })
  }

  // Fallback: group all toolCalls into a single "Processing" task
  if (toolCalls.length > 0) {
    const allSuccess = toolCalls.every(t => t.status === 'success')
    const anyError = toolCalls.some(t => t.status === 'error')

    return [{
      id: `default-task-${Date.now()}`,
      title: '处理请求',
      status: anyError ? 'completed' : (allSuccess ? 'completed' : 'in_progress'),
      expanded: !allSuccess,
      activities: toolCalls.map((tc, idx) => {
        const { icon, action } = getToolIconAndAction(tc.name)
        return {
          type: 'tool' as const,
          id: `activity-${idx}-${Date.now()}`,
          toolName: tc.name,
          toolIcon: icon,
          toolAction: action,
          toolParam: extractToolParam(tc.name, tc.input),
          status: tc.status === 'success' ? 'completed' :
                  tc.status === 'error' ? 'error' : 'running'
        }
      })
    }]
  }

  return []
}

/**
 * Convert a single ToolCall to TaskActivity
 */
export function toolCallToActivity(toolCall: ToolCall): TaskActivity {
  const { icon, action } = getToolIconAndAction(toolCall.name)

  return {
    type: 'tool',
    id: `tc-${toolCall.name}-${Date.now()}`,
    toolName: toolCall.name,
    toolIcon: icon,
    toolAction: action,
    toolParam: extractToolParam(toolCall.name, toolCall.input),
    status: toolCall.status === 'success' ? 'completed' :
            toolCall.status === 'error' ? 'error' : 'running'
  }
}
