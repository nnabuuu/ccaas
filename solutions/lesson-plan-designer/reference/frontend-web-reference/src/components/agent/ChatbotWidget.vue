<script setup>
/**
 * ChatbotWidget - Floating chatbot UI for interacting with the agentic copilot
 *
 * Features:
 * - Toggle open/close
 * - Send messages to agent
 * - Display agent responses and tool calls
 * - Show thinking indicator
 * - Resume button when navigation is paused
 * - New session button
 * - Session history with view and restore
 * - Interactive selection buttons for multi-choice responses
 * - Embedded mode for side panel integration
 */
import { ref, inject, nextTick, watch, onMounted, computed } from 'vue'

// Props for embedded mode (used by AiSidePanel)
const props = defineProps({
  embeddedMode: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close'])
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/core/authStore'
import ToolCallCard from './ToolCallCard.vue'
// REMOVED: SubAgentProgress, GenerationProgress, AgentProgressContainer - unified into chat flow
import ReasoningIndicator from './ReasoningIndicator.vue'
// REMOVED: ToolActivityIndicator, ToolActivityInline - replaced by TaskCard
import TaskCard from './TaskCard.vue'
import ToolActivityPill from './ToolActivityPill.vue'
import RunHistoryDropdown from './RunHistoryDropdown.vue'
import { transformToTasks, getToolIconAndAction, extractToolParam } from '@/types'

// Markdown preview for agent responses
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/preview.css'

/**
 * Parse agent message for selectable options
 * Detects two patterns:
 * 1. Numbered lists: "1. 分数的意义和性质 (五年级下册)"
 * 2. Wizard-style brackets: "- [268] 分数的意义 (五年级下册 · 人民教育出版社)"
 * Returns { textBefore, options, textAfter } or null if no options found
 */
function parseOptionsFromText(text) {
  if (!text) return null

  // Try wizard-style bracket format first: "- [id] label (meta)"
  const wizardPattern = /^[-*]\s*\[(\w+)\]\s*(.+?)(?:\s*\(([^)]+)\))?$/gm
  const wizardMatches = []
  let match

  while ((match = wizardPattern.exec(text)) !== null) {
    wizardMatches.push({
      id: match[1],
      label: match[2].trim(),
      meta: match[3] ? match[3].trim() : null,
      fullMatch: match[0]
    })
  }

  if (wizardMatches.length >= 2) {
    // Found wizard-style options
    const firstMatch = wizardMatches[0]
    const lastMatch = wizardMatches[wizardMatches.length - 1]
    const firstIndex = text.indexOf(firstMatch.fullMatch)
    const lastEndIndex = text.indexOf(lastMatch.fullMatch) + lastMatch.fullMatch.length

    const textBefore = text.substring(0, firstIndex).trim()
    const textAfter = text.substring(lastEndIndex).trim()

    return {
      textBefore,
      options: wizardMatches.map(m => ({
        value: m.id,
        label: m.label,
        meta: m.meta
      })),
      textAfter,
      type: 'wizard'
    }
  }

  // Fall back to numbered list pattern: "1. text", "1、text", "1) text"
  const optionPattern = /^(\d+)[.、)]\s*(.+)$/gm
  const numberedMatches = []

  while ((match = optionPattern.exec(text)) !== null) {
    numberedMatches.push({
      number: match[1],
      text: match[2].trim(),
      fullMatch: match[0]
    })
  }

  // Need at least 2 options to consider it a selection
  if (numberedMatches.length < 2) return null

  // Check if matches are consecutive (likely a list)
  const numbers = numberedMatches.map(m => parseInt(m.number))
  const isConsecutive = numbers.every((n, i) => i === 0 || n === numbers[i - 1] + 1)
  if (!isConsecutive || numbers[0] !== 1) return null

  // Find where the options start and end
  const firstMatch = numberedMatches[0]
  const lastMatch = numberedMatches[numberedMatches.length - 1]
  const firstIndex = text.indexOf(firstMatch.fullMatch)
  const lastEndIndex = text.indexOf(lastMatch.fullMatch) + lastMatch.fullMatch.length

  const textBefore = text.substring(0, firstIndex).trim()
  const textAfter = text.substring(lastEndIndex).trim()

  return {
    textBefore,
    options: numberedMatches.map(m => ({
      value: m.number,
      label: m.text
    })),
    textAfter,
    type: 'numbered'
  }
}

// Inject from AgentListener with defaults
const clientId = inject('agentClientId', ref(''))
const isConnected = inject('agentConnected', ref(false))
const navigationPaused = inject('navigationPaused', ref(false))
const resumeNavigation = inject('resumeNavigation', () => {})
const agentAuthReady = inject('agentAuthReady', ref(true)) // Default true to not block if not provided
const resetAgentProcessing = inject('resetAgentProcessing', () => {}) // Reset WebSocket processing state after HTTP response

// Real-time status from AgentListener with defaults
const isAgentProcessing = inject('isAgentProcessing', ref(false))
const currentToolName = inject('currentToolName', ref(''))
const currentSkillName = inject('currentSkillName', ref(''))
const currentAgentType = inject('currentAgentType', ref(''))  // Sub-agent type (e.g., 'lesson-plan-designer')
const currentToolDuration = inject('currentToolDuration', ref(0))  // Tool execution duration in ms
const currentToolInput = inject('currentToolInput', ref(null))  // Tool input parameters (sanitized)
const toolActivityHistory = inject('toolActivityHistory', ref([]))  // Tool activity history for inline display
const retryInfo = inject('retryInfo', ref({ count: 0, maxRetries: 10, exhausted: false }))
const streamingText = inject('streamingText', ref(''))
const stallWarning = inject('stallWarning', ref(null)) // Stall detection warning from agent

// A2UI: Structured UI components from agent
const pendingUIComponent = inject('pendingUIComponent', ref(null))
const handleUIInteraction = inject('handleUIInteraction', () => {})

// Plan Mode: Proposal waiting for user confirmation
const pendingPlanProposal = inject('pendingPlanProposal', ref(null))
const confirmPlanProposal = inject('confirmPlanProposal', () => {})
const rejectPlanProposal = inject('rejectPlanProposal', () => {})

// Todo items from agent
const todoItems = inject('todoItems', ref([]))
const todoStats = inject('todoStats', ref({ completed: 0, inProgress: 0, pending: 0, total: 0 }))

// Sub-agent todo progress
const subagentTodos = inject('subagentTodos', ref([]))
const subagentProgress = inject('subagentProgress', ref({ agentType: '', completed: 0, inProgress: 0, pending: 0, total: 0 }))

// Run tracking (for history/rollback)
const currentRunSeq = inject('currentRunSeq', ref(undefined))
const totalAgentRuns = inject('totalAgentRuns', ref(undefined))

// Session progress metrics (for token display)
const elapsedSeconds = inject('elapsedSeconds', ref(0))
const tokenUsage = inject('tokenUsage', ref({ input: 0, output: 0, total: 0 }))

// AI output generation progress
const aiOutputGenerating = inject('aiOutputGenerating', ref(false))
const aiOutputProgress = inject('aiOutputProgress', ref({ totalSteps: 0, completedSteps: 0, currentStep: '', percentage: 0 }))

// Reasoning/planning phase display
const reasoningPhase = inject('reasoningPhase', ref(''))
const reasoningSummary = inject('reasoningSummary', ref(''))
// Reasoning history: accumulated phases for current request (saved to each message)
const reasoningHistory = inject('reasoningHistory', ref([]))

// Clear agent state function (for new session)
const clearAgentState = inject('clearAgentState', () => {})

// Session tracking for startNewSession detection
const hasMessageSentInSession = inject('hasMessageSentInSession', ref(false))
const markMessageSent = inject('markMessageSent', () => {})

// Computed: derive current step from subagentTodos (more reliable than write_output progress)
const currentActiveStep = computed(() => {
  // Find the todo item that's currently in progress
  const inProgressTodo = subagentTodos.value.find(todo => todo.status === 'in_progress')
  if (inProgressTodo) {
    return inProgressTodo.activeForm || inProgressTodo.content
  }
  // Fallback to aiOutputProgress.currentStep
  return aiOutputProgress.value.currentStep || ''
})

/**
 * Real-time tasks for Manus UI style loading display
 * Transforms subagentTodos + toolActivityHistory into AgentTask[] format
 * This is shown in the chat flow during processing (not in a separate panel)
 */
const realTimeTasksForLoading = computed(() => {
  const todos = subagentTodos.value || []
  const activities = toolActivityHistory.value || []

  // If we have todos, use them as the task structure
  if (todos.length > 0) {
    return todos.map((todo, index) => {
      // Find activities that might belong to this task
      // For now, associate all activities with the in_progress task
      const taskActivities = todo.status === 'in_progress'
        ? activities.map((act, actIdx) => ({
            type: 'tool',
            id: act.toolId || `act-${actIdx}`,
            toolName: act.toolName,
            toolIcon: getToolIconAndAction(act.toolName).icon,
            toolAction: getToolIconAndAction(act.toolName).action,
            toolParam: act.description?.replace(/^正在/, '').replace(/\.\.\.$/g, '') || '',
            status: act.completed ? 'completed' : (act.success === false ? 'error' : 'running'),
            // New fields for expandable details
            toolInput: act.toolInput,
            toolOutput: act.toolOutput,
            toolError: act.error,
            duration: act.duration,
          }))
        : []

      return {
        id: todo.id || `task-${index}`,
        title: todo.content,
        status: todo.status,
        expanded: todo.status === 'in_progress',
        activities: taskActivities,
        summary: todo.status === 'completed' ? '' : '',
        // Add token and run info for completed tasks
        tokens: todo.status === 'completed' ? tokenUsage.value.total : undefined,
        durationSeconds: todo.status === 'completed' ? elapsedSeconds.value : undefined,
        runSeq: currentRunSeq.value,
        totalRuns: totalAgentRuns.value,
      }
    })
  }

  // Fallback: if we have activities but no todos, create a default task
  if (activities.length > 0) {
    return [{
      id: 'default-processing',
      title: '处理请求中...',
      status: 'in_progress',
      expanded: true,
      activities: activities.map((act, idx) => ({
        type: 'tool',
        id: act.toolId || `act-${idx}`,
        toolName: act.toolName,
        toolIcon: getToolIconAndAction(act.toolName).icon,
        toolAction: getToolIconAndAction(act.toolName).action,
        toolParam: act.description?.replace(/^正在/, '').replace(/\.\.\.$/g, '') || '',
        status: act.completed ? 'completed' : (act.success === false ? 'error' : 'running'),
        // New fields for expandable details
        toolInput: act.toolInput,
        toolOutput: act.toolOutput,
        toolError: act.error,
        duration: act.duration,
      })),
      summary: '',
      // Add token and run info
      tokens: tokenUsage.value.total || undefined,
      durationSeconds: elapsedSeconds.value || undefined,
      runSeq: currentRunSeq.value,
      totalRuns: totalAgentRuns.value,
    }]
  }

  return []
})

// Auth store for token
const authStore = useAuthStore()

// Router for page context
const router = useRouter()

// Lesson plan store for live form data
import { useLessonPlanStore } from '@/stores/domain/lessonPlanStore'
const lessonPlanStore = useLessonPlanStore()

// Widget state
const isOpen = ref(false)
const inputMessage = ref('')
const isLoading = ref(false)
const messages = ref([])

// Debug mode
const debugMode = ref(false)
const debugLogs = ref([]) // Array of { timestamp, type, data }

/**
 * Add a debug log entry
 */
function addDebugLog(type, data) {
  if (!debugMode.value) return
  debugLogs.value.push({
    timestamp: new Date().toLocaleTimeString(),
    type,
    data: typeof data === 'object' ? JSON.stringify(data, null, 2) : data
  })
  // Keep only last 50 logs
  if (debugLogs.value.length > 50) {
    debugLogs.value = debugLogs.value.slice(-50)
  }
}

/**
 * Clear debug logs
 */
function clearDebugLogs() {
  debugLogs.value = []
}

/**
 * Inject mock AI data directly into lessonPlanStore for testing
 * This bypasses the backend entirely - pure frontend injection
 */
function injectMockAIData() {
  console.log('[ChatbotWidget] Injecting mock AI data...')

  // Mock textbook analysis data - must match TextbookAnalysisValue interface
  // Each section requires { title: string, content: string } structure
  const mockTextbookAnalysis = {
    coursePosition: {
      title: '教学内容的地位和作用',
      content: '本课是小学数学三年级上册第五单元的核心内容，两位数进退位加减法是学生从基础计算向复杂运算过渡的关键节点。承接100以内不进退位加减法，为后续学习多位数运算打下基础。'
    },
    keyPointsAnalysis: {
      title: '教学重点和难点分析',
      content: '**教学重点：**\n- 掌握进退位的计算方法和竖式书写规范\n\n**教学难点：**\n- 理解"满十进一"和"退一当十"的算理'
    },
    logicalStructure: {
      title: '教材内容的逻辑结构',
      content: '本课内容包括：\n1. 进位加法的算理与方法\n2. 退位减法的算理与方法\n3. 竖式计算的规范书写\n4. 实际问题的应用'
    },
    teachingStrategies: {
      title: '教学策略建议',
      content: '建议采用操作性强的教学活动，让学生在动手中理解算理。可使用计数器、小棒等教具帮助学生建立直观认识。'
    }
  }

  // Inject into store
  lessonPlanStore.updateFromAI('textbookAnalysis', mockTextbookAnalysis)
  lessonPlanStore.completeAISection('textbookAnalysis')

  console.log('[ChatbotWidget] Mock data injected for textbookAnalysis')
  addDebugLog('inject', { section: 'textbookAnalysis', data: mockTextbookAnalysis })
}

// Expanded tool calls (for debug mode)
const expandedTools = ref(new Set())

// Session management
const STORAGE_KEY = 'ai_chat_sessions'
const currentSessionId = ref('')
const showHistoryPanel = ref(false)
const sessionHistory = ref([])

/**
 * Generate unique session ID
 */
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Load session history from localStorage
 */
function loadSessionHistory() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      sessionHistory.value = JSON.parse(stored)
    }
  } catch (e) {
    console.error('[ChatbotWidget] Failed to load session history:', e)
    sessionHistory.value = []
  }
}

/**
 * Save session history to localStorage
 */
function saveSessionHistory() {
  try {
    // Keep only last 20 sessions
    const toSave = sessionHistory.value.slice(0, 20)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch (e) {
    console.error('[ChatbotWidget] Failed to save session history:', e)
  }
}

/**
 * Save current session to history
 */
function saveCurrentSession() {
  if (messages.value.length === 0) return

  // Get first user message as title
  const firstUserMsg = messages.value.find(m => m.type === 'user')
  const title = firstUserMsg?.content?.substring(0, 50) || '新会话'

  // Find existing or create new
  const existingIndex = sessionHistory.value.findIndex(s => s.id === currentSessionId.value)
  const sessionData = {
    id: currentSessionId.value,
    title: title + (title.length >= 50 ? '...' : ''),
    messages: [...messages.value],
    createdAt: existingIndex >= 0 ? sessionHistory.value[existingIndex].createdAt : Date.now(),
    updatedAt: Date.now(),
  }

  if (existingIndex >= 0) {
    sessionHistory.value[existingIndex] = sessionData
  } else {
    sessionHistory.value.unshift(sessionData)
  }

  saveSessionHistory()
}

/**
 * Start a new session
 */
async function startNewSession() {
  // Save current session first
  saveCurrentSession()

  // Clear current messages
  messages.value = []
  currentSessionId.value = generateSessionId()

  // Clear agent state (todos, pending UI, etc.)
  clearAgentState()

  // Clear backend session (both in-memory and database)
  if (clientId.value) {
    try {
      await fetch(`http://localhost:3001/agent/session/${clientId.value}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ authToken: authStore.token }),
      })
      console.log('[ChatbotWidget] Backend session cleared')
    } catch (e) {
      console.warn('[ChatbotWidget] Failed to clear backend session:', e)
    }
  }
}

/**
 * Restore a session from history
 */
function restoreSession(session) {
  // Save current session first
  saveCurrentSession()

  // Restore selected session
  currentSessionId.value = session.id
  messages.value = [...session.messages]
  showHistoryPanel.value = false

  scrollToBottom()
}

/**
 * Delete a session from history
 */
function deleteSession(sessionId, event) {
  event.stopPropagation()
  sessionHistory.value = sessionHistory.value.filter(s => s.id !== sessionId)
  saveSessionHistory()
}

/**
 * Format date for display
 */
function formatDate(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  } else if (diffDays === 1) {
    return '昨天'
  } else if (diffDays < 7) {
    return `${diffDays}天前`
  } else {
    return `${date.getMonth() + 1}/${date.getDate()}`
  }
}

// Initialize on mount
onMounted(() => {
  loadSessionHistory()
  currentSessionId.value = generateSessionId()
})

// Watch streaming text to update message display
// Use isAgentProcessing (from AgentListener) instead of local isLoading
// This ensures text displays even when session resumes or agent triggers from other sources
watch(streamingText, (newText) => {
  if (newText && (isLoading.value || isAgentProcessing.value)) {
    // Find the last streaming message or create one
    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg && lastMsg.type === 'streaming') {
      lastMsg.content = newText
    } else {
      messages.value.push({
        type: 'streaming',
        content: newText,
        timestamp: new Date(),
      })
    }
    scrollToBottom()
  }
})

// Watch agent status for debug logging
const agentStatus = inject('agentStatus', ref(null))
watch(agentStatus, (status) => {
  if (status && debugMode.value) {
    addDebugLog(status.type, status.data)
  }
})

// Refs
const messagesContainer = ref(null)

/**
 * Toggle widget open/close
 */
function toggleWidget() {
  isOpen.value = !isOpen.value
}

/**
 * Build full context from current route and form state
 * Includes page info, lesson plan metadata, and LIVE form data (including unsaved edits)
 * This context is pushed to backend on every message for agent to read as context.json
 */
function buildContext() {
  const route = router.currentRoute.value

  // Determine page type from route name or path pattern
  let pageType = 'unknown'
  if (route.name === 'lesson-plan-detail' || /^\/lesson-plan\/\d+$/.test(route.path)) {
    pageType = 'lesson-plan-detail'
  } else if (route.name === 'lesson-plan-list' || route.path === '/lesson-plan') {
    pageType = 'lesson-plan-list'
  } else if (route.name === 'lesson-plan-create' || route.path === '/lesson-plan/create') {
    pageType = 'lesson-plan-create'
  } else if (route.path === '/') {
    pageType = 'home'
  }

  // Build base context
  const context = {
    page: {
      type: pageType,
      path: route.path,
    },
    // Legacy fields for backward compatibility
    currentPath: route.path,
    pageType,
    pathParams: route.params,
    query: route.query,
    name: route.name,
  }

  // Add lesson plan context if on lesson plan page
  if (pageType === 'lesson-plan-detail' && lessonPlanStore.lessonPlan) {
    const lp = lessonPlanStore.lessonPlan

    // Lesson plan metadata
    context.lessonPlan = {
      id: lp.id,
      title: lp.title,
      subject: lp.subject,
      gradeLevel: lp.gradeLevel,
      chapterId: lp.chapterId,
      chapterTitle: lp.chapterTitle,
    }

    // Live form data - includes unsaved edits from sectionDrafts
    // Agent can use this to understand what user is currently working on
    const parsedContent = lessonPlanStore.parsedContent
    const drafts = lessonPlanStore.sectionDrafts

    context.formData = {
      // Use draft if editing, otherwise use parsed content
      courseRequirements: drafts.courseRequirements ?? parsedContent.courseRequirements,
      textbookAnalysis: drafts.textbookAnalysis ?? parsedContent.textbookAnalysis,
      studentAnalysis: drafts.studentAnalysis ?? parsedContent.studentAnalysis,
      learningObjectives: drafts.learningObjectives ?? parsedContent.learningObjectives,
      preClassPreparation: drafts.preClassPreparation ?? parsedContent.preClassPreparation,
      learningTasks: drafts.learningProcess ?? parsedContent.learningTasks,
      homeworkTasks: drafts.homeworkAssessment ?? parsedContent.homeworkTasks,
    }

    // Form state flags
    context.isDirty = lessonPlanStore.isDirty
    context.lastModified = new Date().toISOString()
  }

  return context
}

/**
 * Send message to agent
 */
async function sendMessage() {
  if (!inputMessage.value.trim() || isLoading.value) return
  if (!clientId.value) {
    console.warn('[ChatbotWidget] Not connected to agent backend')
    return
  }

  const userMessage = inputMessage.value.trim()
  inputMessage.value = ''

  // Check if this is a new session (first message after page load or new session button)
  const isNewSession = !hasMessageSentInSession.value

  // Add user message to chat
  messages.value.push({
    type: 'user',
    content: userMessage,
    timestamp: new Date(),
  })

  await scrollToBottom()

  // Send to backend
  isLoading.value = true

  // Build full context including page info and live form data
  const context = buildContext()

  // Debug log the request
  addDebugLog('request', {
    message: userMessage,
    clientId: clientId.value,
    startNewSession: isNewSession,
    context,
  })

  try {
    const response = await fetch('http://localhost:3001/agent/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        clientId: clientId.value,
        authToken: authStore.token, // Include user's auth token for authenticated API calls
        startNewSession: isNewSession, // Tell backend to start fresh if this is first message
        context, // Full context including page info and live form data (replaces pageContext)
      }),
    })

    // Mark that a message has been sent in this session
    markMessageSent()

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()

    // Debug log the response
    addDebugLog('response', {
      text: data.text?.substring(0, 200) + (data.text?.length > 200 ? '...' : ''),
      toolCallCount: data.toolCalls?.length || 0,
      sessionId: data.sessionId,
    })

    // Check for business-layer errors from agent
    if (data.error || data.result === 'error') {
      messages.value.push({
        type: 'error',
        content: data.error || 'Agent 处理失败',
        timestamp: new Date(),
      })
      return  // Early return, don't process further
    }

    // Find and handle any existing streaming message FIRST
    // (before adding tool calls which would change the last message)
    const streamingMsgIndex = messages.value.findIndex(m => m.type === 'streaming')
    if (streamingMsgIndex !== -1) {
      // Remove the streaming message - we'll add the final text properly below
      messages.value.splice(streamingMsgIndex, 1)
    }

    // Add tool calls
    if (data.toolCalls && data.toolCalls.length > 0) {
      messages.value.push({
        type: 'tools',
        toolCalls: data.toolCalls,
        timestamp: new Date(),
      })
    }

    // Add final agent message if there's text
    if (data.text) {
      messages.value.push({
        type: 'agent',
        content: data.text,
        timestamp: new Date(),
        reasoningHistory: [...reasoningHistory.value], // Copy current reasoning history
      })
    }

    // Clear streaming text for next message
    streamingText.value = ''

    // Reset WebSocket processing state - HTTP response means this request is done
    resetAgentProcessing()
  } catch (error) {
    console.error('[ChatbotWidget] Error sending message:', error)
    messages.value.push({
      type: 'error',
      content: '发送消息失败，请重试',
      timestamp: new Date(),
    })
  } finally {
    isLoading.value = false
    await scrollToBottom()
    // Auto-save session after each response
    saveCurrentSession()
  }
}

/**
 * Handle Enter key to send
 */
function handleKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

/**
 * Scroll chat to bottom
 */
async function scrollToBottom() {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

/**
 * Get tool call display name with Chinese translations
 * Shows user-friendly names without exposing internal architecture
 */
function getToolDisplayName(toolName) {
  const names = {
    // Main agent tools - hide internal concepts
    task: '',  // Don't show "sub-agent" concept to users
    read: '读取数据',
    write: '写入数据',
    search: '搜索',
    // Legacy UI control tools
    navigate_tool: '导航',
    focus_tool: '聚焦',
    read_page_tool: '读取页面',
    click_tool: '点击',
    fill_form_tool: '填写表单',
    // Internal tools - show friendly names
    get_lesson_plan: '获取教案',
    get_session_context: '加载上下文',
    write_output: '生成内容',
    read_reference_data: '查阅教材',
    api_call_readonly: '查询数据',
    // MCP tools
    mcp__ui_control__navigate: '页面跳转',
    mcp__ui_control__read_page: '读取页面',
    mcp__ui_control__fill_form: '填写表单',
    mcp__ui_control__apply_form_data: '更新表单',
    mcp__ui_control__open_chapter_selector: '选择章节',
  }
  return names[toolName] || toolName
}

/**
 * Get tool call status icon
 */
function getToolStatusIcon(status) {
  switch (status) {
    case 'success':
      return '✓'
    case 'error':
      return '✗'
    default:
      return '...'
  }
}

/**
 * Handle retry after exhausted attempts
 */
function handleRetry() {
  // Reset retry info and resend last message
  if (retryInfo && retryInfo.value) {
    retryInfo.value = { count: 0, maxRetries: 10, exhausted: false }
  }
  // Optionally trigger resend
}

/**
 * Handle abort after exhausted attempts
 */
function handleAbort() {
  if (retryInfo && retryInfo.value) {
    retryInfo.value = { count: 0, maxRetries: 10, exhausted: false }
  }
  isLoading.value = false
  messages.value.push({
    type: 'error',
    content: '操作已取消',
    timestamp: new Date(),
  })
}

/**
 * Handle option selection from clickable buttons
 * @param {Object} option - The selected option { value, label, meta? }
 * @param {number} msgIndex - Index of the message containing options
 */
async function selectOption(option, msgIndex) {
  // Mark the options as used (disable further clicks)
  const msg = messages.value[msgIndex]
  if (msg && msg.parsedOptions) {
    msg.optionSelected = option.value
  }

  // Send the full label so LLM understands what user selected
  // (not just "1" which LLM can't interpret without context)
  inputMessage.value = option.label
  await sendMessage()
}

/**
 * Get parsed options for a message (cached for reactivity)
 */
function getParsedOptions(msg) {
  if (msg.type !== 'agent' || msg.optionSelected) return null
  if (!msg._parsedOptions) {
    msg._parsedOptions = parseOptionsFromText(msg.content)
    if (msg._parsedOptions) {
      msg.parsedOptions = true
    }
  }
  return msg._parsedOptions
}

/**
 * Copy client ID to clipboard for debugging
 */
async function copyClientId() {
  if (!clientId.value) return

  try {
    await navigator.clipboard.writeText(clientId.value)
    console.log('[ChatbotWidget] Client ID copied:', clientId.value)
    // Could show a toast notification here
  } catch (err) {
    console.error('[ChatbotWidget] Failed to copy:', err)
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = clientId.value
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
  }
}

/**
 * Handle A2UI option selection
 * Sends the selection back to the agent and triggers a follow-up message
 */
async function selectA2UIOption(option, component) {
  console.log('[ChatbotWidget] A2UI option selected:', option, component?.componentId)

  // Send interaction to backend via AgentListener
  handleUIInteraction({
    componentId: component.componentId,
    action: 'select',
    value: option.id,
    data: option.data || {}
  })

  // Add a friendly user message showing what was selected
  const displayText = option.meta
    ? `已选择：${option.label}（${option.meta}）`
    : `已选择：${option.label}`

  messages.value.push({
    type: 'user',
    content: displayText,
    timestamp: new Date(),
  })

  await scrollToBottom()

  // Send to backend with the actual ID
  isLoading.value = true
  try {
    const response = await fetch('http://localhost:3001/agent/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: String(option.id),
        clientId: clientId.value,
        authToken: authStore.token,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()

    // Check for business-layer errors from agent
    if (data.error || data.result === 'error') {
      messages.value.push({
        type: 'error',
        content: data.error || 'Agent 处理失败',
        timestamp: new Date(),
      })
      return  // Early return, don't process further
    }

    // Handle streaming message
    const streamingMsgIndex = messages.value.findIndex(m => m.type === 'streaming')
    if (streamingMsgIndex !== -1) {
      messages.value.splice(streamingMsgIndex, 1)
    }

    // Add tool calls
    if (data.toolCalls && data.toolCalls.length > 0) {
      messages.value.push({
        type: 'tools',
        toolCalls: data.toolCalls,
        timestamp: new Date(),
      })
    }

    // Add final agent message
    if (data.text) {
      messages.value.push({
        type: 'agent',
        content: data.text,
        timestamp: new Date(),
        reasoningHistory: [...reasoningHistory.value], // Copy current reasoning history
      })
    }

    streamingText.value = ''
    resetAgentProcessing()
  } catch (error) {
    console.error('[ChatbotWidget] Error sending selection:', error)
    messages.value.push({
      type: 'error',
      content: '发送选择失败，请重试',
      timestamp: new Date(),
    })
  } finally {
    isLoading.value = false
    await scrollToBottom()
    saveCurrentSession()
  }
}

/**
 * Handle A2UI confirm action
 */
async function handleA2UIConfirm(confirmed, component) {
  console.log('[ChatbotWidget] A2UI confirm:', confirmed, component?.componentId)

  handleUIInteraction({
    componentId: component.componentId,
    action: confirmed ? 'confirm' : 'cancel',
    value: confirmed ? 'yes' : 'no',
    data: component.data || {}
  })

  // Add a friendly user message
  const displayText = confirmed
    ? `已确认：${component.confirmLabel || '确认'}`
    : `已取消：${component.cancelLabel || '取消'}`

  messages.value.push({
    type: 'user',
    content: displayText,
    timestamp: new Date(),
  })

  await scrollToBottom()

  // Send to backend
  isLoading.value = true
  try {
    const response = await fetch('http://localhost:3001/agent/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: confirmed ? '确认' : '取消',
        clientId: clientId.value,
        authToken: authStore.token,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()

    // Check for business-layer errors from agent
    if (data.error || data.result === 'error') {
      messages.value.push({
        type: 'error',
        content: data.error || 'Agent 处理失败',
        timestamp: new Date(),
      })
      return  // Early return, don't process further
    }

    // Handle streaming message
    const streamingMsgIndex = messages.value.findIndex(m => m.type === 'streaming')
    if (streamingMsgIndex !== -1) {
      messages.value.splice(streamingMsgIndex, 1)
    }

    // Add tool calls
    if (data.toolCalls && data.toolCalls.length > 0) {
      messages.value.push({
        type: 'tools',
        toolCalls: data.toolCalls,
        timestamp: new Date(),
      })
    }

    // Add final agent message
    if (data.text) {
      messages.value.push({
        type: 'agent',
        content: data.text,
        timestamp: new Date(),
        reasoningHistory: [...reasoningHistory.value], // Copy current reasoning history
      })
    }

    streamingText.value = ''
    resetAgentProcessing()
  } catch (error) {
    console.error('[ChatbotWidget] Error sending confirmation:', error)
    messages.value.push({
      type: 'error',
      content: '发送确认失败，请重试',
      timestamp: new Date(),
    })
  } finally {
    isLoading.value = false
    await scrollToBottom()
    saveCurrentSession()
  }
}

/**
 * Get icon for reasoning phase
 */
function getPhaseIcon(phase) {
  const icons = {
    analyzing: '&#x1F50D;',  // 🔍
    planning: '&#x1F4CB;',   // 📋
    executing: '&#x26A1;',   // ⚡
    reviewing: '&#x2713;'    // ✓
  }
  return icons[phase] || ''
}

/**
 * Convert message toolCalls to AgentTask[] for Manus UI display
 * Groups tool calls with sub-agent todos when available
 */
function getTasksForMessage(msg) {
  if (!msg.toolCalls || msg.toolCalls.length === 0) {
    return []
  }

  // Check if we have sub-agent todos to use as the task structure
  const todos = subagentTodos.value || []

  if (todos.length > 0) {
    // Use todos as primary task structure
    return todos.map((todo, index) => {
      const task = {
        id: todo.id || `task-${index}`,
        title: todo.content,
        status: todo.status,
        expanded: todo.status === 'in_progress',
        activities: [],
        summary: ''
      }

      // Associate tool calls with this task based on timing or tool name
      // For now, distribute tool calls evenly or based on heuristics
      const toolsPerTask = Math.ceil(msg.toolCalls.length / todos.length)
      const startIdx = index * toolsPerTask
      const endIdx = Math.min(startIdx + toolsPerTask, msg.toolCalls.length)

      for (let i = startIdx; i < endIdx; i++) {
        const tc = msg.toolCalls[i]
        const { icon, action } = getToolIconAndAction(tc.name)
        task.activities.push({
          type: 'tool',
          id: `activity-${index}-${i}`,
          toolName: tc.name,
          toolIcon: icon,
          toolAction: action,
          toolParam: extractToolParam(tc.name, tc.input),
          status: tc.status === 'success' ? 'completed' :
                  tc.status === 'error' ? 'error' : 'running'
        })
      }

      return task
    })
  }

  // Fallback: Create a single task with all tool calls
  const allSuccess = msg.toolCalls.every(tc => tc.status === 'success')
  const anyError = msg.toolCalls.some(tc => tc.status === 'error')

  return [{
    id: 'default-task',
    title: '处理请求',
    status: anyError ? 'completed' : (allSuccess ? 'completed' : 'in_progress'),
    expanded: !allSuccess,
    activities: msg.toolCalls.map((tc, idx) => {
      const { icon, action } = getToolIconAndAction(tc.name)
      return {
        type: 'tool',
        id: `activity-${idx}`,
        toolName: tc.name,
        toolIcon: icon,
        toolAction: action,
        toolParam: extractToolParam(tc.name, tc.input),
        status: tc.status === 'success' ? 'completed' :
                tc.status === 'error' ? 'error' : 'running'
      }
    }),
    summary: allSuccess ? `完成 ${msg.toolCalls.length} 个操作` : ''
  }]
}

/**
 * Check if a tool should be displayed (filter out internal tools)
 */
function shouldShowTool(toolName) {
  // Hide internal tools like 'task' that spawn sub-agents
  const hiddenTools = ['task']
  return !hiddenTools.includes(toolName)
}

/**
 * Handle rollback request from RunHistoryDropdown
 * @param seq - Run sequence number to rollback to
 */
async function handleRunRollback(seq) {
  console.log('[ChatbotWidget] Rollback requested to run:', seq)

  // TODO: Show confirmation dialog
  const confirmed = window.confirm(`确定要回退到 Run ${seq} 吗？当前更改将被覆盖。`)
  if (!confirmed) return

  try {
    // Call backend rollback API
    const response = await fetch(`http://localhost:3001/agent/session/${clientId.value}/rollback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authToken: authStore.token,
        runSeq: seq,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()

    // Update lesson plan store with rollback data
    if (data.data) {
      lessonPlanStore.startAIEditing()
      Object.entries(data.data).forEach(([key, value]) => {
        lessonPlanStore.updateFromAI(key, value)
        lessonPlanStore.completeAISection(key)
      })
      lessonPlanStore.finishAIEditing()
    }

    // Add system message to chat
    messages.value.push({
      type: 'agent',
      content: `已回退到 Run ${seq}。表单内容已更新。`,
      timestamp: new Date(),
    })

    scrollToBottom()
  } catch (error) {
    console.error('[ChatbotWidget] Rollback failed:', error)
    messages.value.push({
      type: 'error',
      content: `回退失败：${error.message}`,
      timestamp: new Date(),
    })
  }
}

/**
 * Handle view run request from RunHistoryDropdown
 * @param seq - Run sequence number to view
 */
function handleViewRun(seq) {
  console.log('[ChatbotWidget] View run requested:', seq)
  // For now, just log - could open a modal with run details
  // TODO: Implement run details modal
}
</script>

<template>
  <div class="chatbot-widget" :class="{ 'embedded-mode': embeddedMode }">
    <!-- Toggle Button (hidden in embedded mode) -->
    <button
      v-if="!embeddedMode"
      class="chatbot-toggle"
      :class="{ open: isOpen, connected: isConnected }"
      @click="toggleWidget"
    >
      <span v-if="!isOpen" class="icon">AI</span>
      <span v-else class="icon">×</span>
    </button>

    <!-- Chat Panel (always visible in embedded mode) -->
    <div v-if="isOpen || embeddedMode" class="chatbot-panel">
      <!-- Header -->
      <div class="chatbot-header">
        <div class="header-left">
          <span class="title">AI 助手</span>
          <span class="status" :class="{ connected: isConnected && agentAuthReady }">
            <template v-if="!isConnected">未连接</template>
            <template v-else-if="!agentAuthReady">初始化中...</template>
            <template v-else>已就绪</template>
          </span>
          <span
            v-if="clientId"
            class="session-id"
            :title="`Client ID: ${clientId}\nClick to copy`"
            @click="copyClientId"
          >
            {{ clientId.slice(0, 8) }}...
          </span>
          <!-- Run History Dropdown -->
          <RunHistoryDropdown
            v-if="currentRunSeq !== undefined"
            @rollback="handleRunRollback"
            @view-run="handleViewRun"
          />
        </div>
        <div class="header-actions">
          <button
            class="header-btn"
            :class="{ active: debugMode }"
            title="调试模式"
            @click="debugMode = !debugMode"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
              <path d="M12 16v-4"/>
              <path d="M12 8h.01"/>
            </svg>
          </button>
          <button
            class="header-btn"
            title="历史记录"
            @click="showHistoryPanel = !showHistoryPanel"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </button>
          <button
            class="header-btn"
            title="新会话"
            @click="startNewSession"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <!-- Close button for embedded mode -->
          <button
            v-if="embeddedMode"
            class="header-btn close-panel-btn"
            title="关闭面板"
            @click="$emit('close')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- History Panel -->
      <div v-if="showHistoryPanel" class="history-panel">
        <div class="history-header">
          <span>历史会话</span>
          <button class="close-btn" @click="showHistoryPanel = false">&times;</button>
        </div>
        <div class="history-list">
          <div v-if="sessionHistory.length === 0" class="history-empty">
            暂无历史记录
          </div>
          <div
            v-for="session in sessionHistory"
            :key="session.id"
            class="history-item"
            :class="{ active: session.id === currentSessionId }"
            @click="restoreSession(session)"
          >
            <div class="history-item-content">
              <div class="history-title">{{ session.title }}</div>
              <div class="history-meta">
                <span class="history-date">{{ formatDate(session.updatedAt) }}</span>
                <span class="history-count">{{ session.messages.length }} 条消息</span>
              </div>
            </div>
            <button
              class="history-delete"
              title="删除"
              @click="deleteSession(session.id, $event)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Debug Panel -->
      <div v-if="debugMode" class="debug-panel">
        <div class="debug-header">
          <span>调试日志</span>
          <div class="debug-actions">
            <button class="debug-inject-btn" @click="injectMockAIData">💉 注入测试数据</button>
            <button class="debug-clear-btn" @click="clearDebugLogs">清空</button>
            <button class="close-btn" @click="debugMode = false">&times;</button>
          </div>
        </div>
        <div class="debug-status">
          <div class="debug-status-item">
            <span class="debug-label">当前技能:</span>
            <span class="debug-value" :class="{ active: currentSkillName }">
              {{ currentSkillName || '无' }}
            </span>
          </div>
          <div class="debug-status-item">
            <span class="debug-label">当前工具:</span>
            <span class="debug-value" :class="{ active: currentToolName }">
              {{ currentToolName || '无' }}
            </span>
          </div>
          <div class="debug-status-item">
            <span class="debug-label">处理中:</span>
            <span class="debug-value" :class="{ active: isAgentProcessing }">
              {{ isAgentProcessing ? '是' : '否' }}
            </span>
          </div>
        </div>
        <div class="debug-logs">
          <div v-if="debugLogs.length === 0" class="debug-empty">
            暂无日志
          </div>
          <div
            v-for="(log, index) in debugLogs"
            :key="index"
            class="debug-log-item"
            :class="log.type"
          >
            <span class="debug-log-time">{{ log.timestamp }}</span>
            <span class="debug-log-type">{{ log.type }}</span>
            <pre class="debug-log-data">{{ log.data }}</pre>
          </div>
        </div>
      </div>

      <!-- Navigation Paused Banner -->
      <div v-if="navigationPaused" class="navigation-paused">
        <span>导航已暂停</span>
        <button @click="resumeNavigation">恢复</button>
      </div>

      <!-- Stall Warning Banner (Agent detected no progress) -->
      <div v-if="stallWarning" class="stall-warning">
        <span class="stall-icon">⚠️</span>
        <span class="stall-message">{{ stallWarning.message }}</span>
      </div>

      <!-- REMOVED: Todo panel, SubAgentProgress, GenerationProgress, AgentProgressContainer -->
      <!-- All progress now unified in chat flow via TaskCard (Manus UI style) -->
      <!-- SubAgentProgress, GenerationProgress, AgentProgressContainer removed per UX refactor -->

      <!-- Messages -->
      <div ref="messagesContainer" class="chatbot-messages">
        <div v-if="messages.length === 0" class="empty-state">
          <p>你好! 我是你的 AI 助手。</p>
          <p>试试说: "帮我创建一个5年级数学教案"</p>
        </div>

        <div
          v-for="(msg, index) in messages"
          :key="index"
          class="message"
          :class="msg.type"
        >
          <!-- User Message -->
          <template v-if="msg.type === 'user'">
            <div class="message-content user">
              {{ msg.content }}
            </div>
          </template>

          <!-- Agent Response -->
          <template v-else-if="msg.type === 'agent'">
            <!-- Reasoning history (above message content) -->
            <div v-if="msg.reasoningHistory?.length" class="reasoning-history">
              <div
                v-for="(item, idx) in msg.reasoningHistory"
                :key="idx"
                class="reasoning-step"
                :class="item.phase"
              >
                <span class="step-icon" v-html="getPhaseIcon(item.phase)"></span>
                <span class="step-text">{{ item.summary }}</span>
              </div>
            </div>
            <!-- Check if message contains selectable options -->
            <template v-if="getParsedOptions(msg)">
              <div class="message-content agent with-options">
                <!-- Text before options -->
                <div v-if="getParsedOptions(msg).textBefore" class="options-intro">
                  {{ getParsedOptions(msg).textBefore }}
                </div>

                <!-- Clickable option buttons -->
                <div class="option-buttons" :class="{ disabled: msg.optionSelected }">
                  <button
                    v-for="option in getParsedOptions(msg).options"
                    :key="option.value"
                    class="option-btn"
                    :class="{ selected: msg.optionSelected === option.value }"
                    :disabled="msg.optionSelected || isLoading"
                    @click="selectOption(option, index)"
                  >
                    <span class="option-number">{{ option.value }}</span>
                    <span class="option-label">{{ option.label }}</span>
                  </button>
                </div>

                <!-- Text after options -->
                <div v-if="getParsedOptions(msg).textAfter" class="options-footer">
                  {{ getParsedOptions(msg).textAfter }}
                </div>
              </div>
            </template>
            <!-- Regular text message (no options) - rendered as markdown -->
            <template v-else>
              <div class="message-content agent markdown-body">
                <MdPreview :modelValue="msg.content" />
              </div>
            </template>
          </template>

          <!-- Tool Calls - Manus UI Style TaskCard Display -->
          <template v-else-if="msg.type === 'tools'">
            <!-- Debug mode: show old expandable format -->
            <template v-if="debugMode">
              <div class="tool-calls debug-expanded">
                <template
                  v-for="(tool, toolIndex) in msg.toolCalls"
                  :key="toolIndex"
                >
                  <div
                    v-if="getToolDisplayName(tool.name)"
                    class="tool-call-wrapper"
                  >
                    <div
                      class="tool-call expandable"
                      :class="tool.status"
                      @click="expandedTools.has(`${index}-${toolIndex}`) ? expandedTools.delete(`${index}-${toolIndex}`) : expandedTools.add(`${index}-${toolIndex}`)"
                    >
                      <span class="tool-icon">{{ getToolStatusIcon(tool.status) }}</span>
                      <span class="tool-name">{{ getToolDisplayName(tool.name) }}</span>
                      <span v-if="tool.input && tool.input.path" class="tool-detail">{{ tool.input.path }}</span>
                      <span v-else-if="tool.input && tool.input.selector" class="tool-detail">{{ tool.input.selector }}</span>
                      <span v-else-if="tool.input && tool.input.fields" class="tool-detail">{{ Object.keys(tool.input.fields).length }} 个字段</span>
                      <span class="tool-expand-icon">
                        {{ expandedTools.has(`${index}-${toolIndex}`) ? '▼' : '▶' }}
                      </span>
                    </div>
                    <div v-if="expandedTools.has(`${index}-${toolIndex}`)" class="tool-details">
                      <div class="tool-detail-section">
                        <span class="tool-detail-label">Input:</span>
                        <pre class="tool-detail-json">{{ JSON.stringify(tool.input, null, 2) }}</pre>
                      </div>
                      <div class="tool-detail-section">
                        <span class="tool-detail-label">Output:</span>
                        <pre class="tool-detail-json">{{ tool.output || '(无输出)' }}</pre>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </template>

            <!-- Normal mode: Manus UI style with TaskCards -->
            <template v-else>
              <div class="manus-task-list">
                <TaskCard
                  v-for="task in getTasksForMessage(msg)"
                  :key="task.id"
                  :task="task"
                  @rollback="handleRunRollback"
                />
              </div>
            </template>
          </template>

          <!-- Error -->
          <template v-else-if="msg.type === 'error'">
            <div class="message-content error">
              {{ msg.content }}
            </div>
          </template>
          <!-- Streaming Response - rendered as markdown -->
          <template v-else-if="msg.type === 'streaming'">
            <div class="message-content agent streaming markdown-body">
              <MdPreview :modelValue="msg.content" />
              <span class="cursor-blink">|</span>
            </div>
          </template>
        </div>

        <!-- Real-time Progress Display (Manus UI Style - Unified in Chat Flow) -->
        <div v-if="isLoading || isAgentProcessing" class="message loading manus-loading">
          <!-- Reasoning/planning phase indicator (shown before tasks start) -->
          <ReasoningIndicator
            v-if="!realTimeTasksForLoading.length && reasoningPhase"
            :phase="reasoningPhase"
            :summary="reasoningSummary"
          />

          <!-- Manus Style: TaskCards for real-time progress -->
          <div v-if="realTimeTasksForLoading.length > 0" class="manus-task-list live-tasks">
            <TaskCard
              v-for="task in realTimeTasksForLoading"
              :key="task.id"
              :task="task"
              @rollback="handleRunRollback"
            />
          </div>

          <!-- Fallback: Thinking indicator (show when no tasks and no tool activity) -->
          <template v-else-if="!reasoningPhase">
            <!-- Skill execution indicator -->
            <template v-if="currentSkillName">
              <div class="status-indicator skill">
                <span class="status-icon">&#x2728;</span>
                <span>{{ currentSkillName }}</span>
              </div>
            </template>
            <!-- Thinking dots -->
            <template v-else>
              <div class="thinking-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span>思考中...</span>
            </template>
          </template>
        </div>

        <!-- Retry indicator -->
        <div v-if="retryInfo && retryInfo.count > 0" class="retry-indicator">
          <span v-if="!retryInfo.exhausted">
            重试中 {{ retryInfo.count }}/{{ retryInfo.maxRetries }}...
          </span>
          <div v-else class="retry-exhausted">
            <span>操作失败，已重试 {{ retryInfo.maxRetries }} 次</span>
            <button @click="handleRetry">重试</button>
            <button @click="handleAbort">取消</button>
          </div>
        </div>

        <!-- A2UI: Structured UI Components from Agent -->
        <div v-if="pendingUIComponent" class="a2ui-component">
          <!-- Pick List Component -->
          <template v-if="pendingUIComponent.type === 'pick_list'">
            <div class="a2ui-pick-list">
              <div class="a2ui-title">{{ pendingUIComponent.title }}</div>
              <div v-if="pendingUIComponent.description" class="a2ui-description">
                {{ pendingUIComponent.description }}
              </div>
              <div class="a2ui-options">
                <button
                  v-for="option in pendingUIComponent.options"
                  :key="option.id"
                  class="a2ui-option-btn"
                  :disabled="isLoading"
                  @click="selectA2UIOption(option, pendingUIComponent)"
                >
                  <span class="a2ui-option-label">{{ option.label }}</span>
                  <span v-if="option.meta" class="a2ui-option-meta">{{ option.meta }}</span>
                  <span v-if="option.description" class="a2ui-option-desc">{{ option.description }}</span>
                </button>
              </div>
            </div>
          </template>

          <!-- Button Group Component -->
          <template v-else-if="pendingUIComponent.type === 'button_group'">
            <div class="a2ui-button-group">
              <div v-if="pendingUIComponent.title" class="a2ui-title">{{ pendingUIComponent.title }}</div>
              <div class="a2ui-buttons" :class="pendingUIComponent.layout || 'vertical'">
                <button
                  v-for="btn in pendingUIComponent.buttons"
                  :key="btn.id"
                  class="a2ui-btn"
                  :disabled="isLoading"
                  @click="selectA2UIOption(btn, pendingUIComponent)"
                >
                  {{ btn.label }}
                </button>
              </div>
            </div>
          </template>

          <!-- Confirm Dialog Component -->
          <template v-else-if="pendingUIComponent.type === 'confirm'">
            <div class="a2ui-confirm">
              <div class="a2ui-title">{{ pendingUIComponent.title }}</div>
              <div class="a2ui-message">{{ pendingUIComponent.message }}</div>
              <div class="a2ui-confirm-actions">
                <button
                  class="a2ui-confirm-btn primary"
                  :disabled="isLoading"
                  @click="handleA2UIConfirm(true, pendingUIComponent)"
                >
                  {{ pendingUIComponent.confirmLabel || '确认' }}
                </button>
                <button
                  class="a2ui-confirm-btn secondary"
                  :disabled="isLoading"
                  @click="handleA2UIConfirm(false, pendingUIComponent)"
                >
                  {{ pendingUIComponent.cancelLabel || '取消' }}
                </button>
              </div>
            </div>
          </template>
        </div>

        <!-- Plan Proposal: Confirmation UI for AI generation plan -->
        <div v-if="pendingPlanProposal" class="plan-proposal">
          <div class="plan-proposal-card">
            <div class="plan-proposal-header">
              <div class="plan-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                </svg>
              </div>
              <h4 class="plan-title">AI 将为您生成以下内容</h4>
            </div>

            <div v-if="pendingPlanProposal.context" class="plan-context">
              <span v-if="pendingPlanProposal.context.subject" class="context-tag">
                {{ pendingPlanProposal.context.subject }}
              </span>
              <span v-if="pendingPlanProposal.context.gradeLevel" class="context-tag">
                {{ pendingPlanProposal.context.gradeLevel }}年级
              </span>
              <span v-if="pendingPlanProposal.context.chapterTitle" class="context-tag">
                {{ pendingPlanProposal.context.chapterTitle }}
              </span>
            </div>

            <ul class="plan-sections">
              <li
                v-for="section in pendingPlanProposal.sections"
                :key="section.id"
                class="plan-section-item"
              >
                <span class="section-icon">○</span>
                <div class="section-content">
                  <span class="section-label">{{ section.label }}</span>
                  <span v-if="section.reason" class="section-reason">{{ section.reason }}</span>
                </div>
              </li>
            </ul>

            <div class="plan-actions">
              <button
                class="plan-btn primary"
                :disabled="isLoading"
                @click="confirmPlanProposal"
              >
                开始生成
              </button>
              <button
                class="plan-btn secondary"
                :disabled="isLoading"
                @click="rejectPlanProposal"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Input -->
      <div class="chatbot-input">
        <textarea
          v-model="inputMessage"
          placeholder="输入消息..."
          :disabled="isLoading || !isConnected"
          @keydown="handleKeydown"
        ></textarea>
        <button
          :disabled="isLoading || !isConnected || !inputMessage.trim()"
          @click="sendMessage"
        >
          发送
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* =====================================================
   Color Scheme - CSS Custom Properties
   Clean, professional palette (Linear/Notion inspired)
   ===================================================== */
.chatbot-widget {
  /* Primary - Subtle blue */
  --chat-primary: #3b82f6;
  --chat-primary-hover: #2563eb;
  --chat-primary-light: rgba(59, 130, 246, 0.1);
  --chat-primary-shadow: rgba(59, 130, 246, 0.4);
  --chat-primary-shadow-hover: rgba(59, 130, 246, 0.5);

  /* Backgrounds */
  --chat-bg: #ffffff;
  --chat-header-bg: #3b82f6;
  --chat-user-msg-bg: #3b82f6;
  --chat-agent-msg-bg: #f5f5f5;

  /* Text */
  --chat-text: #1f2937;
  --chat-text-muted: #6b7280;
  --chat-text-inverse: #ffffff;

  /* Backgrounds - light variants */
  --chat-bg-hover: #f8fafc;
  --chat-bg-selected: #eff6ff;

  /* Borders */
  --chat-border: #e5e7eb;
  --chat-border-light: #f3f4f6;

  /* Status */
  --chat-success: #10b981;
  --chat-error: #ef4444;
  --chat-warning: #f59e0b;
}

.chatbot-widget {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* Embedded mode: fill parent container */
.chatbot-widget.embedded-mode {
  position: relative;
  bottom: auto;
  right: auto;
  width: 100%;
  height: 100%;
  z-index: auto;
}

.chatbot-widget.embedded-mode .chatbot-panel {
  position: relative;
  bottom: auto;
  right: auto;
  width: 100%;
  height: 100%;
  border-radius: 0;
  box-shadow: none;
}

.close-panel-btn {
  margin-left: 4px;
}

.chatbot-toggle {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: var(--chat-primary);
  color: white;
  font-size: 20px;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 4px 16px var(--chat-primary-shadow);
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chatbot-toggle:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px var(--chat-primary-shadow-hover);
}

.chatbot-toggle.open {
  background: var(--chat-primary);
}

.chatbot-toggle.connected::after {
  content: '';
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #52c41a;
  border: 2px solid white;
}

.chatbot-panel {
  position: absolute;
  bottom: 72px;
  right: 0;
  width: 540px;
  height: 680px;
  max-width: calc(100vw - 48px);
  background: white;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chatbot-header {
  padding: 12px 16px;
  background: var(--chat-primary);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chatbot-header .title {
  font-size: 16px;
  font-weight: 600;
}

.chatbot-header .status {
  font-size: 11px;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
}

.chatbot-header .status.connected {
  background: rgba(82, 196, 26, 0.3);
}

.chatbot-header .status:not(.connected) {
  background: rgba(250, 173, 20, 0.3);
}

.session-id {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  font-family: monospace;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.session-id:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.25);
}

.header-actions {
  display: flex;
  gap: 4px;
}

.header-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.header-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

/* History Panel */
.history-panel {
  position: absolute;
  top: 52px;
  left: 0;
  right: 0;
  bottom: 0;
  background: white;
  z-index: 10;
  display: flex;
  flex-direction: column;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  font-weight: 500;
  color: #262626;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #8c8c8c;
  cursor: pointer;
  line-height: 1;
}

.close-btn:hover {
  color: #262626;
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.history-empty {
  text-align: center;
  color: #8c8c8c;
  padding: 40px 20px;
  font-size: 14px;
}

.history-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  margin-bottom: 4px;
}

.history-item:hover {
  background: #f5f5f5;
}

.history-item.active {
  background: #e6f4ff;
}

.history-item-content {
  flex: 1;
  min-width: 0;
}

.history-title {
  font-size: 14px;
  color: #262626;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.history-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: #8c8c8c;
}

.history-delete {
  padding: 4px;
  background: none;
  border: none;
  color: #bfbfbf;
  cursor: pointer;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.2s, color 0.2s;
}

.history-item:hover .history-delete {
  opacity: 1;
}

.history-delete:hover {
  color: #ff4d4f;
  background: #fff1f0;
}

.navigation-paused {
  padding: 8px 16px;
  background: #fff7e6;
  border-bottom: 1px solid #ffd591;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #d48806;
}

.navigation-paused button {
  padding: 4px 12px;
  background: #fa8c16;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.chatbot-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-state {
  text-align: center;
  color: #8c8c8c;
  padding: 40px 20px;
  font-size: 14px;
}

.empty-state p {
  margin: 8px 0;
}

.message-content {
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}

.message-content.user {
  background: var(--chat-primary);
  color: white;
  margin-left: auto;
  border-bottom-right-radius: 4px;
}

.message-content.agent {
  background: var(--chat-agent-msg-bg);
  color: var(--chat-text);
  margin-right: auto;
  border-bottom-left-radius: 4px;
}

/* Markdown content styling within agent messages */
.message-content.agent.markdown-body {
  padding: 0;
}

.message-content.agent.markdown-body :deep(.md-editor-preview-wrapper) {
  padding: 12px 14px;
}

.message-content.agent.markdown-body :deep(.md-editor-preview) {
  font-size: 14px;
  line-height: 1.6;
  color: var(--chat-text);
  background: transparent;
}

/* Markdown headings */
.message-content.agent.markdown-body :deep(h1),
.message-content.agent.markdown-body :deep(h2),
.message-content.agent.markdown-body :deep(h3),
.message-content.agent.markdown-body :deep(h4) {
  margin-top: 12px;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--chat-text);
}

.message-content.agent.markdown-body :deep(h1:first-child),
.message-content.agent.markdown-body :deep(h2:first-child),
.message-content.agent.markdown-body :deep(h3:first-child) {
  margin-top: 0;
}

.message-content.agent.markdown-body :deep(h1) { font-size: 1.25em; }
.message-content.agent.markdown-body :deep(h2) { font-size: 1.15em; }
.message-content.agent.markdown-body :deep(h3) { font-size: 1.05em; }

/* Markdown lists */
.message-content.agent.markdown-body :deep(ul),
.message-content.agent.markdown-body :deep(ol) {
  margin: 8px 0;
  padding-left: 20px;
}

.message-content.agent.markdown-body :deep(li) {
  margin: 4px 0;
}

/* Markdown paragraphs */
.message-content.agent.markdown-body :deep(p) {
  margin: 8px 0;
}

.message-content.agent.markdown-body :deep(p:first-child) {
  margin-top: 0;
}

.message-content.agent.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

/* Markdown code */
.message-content.agent.markdown-body :deep(code) {
  background: rgba(0, 0, 0, 0.06);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
}

.message-content.agent.markdown-body :deep(pre) {
  background: #1e1e1e;
  border-radius: 8px;
  padding: 12px;
  margin: 8px 0;
  overflow-x: auto;
}

.message-content.agent.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
  color: #d4d4d4;
}

/* Markdown strong/emphasis */
.message-content.agent.markdown-body :deep(strong) {
  font-weight: 600;
}

/* Markdown blockquote */
.message-content.agent.markdown-body :deep(blockquote) {
  border-left: 3px solid var(--chat-primary);
  margin: 8px 0;
  padding-left: 12px;
  color: var(--chat-text-muted);
}

/* Markdown tables */
.message-content.agent.markdown-body :deep(table) {
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 13px;
}

.message-content.agent.markdown-body :deep(th),
.message-content.agent.markdown-body :deep(td) {
  border: 1px solid var(--chat-border);
  padding: 6px 10px;
}

.message-content.agent.markdown-body :deep(th) {
  background: var(--chat-bg-hover);
  font-weight: 600;
}

.message-content.agent.with-options {
  max-width: 95%;
}

.options-intro {
  margin-bottom: 12px;
  line-height: 1.5;
}

.options-footer {
  margin-top: 12px;
  font-size: 13px;
  color: #8c8c8c;
}

.option-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-buttons.disabled {
  opacity: 0.7;
}

.option-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: white;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  font-size: 14px;
  transition: all 0.2s ease;
}

.option-btn:hover:not(:disabled) {
  border-color: var(--chat-primary);
  background: var(--chat-bg-selected);
}

.option-btn:disabled {
  cursor: default;
}

.option-btn.selected {
  border-color: var(--chat-primary);
  background: var(--chat-primary);
  color: white;
}

.option-btn.selected .option-number {
  background: rgba(255, 255, 255, 0.3);
  color: white;
}

.option-number {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  background: #e6f4ff;
  color: #1890ff;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
}

.option-label {
  flex: 1;
  line-height: 1.4;
}

.message-content.error {
  background: #fff2f0;
  color: #ff4d4f;
  margin-right: auto;
  border: 1px solid #ffccc7;
}

.tool-calls {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 85%;
}

.tool-call {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--chat-bg-selected);
  border-radius: 8px;
  font-size: 13px;
  color: #1d39c4;
}

.tool-call.success {
  background: #f6ffed;
  color: #389e0d;
}

.tool-call.error {
  background: #fff2f0;
  color: #cf1322;
}

.tool-icon {
  font-size: 12px;
  font-weight: bold;
}

.tool-name {
  font-weight: 500;
}

.tool-detail {
  color: #8c8c8c;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 150px;
}

.message.loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #8c8c8c;
  font-size: 13px;
}

.thinking-indicator {
  display: flex;
  gap: 4px;
}

.thinking-indicator span {
  width: 8px;
  height: 8px;
  background: var(--chat-primary);
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.thinking-indicator span:nth-child(1) {
  animation-delay: -0.32s;
}

.thinking-indicator span:nth-child(2) {
  animation-delay: -0.16s;
}

/* Inline Tool Activities (Claude Code style) */
.inline-tool-activities {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 0;
  width: 100%;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.chatbot-input {
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  gap: 8px;
}

.chatbot-input textarea {
  flex: 1;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  resize: none;
  height: 40px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}

.chatbot-input textarea:focus {
  border-color: var(--chat-primary);
}

.chatbot-input textarea:disabled {
  background: #f5f5f5;
}

.chatbot-input button {
  padding: 0 20px;
  background: var(--chat-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.chatbot-input button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chatbot-input button:not(:disabled):hover {
  opacity: 0.9;
}

/* Streaming text with cursor */
.message-content.streaming {
  background: var(--chat-agent-msg-bg);
  color: var(--chat-text);
  margin-right: auto;
  border-bottom-left-radius: 4px;
}

.cursor-blink {
  display: inline;
  color: var(--chat-primary);
  font-weight: bold;
  animation: blink 1s step-end infinite;
}

/* Ensure cursor appears inline after markdown content */
.message-content.streaming.markdown-body {
  display: flex;
  flex-direction: column;
}

.message-content.streaming.markdown-body .cursor-blink {
  margin-left: 14px;
  margin-bottom: 12px;
}

@keyframes blink {
  from, to {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

/* Status indicators */
.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
}

.status-indicator.tool {
  background: #e6f7ff;
  color: #1890ff;
}

.status-indicator.skill {
  background: #f6ffed;
  color: #52c41a;
}

.status-icon {
  font-size: 16px;
}

.status-text {
  flex: 1;
}

.agent-badge {
  padding: 2px 8px;
  background: var(--chat-primary-light);
  color: var(--chat-primary);
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.tool-duration {
  font-size: 11px;
  color: #8c8c8c;
  font-family: monospace;
}

/* Retry indicator */
.retry-indicator {
  padding: 8px 12px;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 8px;
  font-size: 13px;
  color: #d48806;
}

.retry-exhausted {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.retry-exhausted button {
  padding: 6px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.retry-exhausted button:first-of-type {
  background: #fa8c16;
  color: white;
}

.retry-exhausted button:last-of-type {
  background: #f0f0f0;
  color: #595959;
}

/* Stall Warning Styles */
.stall-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: #fffbe6;
  border-bottom: 1px solid #ffe58f;
  font-size: 13px;
  color: #d48806;
}

.stall-icon {
  font-size: 14px;
}

.stall-message {
  flex: 1;
  line-height: 1.4;
}

/* A2UI Component Styles */
.a2ui-component {
  margin-top: 12px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #e8e8e8;
}

.a2ui-title {
  font-size: 15px;
  font-weight: 600;
  color: #262626;
  margin-bottom: 8px;
}

.a2ui-description {
  font-size: 13px;
  color: #8c8c8c;
  margin-bottom: 12px;
  line-height: 1.4;
}

.a2ui-message {
  font-size: 14px;
  color: #595959;
  margin-bottom: 16px;
  line-height: 1.5;
}

/* A2UI Pick List */
.a2ui-pick-list {
  display: flex;
  flex-direction: column;
}

.a2ui-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 280px;
  overflow-y: auto;
}

.a2ui-option-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px 16px;
  background: white;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
}

.a2ui-option-btn:hover:not(:disabled) {
  border-color: var(--chat-primary);
  background: var(--chat-bg-selected);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px var(--chat-primary-light);
}

.a2ui-option-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.a2ui-option-label {
  font-size: 14px;
  font-weight: 500;
  color: #262626;
}

.a2ui-option-meta {
  font-size: 12px;
  color: #8c8c8c;
}

.a2ui-option-desc {
  font-size: 12px;
  color: #595959;
  line-height: 1.4;
}

/* A2UI Button Group */
.a2ui-button-group {
  display: flex;
  flex-direction: column;
}

.a2ui-buttons {
  display: flex;
  gap: 8px;
}

.a2ui-buttons.horizontal {
  flex-direction: row;
  flex-wrap: wrap;
}

.a2ui-buttons.vertical {
  flex-direction: column;
}

.a2ui-btn {
  padding: 10px 20px;
  background: white;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #262626;
  cursor: pointer;
  transition: all 0.2s ease;
}

.a2ui-btn:hover:not(:disabled) {
  border-color: var(--chat-primary);
  color: var(--chat-primary);
  background: var(--chat-bg-selected);
}

.a2ui-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* A2UI Confirm Dialog */
.a2ui-confirm {
  display: flex;
  flex-direction: column;
}

.a2ui-confirm-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.a2ui-confirm-btn {
  flex: 1;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.a2ui-confirm-btn.primary {
  background: var(--chat-primary);
  border: none;
  color: white;
}

.a2ui-confirm-btn.primary:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--chat-primary-shadow);
}

.a2ui-confirm-btn.secondary {
  background: white;
  border: 1px solid #d9d9d9;
  color: #595959;
}

.a2ui-confirm-btn.secondary:hover:not(:disabled) {
  border-color: #8c8c8c;
  background: #fafafa;
}

.a2ui-confirm-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* Plan Proposal Styles */
.plan-proposal {
  padding: 12px 16px;
}

.plan-proposal-card {
  background: linear-gradient(145deg, var(--chat-bg-selected) 0%, var(--chat-bg) 100%);
  border: 1px solid #d6e4ff;
  border-radius: 12px;
  padding: 16px;
}

.plan-proposal-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.plan-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--chat-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.plan-title {
  font-size: 15px;
  font-weight: 600;
  color: #262626;
  margin: 0;
}

.plan-context {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.context-tag {
  font-size: 12px;
  color: var(--chat-primary);
  background: var(--chat-bg-selected);
  padding: 4px 10px;
  border-radius: 12px;
}

.plan-sections {
  list-style: none;
  margin: 0 0 16px 0;
  padding: 0;
}

.plan-section-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.plan-section-item:last-child {
  border-bottom: none;
}

.section-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--chat-primary);
  font-size: 10px;
  flex-shrink: 0;
  margin-top: 2px;
}

.section-content {
  flex: 1;
  min-width: 0;
}

.section-label {
  display: block;
  font-size: 14px;
  color: #262626;
  font-weight: 500;
}

.section-reason {
  display: block;
  font-size: 12px;
  color: #8c8c8c;
  margin-top: 2px;
}

.plan-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.plan-btn {
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.plan-btn.primary {
  background: var(--chat-primary);
  color: white;
}

.plan-btn.primary:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.plan-btn.secondary {
  background: #f5f5f5;
  color: #595959;
}

.plan-btn.secondary:hover:not(:disabled) {
  background: #e8e8e8;
}

.plan-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* Todo Panel Styles */
.todo-panel {
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e8e8e8;
}

.todo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.todo-title {
  font-size: 13px;
  font-weight: 600;
  color: #262626;
}

.todo-progress {
  font-size: 12px;
  color: var(--chat-primary);
  font-weight: 500;
  padding: 2px 8px;
  background: var(--chat-bg-selected);
  border-radius: 10px;
}

.todo-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: white;
  border-radius: 6px;
  font-size: 13px;
  transition: all 0.2s;
}

.todo-item.completed {
  color: #52c41a;
  background: #f6ffed;
}

.todo-item.in_progress {
  color: #1890ff;
  background: #e6f7ff;
}

.todo-item.pending {
  color: #8c8c8c;
}

.todo-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
}

.todo-item.completed .todo-icon {
  color: #52c41a;
}

.todo-item.in_progress .todo-icon {
  color: #1890ff;
}

.todo-content {
  flex: 1;
  line-height: 1.4;
}

/* Spinner animation for in_progress */
.todo-item .spinner {
  width: 12px;
  height: 12px;
  border: 2px solid #e6f7ff;
  border-top-color: #1890ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Todo item with substeps indicator */
.todo-item.has-substeps {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  margin-bottom: 0;
}

/* Sub-steps container */
.todo-substeps {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: 20px;
  padding: 4px 0 4px 12px;
  border-left: 2px solid #91d5ff;
  background: #f0f9ff;
  border-radius: 0 0 6px 6px;
  margin-bottom: 6px;
}

/* Individual sub-step */
.todo-substep {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  font-size: 12px;
  color: #595959;
  transition: all 0.2s;
}

.todo-substep.completed {
  color: #52c41a;
}

.todo-substep.in_progress {
  color: #1890ff;
  font-weight: 500;
}

.todo-substep.pending {
  color: #8c8c8c;
}

/* Sub-step icon */
.substep-icon {
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
}

.todo-substep.completed .substep-icon {
  color: #52c41a;
}

.todo-substep.in_progress .substep-icon {
  color: #1890ff;
}

/* Small spinner for sub-steps */
.spinner-small {
  width: 10px;
  height: 10px;
  border: 1.5px solid #e6f7ff;
  border-top-color: #1890ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.substep-label {
  flex: 1;
  line-height: 1.3;
}

/* Debug Mode Styles */
.header-btn.active {
  background: rgba(255, 255, 255, 0.35);
  color: #52c41a;
}

/* Debug Panel */
.debug-panel {
  position: absolute;
  top: 52px;
  left: 0;
  right: 0;
  bottom: 0;
  background: #1a1a1a;
  z-index: 10;
  display: flex;
  flex-direction: column;
  color: #e0e0e0;
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid #333;
  font-weight: 500;
  font-size: 14px;
}

.debug-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.debug-inject-btn {
  padding: 4px 10px;
  background: #1890ff;
  border: none;
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  font-weight: 500;
}

.debug-inject-btn:hover {
  background: #40a9ff;
}

.debug-clear-btn {
  padding: 4px 10px;
  background: #333;
  border: none;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 12px;
  cursor: pointer;
}

.debug-clear-btn:hover {
  background: #444;
}

.debug-panel .close-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: #8c8c8c;
  cursor: pointer;
  line-height: 1;
}

.debug-panel .close-btn:hover {
  color: #e0e0e0;
}

.debug-status {
  padding: 10px 16px;
  background: #222;
  border-bottom: 1px solid #333;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.debug-status-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.debug-label {
  color: #8c8c8c;
}

.debug-value {
  color: #666;
  font-family: monospace;
}

.debug-value.active {
  color: #52c41a;
  font-weight: 500;
}

.debug-logs {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  font-family: monospace;
  font-size: 11px;
}

.debug-empty {
  text-align: center;
  color: #666;
  padding: 20px;
}

.debug-log-item {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 8px;
  margin-bottom: 4px;
  background: #222;
  border-radius: 4px;
  border-left: 3px solid #444;
}

.debug-log-item.thinking { border-left-color: #faad14; }
.debug-log-item.tool_start { border-left-color: #1890ff; }
.debug-log-item.tool_end { border-left-color: #52c41a; }
.debug-log-item.skill_start { border-left-color: #722ed1; }
.debug-log-item.skill_end { border-left-color: #eb2f96; }
.debug-log-item.request { border-left-color: #13c2c2; }
.debug-log-item.response { border-left-color: #2f54eb; }
.debug-log-item.error { border-left-color: #ff4d4f; }

.debug-log-time {
  color: #666;
}

.debug-log-type {
  color: #1890ff;
  font-weight: 500;
  min-width: 80px;
}

.debug-log-data {
  width: 100%;
  margin: 4px 0 0;
  padding: 6px 8px;
  background: #1a1a1a;
  border-radius: 3px;
  white-space: pre-wrap;
  word-break: break-all;
  color: #b0b0b0;
  max-height: 150px;
  overflow-y: auto;
}

/* Tool Call Wrapper */
.tool-call-wrapper {
  display: flex;
  flex-direction: column;
}

.tool-call.expandable {
  cursor: pointer;
}

.tool-call.expandable:hover {
  background: #e0e7ff;
}

.tool-expand-icon {
  font-size: 10px;
  color: #8c8c8c;
  margin-left: auto;
}

/* Tool Details (Expanded) */
.tool-details {
  background: #f8f9fa;
  border: 1px solid #e8e8e8;
  border-top: none;
  border-radius: 0 0 8px 8px;
  padding: 10px;
  margin-top: -4px;
  font-size: 12px;
}

.tool-detail-section {
  margin-bottom: 8px;
}

.tool-detail-section:last-child {
  margin-bottom: 0;
}

.tool-detail-label {
  display: block;
  font-weight: 600;
  color: #595959;
  margin-bottom: 4px;
}

.tool-detail-json {
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  padding: 8px;
  margin: 0;
  font-family: monospace;
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 150px;
  overflow-y: auto;
  color: #262626;
}

/* Tool calls in debug mode */
.tool-calls.debug-expanded {
  max-width: 100%;
}

.tool-calls.debug-expanded .tool-call {
  transition: background 0.2s;
}

/* Reasoning History Styles (in message bubble) */
.reasoning-history {
  padding: 8px 12px;
  margin-bottom: 8px;
  background: #f8f9ff;
  border-radius: 6px;
  border-left: 3px solid var(--chat-primary);
  max-width: 85%;
}

.reasoning-step {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #595959;
  padding: 2px 0;
}

.reasoning-step .step-icon {
  width: 16px;
  text-align: center;
  font-size: 12px;
}

.reasoning-step .step-text {
  flex: 1;
  line-height: 1.4;
}

.reasoning-step.analyzing { color: #1890ff; }
.reasoning-step.planning { color: #722ed1; }
.reasoning-step.executing { color: #fa8c16; }
.reasoning-step.reviewing { color: #52c41a; }

/* =============================================================================
 * Manus UI Style - Task List
 * ============================================================================= */

.manus-task-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: 100%;
  width: 100%;
}

/* Override TaskCard width constraints in chat context */
.manus-task-list :deep(.task-card) {
  margin: 4px 0;
}

/* First task card in a message */
.manus-task-list :deep(.task-card:first-child) {
  margin-top: 0;
}

/* Connected task cards (remove gap between completed tasks) */
.manus-task-list :deep(.task-card.completed + .task-card) {
  margin-top: 0;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

/* Agent intro text before tasks */
.agent-intro {
  font-size: 14px;
  color: #595959;
  line-height: 1.5;
  padding: 12px 14px;
  background: #fafafa;
  border-radius: 8px;
  margin-bottom: 8px;
}

/* Manus style: thin left border for agent responses */
.message.agent .manus-task-list {
  border-left: 2px solid #e8e8e8;
  padding-left: 12px;
  margin-left: 4px;
}

/* =============================================================================
 * Manus UI Style - Real-time Loading State
 * ============================================================================= */

.message.loading.manus-loading {
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 14px;
  background: #fafafa;
  border-radius: 12px;
  border-left: 3px solid #1890ff;
}

/* Live tasks in loading state - full width with no extra padding */
.message.loading.manus-loading .manus-task-list.live-tasks {
  width: 100%;
  margin: 0 -14px;
  padding: 0 14px;
}

.message.loading.manus-loading .manus-task-list.live-tasks :deep(.task-card) {
  background: transparent;
  border-left: none;
  margin: 0;
}

.message.loading.manus-loading .manus-task-list.live-tasks :deep(.task-header) {
  padding: 8px 0;
}

.message.loading.manus-loading .manus-task-list.live-tasks :deep(.task-body) {
  padding: 0 0 8px 0;
}

/* Manus inline activities container */
.manus-inline-activities {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  padding-left: 4px;
  border-left: 2px solid #91d5ff;
  margin-left: 2px;
}

/* Individual activity row */
.manus-activity-row {
  display: flex;
  align-items: center;
}

/* Override pill styles in loading context */
.manus-loading :deep(.tool-pill) {
  background: transparent;
  padding-left: 8px;
}

.manus-loading :deep(.tool-pill.running) {
  background: transparent;
}

.manus-loading :deep(.tool-pill.completed) {
  background: transparent;
  opacity: 0.7;
}

/* Mobile responsive: floating panel adapts to screen */
@media (max-width: 640px) {
  .chatbot-widget:not(.embedded-mode) .chatbot-panel {
    width: calc(100vw - 48px);
    height: calc(100vh - 100px);
  }
}
</style>
