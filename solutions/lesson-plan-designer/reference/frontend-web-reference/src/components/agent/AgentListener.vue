<script setup>
/**
 * AgentListener - Invisible component that listens for agent commands via Socket.io
 *
 * This component connects to the agentic backend and executes UI commands
 * from the Claude agent in real-time.
 */
import { ref, onMounted, onUnmounted, provide, watch, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { io } from 'socket.io-client'
import {
  discoverFormElements,
  getDOMElementByFieldId,
  getWidgetDefinition,
  onFormSubmit,
} from '@/agent'
import { formStateSynchronizer } from '@/agent/form-state-synchronizer'
import { useAuthStore } from '@/stores/core/authStore'
import { useLessonPlanStore } from '@/stores/domain/lessonPlanStore'
import {
  mapFieldsToFrontend,
  safeValidateOutputUpdateEvent,
} from '@kedge/lesson-plan-protocol'

// =============================================================================
// Agent Form Bridge
// =============================================================================
// Note: Types are defined in @/types/agent-form.ts
// AgentFormHandlers interface has: applyFormData, getFormState, submit, getDataShape?, readonly?

// Socket.io connection
const socket = ref(null)
const clientId = ref('')
const sessionId = ref('')  // Agent session ID for SSE renderer
const isConnected = ref(false)

// Agent backend authentication status
const agentAuthReady = ref(false)

// Navigation control
const navigationPaused = ref(false)
const lastAgentPath = ref('')

// Real-time agent status
const agentStatus = ref(null)
const isAgentProcessing = ref(false)
const currentToolName = ref('')
const currentSkillName = ref('')
const currentAgentType = ref('')  // Sub-agent type for tool hooks (e.g., 'lesson-plan-designer')
const currentToolDuration = ref(0)  // Tool execution duration in ms
const currentToolInput = ref(null)  // Tool input parameters (sanitized)
const retryInfo = ref({ count: 0, maxRetries: 10, exhausted: false })
const streamingText = ref('')
const stallWarning = ref(null) // Stall detection warning from agent

// A2UI: Pending UI component waiting for user interaction
const pendingUIComponent = ref(null)

// Todo items from agent
const todoItems = ref([])
const todoStats = ref({ completed: 0, inProgress: 0, pending: 0, total: 0 })

// AI Output generation progress (from sub-agent write_output)
const aiOutputGenerating = ref(false)
const aiOutputProgress = ref({
  totalSteps: 0,
  completedSteps: 0,
  currentStep: '',
  percentage: 0
})

// Sub-agent todo progress (separate from main agent todos)
const subagentTodos = ref([])  // Array of { content, status, activeForm? }
const subagentProgress = ref({
  agentType: '',
  completed: 0,
  inProgress: 0,
  pending: 0,
  total: 0
})

// Plan mode: Proposal waiting for user confirmation
// @see @/types/agent-message.ts for PlanProposal interface
const pendingPlanProposal = ref(null)  // PlanProposal | null

// Reasoning/planning phase display (shows agent's thinking process)
// Phase values: 'analyzing' | 'planning' | 'executing' | 'reviewing' | ''
const reasoningPhase = ref('')
const reasoningSummary = ref('')
// Reasoning history: accumulated phases for current request (saved to each message)
const reasoningHistory = ref([])

// Tool activity: Real-time description of what the sub-agent tool is doing
// Updated via 'tool_activity' WebSocket event from backend
const currentToolActivity = ref({
  toolName: '',
  toolId: '',
  phase: '', // 'start' | 'end' | ''
  description: '',
  agentType: '',
  duration: 0,
  success: null,
  timestamp: ''
})
// History of recent tool activities for display
const toolActivityHistory = ref([])

// Decision logic: Explains WHY the AI is making each step
// Updated from tool_activity events with decisionLogic field
const currentDecisionLogic = ref({
  why: '',      // Why this step is being performed
  benefit: '',  // What benefit this provides
  nextStep: ''  // Preview of what comes next
})

// Goal narrative: Human-readable summary of what the AI is trying to accomplish
// Derived from session context (lesson plan subject, grade, chapter)
const goalNarrative = ref({
  title: '',       // e.g., "正在为您设计教案"
  subject: '',     // e.g., "五年级数学"
  chapter: '',     // e.g., "分数的意义和性质"
  edition: ''      // e.g., "人教版"
})

// Session progress metrics (from sub-agent tool_activity events)
const sessionStartedAt = ref(null)  // ISO string from backend
const elapsedSeconds = ref(0)       // Updated every second
const tokenUsage = ref({ input: 0, output: 0, total: 0 })
let elapsedInterval = null          // setInterval handle for elapsed timer

// Run tracking (from output_update events)
const currentRunSeq = ref(undefined)    // Current run sequence number (1-based)
const totalAgentRuns = ref(undefined)   // Total runs for this agent type
const runHistory = ref([])              // Array of RunMetadata for history display

// Session tracking: whether a message has been sent in this browser session
// Used to detect "new session" (page refresh = first message should start fresh)
const hasMessageSentInSession = ref(false)

// Selection mode: 'none' | 'page' | 'chatbox'
const selectionMode = ref('none')

// Field watchers - store MutationObservers for cleanup
const fieldWatchers = ref(new Map())

// Form submit subscription - for cleanup
let formSubmitUnsubscribe = null

// =============================================================================
// Agent Form Bridge Registry
// =============================================================================
/** @type {Map<string, import('@/types').AgentFormHandlers>} */
const formRegistry = new Map()
/** @type {import('vue').Ref<import('@/types').PendingFormCommand[]>} */
const pendingFormCommands = ref([])
const FORM_COMMAND_TIMEOUT = 3000 // 3 seconds

const router = useRouter()

// Provide clientId and sessionId for ChatbotWidget and SSE renderer
provide('agentClientId', clientId)
provide('agentSessionId', sessionId)  // For SSE renderer
provide('agentConnected', isConnected)
provide('navigationPaused', navigationPaused)
provide('resumeNavigation', resumeNavigation)

// Provide real-time status for ChatbotWidget
provide('agentStatus', agentStatus)
provide('isAgentProcessing', isAgentProcessing)
provide('currentToolName', currentToolName)
provide('currentSkillName', currentSkillName)
provide('currentAgentType', currentAgentType)
provide('currentToolDuration', currentToolDuration)
provide('currentToolInput', currentToolInput)
provide('retryInfo', retryInfo)
provide('streamingText', streamingText)
provide('stallWarning', stallWarning)

// A2UI: Provide pending UI component and interaction handler
provide('pendingUIComponent', pendingUIComponent)
provide('handleUIInteraction', handleUIInteraction)

// Provide todo items
provide('todoItems', todoItems)
provide('todoStats', todoStats)

// Provide sub-agent todo progress
provide('subagentTodos', subagentTodos)
provide('subagentProgress', subagentProgress)

// Provide reasoning phase display
provide('reasoningPhase', reasoningPhase)
provide('reasoningSummary', reasoningSummary)
provide('reasoningHistory', reasoningHistory)

// Provide AI output progress for LessonPlanDetailView
provide('aiOutputGenerating', aiOutputGenerating)
provide('aiOutputProgress', aiOutputProgress)

// Provide tool activity for progress display
provide('currentToolActivity', currentToolActivity)
provide('toolActivityHistory', toolActivityHistory)

// Provide decision logic (WHY the AI is making each step)
provide('currentDecisionLogic', currentDecisionLogic)

// Provide goal narrative (what the AI is trying to accomplish)
provide('goalNarrative', goalNarrative)

// Provide plan proposal state and handlers
provide('pendingPlanProposal', pendingPlanProposal)
provide('confirmPlanProposal', confirmPlanProposal)
provide('rejectPlanProposal', rejectPlanProposal)

// Provide session progress metrics
provide('sessionStartedAt', sessionStartedAt)
provide('elapsedSeconds', elapsedSeconds)
provide('tokenUsage', tokenUsage)

// Provide run tracking (for history/rollback)
provide('currentRunSeq', currentRunSeq)
provide('totalAgentRuns', totalAgentRuns)
provide('runHistory', runHistory)

// Provide session tracking for startNewSession detection
provide('hasMessageSentInSession', hasMessageSentInSession)
provide('markMessageSent', () => { hasMessageSentInSession.value = true })

// Provide selection mode
provide('selectionMode', selectionMode)

// Provide agent auth status
provide('agentAuthReady', agentAuthReady)

// Provide function to reset processing state (called after HTTP response)
provide('resetAgentProcessing', () => {
  console.log('[AgentListener] resetAgentProcessing called - clearing all processing state')
  isAgentProcessing.value = false
  currentToolName.value = ''
  currentSkillName.value = ''
  // Also clear reasoning display (fixes stuck "分析中..." issue)
  reasoningPhase.value = ''
  reasoningSummary.value = ''
  // Clear AI output generation state
  aiOutputGenerating.value = false
  // Bug Fix 2: Clear elapsed timer when resetting processing state
  if (elapsedInterval) {
    console.log('[AgentListener] Clearing elapsed timer in resetAgentProcessing')
    clearInterval(elapsedInterval)
    elapsedInterval = null
  }
})

// Provide FormStateSynchronizer for form components
provide('formStateSynchronizer', formStateSynchronizer)

// Bug Fix 2: Watch isAgentProcessing to ensure timer is cleared when processing stops
// This is a safety net in case the 'complete' event is missed or processing stops unexpectedly
watch(isAgentProcessing, (newVal, oldVal) => {
  if (!newVal && oldVal && elapsedInterval) {
    console.log('[AgentListener] isAgentProcessing changed to false, clearing elapsed timer')
    clearInterval(elapsedInterval)
    elapsedInterval = null
  }
})

/**
 * Handle plan proposal from agent
 * Agent sends this when it's ready to show user what sections will be generated
 */
function handlePlanProposal(proposal) {
  console.log('[AgentListener] Plan proposal received:', proposal)
  pendingPlanProposal.value = proposal

  // Stop showing "thinking" state - we're waiting for user input now
  isAgentProcessing.value = false
  currentToolName.value = ''
  reasoningPhase.value = 'planning'
  reasoningSummary.value = '等待确认生成计划...'
}

/**
 * Confirm plan proposal - tell agent to proceed
 */
function confirmPlanProposal() {
  if (!pendingPlanProposal.value || !socket.value || !isConnected.value) {
    console.error('[AgentListener] Cannot confirm plan: no pending proposal or not connected')
    return
  }

  const proposal = pendingPlanProposal.value
  console.log('[AgentListener] Confirming plan proposal:', proposal.traceId)

  // Emit confirmation to backend
  socket.value.emit('plan_confirmed', {
    traceId: proposal.traceId,
    sections: proposal.sections.map(s => s.id),
  })

  // Start AI editing mode for the planned sections
  const lessonPlanStore = useLessonPlanStore()
  lessonPlanStore.startAIEditing(proposal.sections.map(s => s.id))

  // Clear pending proposal and resume processing state
  pendingPlanProposal.value = null
  isAgentProcessing.value = true
  reasoningPhase.value = 'executing'
  reasoningSummary.value = '正在生成教案...'
}

/**
 * Reject plan proposal - cancel generation
 */
function rejectPlanProposal() {
  if (!pendingPlanProposal.value || !socket.value || !isConnected.value) {
    console.error('[AgentListener] Cannot reject plan: no pending proposal or not connected')
    return
  }

  const proposal = pendingPlanProposal.value
  console.log('[AgentListener] Rejecting plan proposal:', proposal.traceId)

  // Emit rejection to backend
  socket.value.emit('plan_rejected', {
    traceId: proposal.traceId,
  })

  // Clear pending proposal and processing state
  pendingPlanProposal.value = null
  isAgentProcessing.value = false
  reasoningPhase.value = ''
  reasoningSummary.value = ''
}

/**
 * Clear agent state (called when starting a new session)
 */
function clearAgentState() {
  console.log('[AgentListener] Clearing agent state for new session')
  pendingUIComponent.value = null
  pendingPlanProposal.value = null
  todoItems.value = []
  todoStats.value = { completed: 0, inProgress: 0, pending: 0, total: 0 }
  // Clear sub-agent progress
  subagentTodos.value = []
  subagentProgress.value = { agentType: '', completed: 0, inProgress: 0, pending: 0, total: 0 }
  // Clear reasoning display
  reasoningPhase.value = ''
  reasoningSummary.value = ''
  stallWarning.value = null
  streamingText.value = ''
  isAgentProcessing.value = false
  currentToolName.value = ''
  currentToolInput.value = null
  currentSkillName.value = ''
  currentAgentType.value = ''
  currentToolDuration.value = 0
  retryInfo.value = { count: 0, maxRetries: 10, exhausted: false }
  // Clear tool activity
  currentToolActivity.value = { toolName: '', toolId: '', phase: '', description: '', agentType: '', duration: 0, success: null, timestamp: '' }
  toolActivityHistory.value = []
  // Clear decision logic
  currentDecisionLogic.value = { why: '', benefit: '', nextStep: '' }
  // Clear goal narrative
  goalNarrative.value = { title: '', subject: '', chapter: '', edition: '' }
  // Clear session progress metrics
  sessionStartedAt.value = null
  elapsedSeconds.value = 0
  tokenUsage.value = { input: 0, output: 0, total: 0 }
  if (elapsedInterval) {
    clearInterval(elapsedInterval)
    elapsedInterval = null
  }
  // Clear run tracking
  currentRunSeq.value = undefined
  totalAgentRuns.value = undefined
  runHistory.value = []
  // Reset session tracking so next message triggers startNewSession
  hasMessageSentInSession.value = false
}
provide('clearAgentState', clearAgentState)

// =============================================================================
// Agent Form Bridge - provide registerAgentForm
// =============================================================================

/**
 * Register a form with the agent bridge.
 * Forms call this on mount to enable AI interaction.
 *
 * @param {string} formId - Unique identifier for the form (e.g., 'lesson-plan-new')
 * @param {import('@/types').AgentFormHandlers} handlers - Object with applyFormData, getFormState, submit methods
 */
function registerAgentForm(formId, handlers) {
  console.log('[AgentListener] Form registered:', formId)
  formRegistry.set(formId, handlers)

  // Flush any pending commands for this form
  const pending = pendingFormCommands.value.filter(cmd => cmd.formId === formId)
  if (pending.length > 0) {
    console.log(`[AgentListener] Flushing ${pending.length} pending commands for ${formId}`)
    for (const cmd of pending) {
      if (Date.now() - cmd.timestamp < FORM_COMMAND_TIMEOUT) {
        executeApplyFormData(formId, handlers, cmd.commandId, cmd.data)
      } else {
        console.warn(`[AgentListener] Pending command ${cmd.commandId} timed out`)
        emitApplyFormDataResult(cmd.commandId, false, `Form ${formId} timeout`)
      }
    }
    // Remove processed commands
    pendingFormCommands.value = pendingFormCommands.value.filter(cmd => cmd.formId !== formId)
  }
}

/**
 * Unregister a form from the agent bridge.
 * Called automatically when component unmounts.
 * @param {string} formId
 */
function unregisterAgentForm(formId) {
  console.log('[AgentListener] Form unregistered:', formId)
  formRegistry.delete(formId)
  // Clean up any pending commands for this form
  pendingFormCommands.value = pendingFormCommands.value.filter(cmd => cmd.formId !== formId)
}

/**
 * Get the currently registered form (if any)
 * @returns {{ formId: string; handlers: import('@/types').AgentFormHandlers } | null}
 */
function getRegisteredForm() {
  if (formRegistry.size === 0) return null
  const entry = formRegistry.entries().next().value
  if (!entry) return null
  const [formId, handlers] = entry
  return { formId, handlers }
}

provide('registerAgentForm', registerAgentForm)
provide('unregisterAgentForm', unregisterAgentForm)

// Auth store for session resume
const authStore = useAuthStore()

/**
 * Check agent backend authentication status
 * Polls /agent/status until auth is ready
 */
async function checkAgentAuthStatus() {
  try {
    const res = await fetch('http://localhost:3001/agent/status')
    const status = await res.json()
    agentAuthReady.value = status.authenticated

    if (!status.authenticated) {
      // If still initializing or retrying, check again in 2s
      console.log('[AgentListener] Agent auth not ready, retrying in 2s...')
      setTimeout(checkAgentAuthStatus, 2000)
    } else {
      console.log('[AgentListener] Agent auth ready')
    }
  } catch (err) {
    console.warn('[AgentListener] Failed to check agent auth status:', err)
    agentAuthReady.value = false
    // Retry in 3s on error
    setTimeout(checkAgentAuthStatus, 3000)
  }
}

/**
 * Connect to agentic backend
 */
function connect() {
  socket.value = io('http://localhost:3001', {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity, // Keep trying forever
    reconnectionDelay: 5000, // Wait 5 seconds between attempts
    reconnectionDelayMax: 10000, // Max 10 seconds between attempts
    auth: {
      token: authStore.token, // Pass auth token for session resume
    },
  })

  socket.value.on('connect', () => {
    console.log('[AgentListener] Connected to agentic backend')
    isConnected.value = true
    // Push current page state immediately on connect
    const route = router.currentRoute.value
    setTimeout(() => {
      pushPageState(route.path, route.params)
    }, 300)
    // Check agent auth status
    checkAgentAuthStatus()
  })

  socket.value.on('disconnect', (reason) => {
    console.log('[AgentListener] Disconnected from agentic backend:', reason)
    isConnected.value = false
  })

  socket.value.io.on('reconnect_attempt', (attempt) => {
    console.log(`[AgentListener] Reconnection attempt ${attempt}...`)
  })

  socket.value.io.on('reconnect', (attempt) => {
    console.log(`[AgentListener] Reconnected after ${attempt} attempts`)
  })

  socket.value.io.on('reconnect_error', (error) => {
    console.log('[AgentListener] Reconnection error:', error.message)
  })

  socket.value.on('client_id', (data) => {
    clientId.value = data.clientId
    console.log('[AgentListener] Received clientId:', data.clientId)
  })

  // Handle session resume (when reconnecting with an existing session)
  socket.value.on('session_resume', (data) => {
    sessionId.value = data.sessionId  // Store sessionId for SSE renderer
    console.log('[AgentListener] Session resumed:', data.sessionId, 'turns:', data.turnCount, 'hasPendingUI:', data.hasPendingUI)
  })

  socket.value.on('ui_command', handleCommand)

  // Subscribe to real-time agent status events
  socket.value.on('agent_status', handleAgentStatus)

  // Subscribe to output updates from sub-agents (replaces SSE)
  socket.value.on('output_update', handleOutputUpdate)

  // Subscribe to tool activity events for real-time progress descriptions
  socket.value.on('tool_activity', handleToolActivity)

  // Subscribe to plan proposal events (Plan Mode)
  socket.value.on('plan_proposal', handlePlanProposal)
}

/**
 * Handle output updates from sub-agents
 * This replaces SSE-based output watching for real-time AI content updates
 *
 * Uses @kedge/lesson-plan-protocol for:
 * - Event validation (safeValidateOutputUpdateEvent)
 * - Field mapping (mapFieldsToFrontend)
 *
 * Updates both the lessonPlanStore (for AI editing mode) and
 * formStateSynchronizer (for backward compatibility).
 */
function handleOutputUpdate(rawEvent) {
  // Validate event using shared protocol
  const validationResult = safeValidateOutputUpdateEvent(rawEvent)
  if (!validationResult.success) {
    console.error('[AgentListener] Invalid output_update event:', validationResult.error)
    return
  }

  const event = validationResult.data
  console.log('[AgentListener] Output update:', event.status, event.progress?.percentage || 0, '%')

  // Track run sequence for history/rollback
  if (event.runSeq !== undefined) {
    currentRunSeq.value = event.runSeq
    console.log('[AgentListener] Run sequence:', event.runSeq)
  }
  if (event.totalRuns !== undefined) {
    totalAgentRuns.value = event.totalRuns
    console.log('[AgentListener] Total runs:', event.totalRuns)
  }

  // Get lessonPlanStore for AI editing mode updates
  const lessonPlanStore = useLessonPlanStore()

  // Update generation status
  aiOutputGenerating.value = event.status === 'generating'

  // Update progress
  if (event.progress) {
    aiOutputProgress.value = {
      totalSteps: event.progress.totalSteps || 0,
      completedSteps: event.progress.completedSteps || 0,
      currentStep: event.progress.currentStep || '',
      percentage: event.progress.percentage || 0
    }
  }

  // Handle completion/error
  if (event.status === 'completed') {
    aiOutputGenerating.value = false
    lessonPlanStore.finishAIEditing()
    console.log('[AgentListener] AI editing completed')
  } else if (event.status === 'error') {
    aiOutputGenerating.value = false
    // Keep AI editing mode active so user can see partial results
    console.log('[AgentListener] AI editing error, partial results may be available')
  }

  // Update form state via lessonPlanStore (primary) and formStateSynchronizer (backup)
  if (event.data && Object.keys(event.data).length > 0) {
    // Use shared protocol's field mapping function
    // Backend uses: learningTasks, homeworkTasks
    // Frontend store uses: learningProcess, homeworkAssessment
    const formData = mapFieldsToFrontend(event.data)

    if (Object.keys(formData).length > 0) {
      // Update via lessonPlanStore's AI editing mode (primary path)
      for (const [sectionId, content] of Object.entries(formData)) {
        lessonPlanStore.updateFromAI(sectionId, content)
        // Mark section as completed (content is fully written when we receive it)
        lessonPlanStore.completeAISection(sectionId)
      }
      console.log('[AgentListener] Updated lessonPlanStore via AI editing mode:', Object.keys(formData))

      // Also update via formStateSynchronizer for backward compatibility
      formStateSynchronizer.updateFields('lessonPlanContent', formData, 'a2ui')
    }
  }
}

/**
 * Handle tool activity events from sub-agents
 * These provide human-readable descriptions of what tools are doing
 *
 * Event structure:
 * {
 *   toolName: string,     // e.g., 'read_reference_data'
 *   toolId: string,       // Unique ID for this tool call
 *   phase: 'start' | 'end',
 *   description: string,  // Chinese description e.g., '正在查阅数学第三学段「数与代数」课程标准...'
 *   agentType?: string,   // e.g., 'lesson-plan-designer'
 *   duration?: number,    // Only on 'end' phase
 *   success?: boolean,    // Only on 'end' phase
 *   decisionLogic?: {     // Explains WHY this tool is being called
 *     why: string,
 *     benefit: string,
 *     nextStep?: string
 *   },
 *   sessionMetrics?: {    // Only on 'end' phase - session-level metrics
 *     startedAt: string,
 *     inputTokens: number,
 *     outputTokens: number,
 *     totalTokens: number
 *   },
 *   timestamp: string
 * }
 */
function handleToolActivity(event) {
  console.log('[AgentListener] Tool activity:', event.phase, event.toolName, '-', event.description)

  // Update current tool activity
  currentToolActivity.value = {
    toolName: event.toolName || '',
    toolId: event.toolId || '',
    phase: event.phase || '',
    description: event.description || '',
    agentType: event.agentType || '',
    duration: event.duration || 0,
    success: event.success ?? null,
    timestamp: event.timestamp || new Date().toISOString()
  }

  // Update decision logic if present (explains WHY this tool is being called)
  if (event.decisionLogic) {
    currentDecisionLogic.value = {
      why: event.decisionLogic.why || '',
      benefit: event.decisionLogic.benefit || '',
      nextStep: event.decisionLogic.nextStep || ''
    }
    console.log('[AgentListener] Decision logic:', event.decisionLogic.why)
  }

  // Extract session metrics from 'end' events
  if (event.phase === 'end' && event.sessionMetrics) {
    const metrics = event.sessionMetrics

    // Update session start time and token usage
    if (metrics.startedAt && !sessionStartedAt.value) {
      sessionStartedAt.value = metrics.startedAt

      // Start elapsed time counter if not already running
      if (!elapsedInterval) {
        const startTime = new Date(metrics.startedAt).getTime()
        elapsedInterval = setInterval(() => {
          elapsedSeconds.value = Math.floor((Date.now() - startTime) / 1000)
        }, 1000)
        // Initial calculation
        elapsedSeconds.value = Math.floor((Date.now() - startTime) / 1000)
      }
    }

    // Update token usage
    tokenUsage.value = {
      input: metrics.inputTokens || 0,
      output: metrics.outputTokens || 0,
      total: metrics.totalTokens || 0
    }
    console.log('[AgentListener] Session metrics:', elapsedSeconds.value + 's', tokenUsage.value.total, 'tokens')
  }

  // Add to history (keep last 20 entries)
  const historyEntry = {
    ...currentToolActivity.value,
    id: `${event.toolId}-${event.phase}`,
    // Store toolInput on start phase for expandable details
    toolInput: event.toolInput,
  }

  // If 'end' phase, update the corresponding 'start' entry or add new
  if (event.phase === 'end') {
    const startIndex = toolActivityHistory.value.findIndex(
      h => h.toolId === event.toolId && h.phase === 'start'
    )
    if (startIndex >= 0) {
      // Update the start entry with end info
      toolActivityHistory.value[startIndex] = {
        ...toolActivityHistory.value[startIndex],
        endDescription: event.description,
        duration: event.duration,
        success: event.success,
        completed: true,
        // Store toolOutput on end phase for expandable details
        toolOutput: event.toolOutput,
        error: event.error,
      }
    } else {
      // Add as new entry (at end for chronological order)
      historyEntry.toolOutput = event.toolOutput
      historyEntry.error = event.error
      toolActivityHistory.value.push(historyEntry)
    }
  } else {
    // Add start entry (at end for chronological order)
    toolActivityHistory.value.push(historyEntry)
  }

  // Trim to last 20 entries (keep newest, remove oldest from beginning)
  if (toolActivityHistory.value.length > 20) {
    toolActivityHistory.value = toolActivityHistory.value.slice(-20)
  }
}

/**
 * Handle agent status events for real-time UI updates
 */
function handleAgentStatus(status) {
  console.log('[AgentListener] Agent status:', status.type, status.data)
  agentStatus.value = status

  switch (status.type) {
    case 'thinking':
      isAgentProcessing.value = true
      currentToolName.value = ''
      currentSkillName.value = ''
      streamingText.value = ''
      // Clear reasoning history for new request
      reasoningHistory.value = []
      break
    case 'tool_start':
      currentToolName.value = status.data.toolName || ''
      currentToolInput.value = status.data.input || null
      currentSkillName.value = ''
      break
    case 'skill_start':
      currentSkillName.value = status.data.skillName || ''
      currentToolName.value = ''
      break
    case 'tool_end':
    case 'skill_end':
      currentToolName.value = ''
      currentToolInput.value = null
      currentSkillName.value = ''
      break
    case 'text_chunk':
      streamingText.value += status.data.text || ''
      break
    case 'error':
      if (status.data.retryCount !== undefined) {
        retryInfo.value = {
          count: status.data.retryCount,
          maxRetries: status.data.maxRetries || 10,
          exhausted: status.data.exhausted || false,
        }
      }
      break
    case 'complete':
      console.log('[AgentListener] COMPLETE event received - clearing processing state')
      isAgentProcessing.value = false
      currentToolName.value = ''
      currentToolInput.value = null
      currentSkillName.value = ''
      stallWarning.value = null // Clear stall warning on complete
      // Clear sub-agent progress on complete
      subagentTodos.value = []
      subagentProgress.value = { agentType: '', completed: 0, inProgress: 0, pending: 0, total: 0 }
      // Clear reasoning display on complete
      reasoningPhase.value = ''
      reasoningSummary.value = ''
      // Clear AI output generation state
      aiOutputGenerating.value = false
      // Clear session progress metrics
      sessionStartedAt.value = null
      elapsedSeconds.value = 0
      tokenUsage.value = { input: 0, output: 0, total: 0 }
      if (elapsedInterval) {
        clearInterval(elapsedInterval)
        elapsedInterval = null
      }
      console.log('[AgentListener] Processing state cleared: isAgentProcessing=', isAgentProcessing.value, 'reasoningPhase=', reasoningPhase.value)
      break
    case 'stall_warning':
      stallWarning.value = {
        message: status.data.message || '看起来我可能遇到了困难。您能提供更多信息吗？',
        turnsWithoutProgress: status.data.turnsWithoutProgress || 0,
      }
      break
    case 'ui_component':
      // A2UI: Received a structured UI component from agent
      if (status.data.component) {
        pendingUIComponent.value = status.data.component
        console.log('[AgentListener] A2UI component received:', status.data.component.type, status.data.component.componentId)
      }
      break
    case 'todo_update':
      // Update todo items from agent
      if (status.data.todos) {
        todoItems.value = status.data.todos
        todoStats.value = {
          completed: status.data.completed || 0,
          inProgress: status.data.inProgress || 0,
          pending: status.data.pending || 0,
          total: status.data.total || 0,
        }
        console.log('[AgentListener] Todo update:', todoStats.value.completed, '/', todoStats.value.total)
      }
      break
    // Sub-agent tool hooks for detailed visibility
    case 'subagent_tool_start':
      currentToolName.value = status.data.toolName || ''
      currentToolInput.value = status.data.input || null
      currentAgentType.value = status.data.agentType || ''
      currentToolDuration.value = 0
      console.log(`[AgentListener] Sub-agent tool start: ${status.data.toolName} (${status.data.agentType})`)
      break
    case 'subagent_tool_end':
      currentToolDuration.value = status.data.duration || 0
      console.log(`[AgentListener] Sub-agent tool end: ${status.data.toolName} (${status.data.duration}ms, success: ${status.data.success})`)
      // Clear tool name after a short delay to show completion
      setTimeout(() => {
        if (currentToolName.value === status.data.toolName) {
          currentToolName.value = ''
          currentToolInput.value = null
          currentAgentType.value = ''
        }
      }, 200)
      break
    case 'subagent_todo_update':
      // Update sub-agent todo progress (separate from main agent todos)
      if (status.data.todos) {
        subagentTodos.value = status.data.todos
        subagentProgress.value = {
          agentType: status.data.agentType || 'sub-agent',
          completed: status.data.completed || 0,
          inProgress: status.data.inProgress || 0,
          pending: status.data.pending || 0,
          total: status.data.total || 0,
        }
        console.log(`[AgentListener] Sub-agent todo update: ${status.data.completed}/${status.data.total} (${status.data.agentType})`)
      }
      break
    case 'reasoning':
      // Update reasoning/planning phase display
      reasoningPhase.value = status.data.phase || ''
      reasoningSummary.value = status.data.summary || ''
      // Accumulate to history for message bubble display
      if (status.data.phase) {
        reasoningHistory.value.push({
          phase: status.data.phase,
          summary: status.data.summary || '',
          timestamp: Date.now()
        })
      }
      console.log(`[AgentListener] Reasoning phase: ${status.data.phase} - ${status.data.summary}`)
      break
  }
}

/**
 * Handle user interaction with A2UI component
 * If component has formBinding, updates form directly and sends user_action
 * Otherwise sends interaction back to backend as before
 */
function handleUIInteraction(interaction) {
  if (!socket.value || !isConnected.value) {
    console.error('[AgentListener] Cannot send interaction: not connected')
    return
  }

  const component = pendingUIComponent.value
  console.log('[AgentListener] A2UI interaction:', interaction)

  // Check if this is a pick_list with formBinding
  if (component?.type === 'pick_list' && component.formBinding && interaction.action === 'select') {
    handleFormBoundSelection(component, interaction)
  } else {
    // Legacy behavior: emit interaction to agent
    socket.value.emit('ui_interaction', interaction)
  }

  // Clear the pending component
  pendingUIComponent.value = null
}

/**
 * Handle form-bound A2UI selection
 * Updates form fields directly via FormStateSynchronizer, then notifies agent
 */
function handleFormBoundSelection(component, interaction) {
  const { formBinding, options } = component
  const { formId, fieldName, labelField, dataFields, applyMode } = formBinding

  // Find selected option
  const selectedOption = options.find(opt => opt.id === interaction.value)
  if (!selectedOption) {
    console.error('[AgentListener] Selected option not found:', interaction.value)
    socket.value.emit('ui_interaction', interaction)
    return
  }

  // Build form update payload
  const formData = {
    [fieldName]: selectedOption.id,
  }
  if (labelField) {
    formData[labelField] = selectedOption.label
  }
  if (dataFields && selectedOption.data) {
    for (const [dataKey, formField] of Object.entries(dataFields)) {
      if (selectedOption.data[dataKey] !== undefined) {
        formData[formField] = selectedOption.data[dataKey]
      }
    }
  }

  // Update form directly via FormStateSynchronizer
  const success = formStateSynchronizer.updateFields(formId, formData, 'a2ui')

  if (success) {
    console.log(`[AgentListener] Form-bound selection: updated ${formId} with`, formData)

    // Get current form state for notification
    const formState = formStateSynchronizer.getFormStateCopy(formId)

    // Send user_action notification to agent (not raw interaction)
    socket.value.emit('user_action', {
      type: 'user_action',
      action: 'field_updated',
      context: {
        formId,
        field: fieldName,
        value: selectedOption.id,
        label: selectedOption.label,
        source: 'a2ui',
        formState,
      },
    })
  } else {
    // Fallback to legacy behavior if form not registered
    console.warn(`[AgentListener] Form ${formId} not registered in synchronizer, falling back`)
    socket.value.emit('ui_interaction', interaction)
  }
}

/**
 * Handle incoming UI commands
 */
async function handleCommand(command) {
  console.log('[AgentListener] Received command:', command.type, command.payload)

  try {
    switch (command.type) {
      case 'navigate':
        await handleNavigate(command)
        break
      case 'focus':
        await handleFocus(command)
        break
      case 'read_page':
        await handleReadPage(command)
        break
      case 'click':
        await handleClick(command)
        break
      case 'fill_form':
        await handleFillForm(command)
        break
      // New page-driven commands
      case 'read_page_schema':
        await handleReadPageSchema(command)
        break
      case 'fill_field':
        await handleFillField(command)
        break
      case 'trigger_widget':
        await handleTriggerWidget(command)
        break
      case 'watch_field':
        await handleWatchField(command)
        break
      case 'get_form_state':
        await handleGetFormState(command)
        break
      // Agent Form Bridge command
      case 'apply_form_data':
        await handleApplyFormData(command)
        break
      // Dialog commands
      case 'open_chapter_selector':
        await handleOpenChapterSelector(command)
        break
      default:
        console.warn('[AgentListener] Unknown command type:', command.type)
    }
  } catch (error) {
    console.error('[AgentListener] Command execution error:', error)
    emitResult(command.commandId, false, error.message)
  }
}

/**
 * Navigate to a path using Vue Router
 */
async function handleNavigate(command) {
  const { path } = command.payload

  if (navigationPaused.value) {
    console.log('[AgentListener] Navigation paused, queuing:', path)
    lastAgentPath.value = path
    return
  }

  try {
    await router.push(path)
    lastAgentPath.value = path
    emitResult(command.commandId, true)
  } catch (error) {
    console.warn('[AgentListener] Navigation failed:', error.message)
    emitResult(command.commandId, false, error.message)
  }
}

/**
 * Focus on an element and apply highlight effect
 */
async function handleFocus(command) {
  const { selector } = command.payload

  // Wait a tick for DOM to settle after navigation
  await new Promise(resolve => setTimeout(resolve, 100))

  const element = document.querySelector(selector)
  if (!element) {
    console.warn('[AgentListener] Element not found:', selector)
    emitResult(command.commandId, false, `Element not found: ${selector}`)
    return
  }

  // Scroll into view
  element.scrollIntoView({ behavior: 'smooth', block: 'center' })

  // Focus if focusable
  if (typeof element.focus === 'function') {
    element.focus()
  }

  // Apply highlight effect
  applyHighlight(element)

  emitResult(command.commandId, true)
}

/**
 * Read page content and send back to backend
 */
async function handleReadPage(command) {
  const { selector } = command.payload

  // Wait for DOM to settle
  await new Promise(resolve => setTimeout(resolve, 200))

  let content = ''
  let error = null

  if (selector) {
    const elements = document.querySelectorAll(selector)
    if (elements.length === 0) {
      error = `No elements found for selector: ${selector}`
    } else {
      content = Array.from(elements)
        .map(el => el.innerText || el.textContent)
        .join('\n')
    }
  } else {
    content = document.body.innerText
  }

  // Emit page content back to backend
  socket.value.emit('page_content', {
    commandId: command.commandId,
    content: content.slice(0, 10000), // Limit content size
    selector: selector || null,
    error,
  })
}

/**
 * Click an element
 */
async function handleClick(command) {
  const { selector } = command.payload

  // Wait for DOM to settle
  await new Promise(resolve => setTimeout(resolve, 100))

  const element = document.querySelector(selector)
  if (!element) {
    console.warn('[AgentListener] Element not found:', selector)
    emitResult(command.commandId, false, `Element not found: ${selector}`)
    return
  }

  // Scroll into view first
  element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  await new Promise(resolve => setTimeout(resolve, 200))

  // Handle checkbox/radio specially
  if (element.type === 'checkbox' || element.type === 'radio') {
    element.checked = !element.checked
    element.dispatchEvent(new Event('change', { bubbles: true }))
  } else {
    element.click()
  }

  applyHighlight(element)
  emitResult(command.commandId, true)
}

/**
 * Fill form fields
 */
async function handleFillForm(command) {
  const { fields } = command.payload

  // Wait for DOM to settle
  await new Promise(resolve => setTimeout(resolve, 100))

  let allSuccess = true
  const errors = []

  for (const [selector, value] of Object.entries(fields)) {
    const element = document.querySelector(selector)
    if (!element) {
      errors.push(`Element not found: ${selector}`)
      allSuccess = false
      continue
    }

    // Set value based on element type
    if (element.tagName === 'SELECT') {
      // For SELECT elements, we need to find the matching option
      // The value might be either the option value or the display text
      const select = element
      let matchedIndex = -1

      // First try exact value match (as string, since option.value is always string)
      const valueStr = String(value)
      matchedIndex = Array.from(select.options).findIndex(opt => opt.value === valueStr)

      // If not found, try matching by text content
      if (matchedIndex === -1) {
        matchedIndex = Array.from(select.options).findIndex(
          opt => opt.textContent?.trim() === value || opt.text?.trim() === value
        )
      }

      if (matchedIndex !== -1) {
        // Set selectedIndex - this is the most reliable way to trigger Vue v-model
        select.selectedIndex = matchedIndex

        // Also set value for good measure
        select.value = select.options[matchedIndex].value

        // Dispatch events for Vue v-model to pick up
        // Use 'change' as it's the standard event for <select> changes
        select.dispatchEvent(new Event('change', { bubbles: true }))

        console.log(`[AgentListener] Set select ${selector} to index ${matchedIndex}, value: ${select.value}`)
      } else {
        const availableOptions = Array.from(select.options).map(o => `"${o.text}" (value: ${o.value})`).join(', ')
        errors.push(`No matching option found for "${value}" in ${selector}. Available: ${availableOptions}`)
        allSuccess = false
        continue
      }
    } else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      // Use Object.getOwnPropertyDescriptor for Vue v-model compatibility
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )?.set
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(element, value)
      } else {
        element.value = value
      }
      element.dispatchEvent(new Event('input', { bubbles: true }))
      element.dispatchEvent(new Event('change', { bubbles: true }))
    }

    applyHighlight(element)
  }

  if (allSuccess) {
    emitResult(command.commandId, true)
  } else {
    emitResult(command.commandId, false, errors.join('; '))
  }
}

// =============================================================================
// Agent Form Bridge Commands
// =============================================================================

/**
 * Handle apply_form_data command
 * Sets entire form state in one call via registered form handlers
 */
async function handleApplyFormData(command) {
  const { formId, data } = command.payload

  if (!formId) {
    emitApplyFormDataResult(command.commandId, false, 'Missing formId in payload')
    return
  }

  const handlers = formRegistry.get(formId)

  if (!handlers) {
    // Form not registered yet - queue the command
    console.log(`[AgentListener] Form ${formId} not registered, queuing command`)
    pendingFormCommands.value.push({
      commandId: command.commandId,
      formId,
      data: data || {},
      timestamp: Date.now(),
    })

    // Set timeout to fail if form never registers
    setTimeout(() => {
      const stillPending = pendingFormCommands.value.find(
        cmd => cmd.commandId === command.commandId
      )
      if (stillPending) {
        console.warn(`[AgentListener] Form ${formId} not found after timeout`)
        emitApplyFormDataResult(command.commandId, false, `Form ${formId} not found after timeout`)
        pendingFormCommands.value = pendingFormCommands.value.filter(
          cmd => cmd.commandId !== command.commandId
        )
      }
    }, FORM_COMMAND_TIMEOUT)

    return
  }

  // Form registered - execute immediately
  await executeApplyFormData(formId, handlers, command.commandId, data || {})
}

/**
 * Execute apply_form_data on registered form handlers
 * @param {string} formId
 * @param {import('@/types').AgentFormHandlers} handlers
 * @param {string} commandId
 * @param {Record<string, unknown>} data
 */
async function executeApplyFormData(formId, handlers, commandId, data) {
  try {
    console.log(`[AgentListener] Applying form data to ${formId}:`, data)
    const result = await handlers.applyFormData(data)

    if (result.success) {
      emitApplyFormDataResult(commandId, true, null, {
        appliedFields: result.appliedFields || Object.keys(data),
        formState: result.formState || handlers.getFormState(),
      })
    } else {
      emitApplyFormDataResult(commandId, false, 'Validation failed', {
        errors: result.errors,
      })
    }
  } catch (error) {
    console.error(`[AgentListener] Error applying form data to ${formId}:`, error)
    emitApplyFormDataResult(commandId, false, error.message || 'Unknown error')
  }
}

/**
 * Emit apply_form_data result back to backend
 * @param {string} commandId
 * @param {boolean} success
 * @param {string | null} error
 * @param {{ appliedFields?: string[]; formState?: Record<string, unknown>; errors?: unknown[] }} [result]
 */
function emitApplyFormDataResult(commandId, success, error, result) {
  if (!socket.value) return

  socket.value.emit('command_result', {
    commandId,
    success,
    error,
    result,
  })
}

// =============================================================================
// Dialog Commands
// =============================================================================

/**
 * Handle open_chapter_selector command
 * Dispatches a custom event to LessonPlanNewView to open the TextbookChapterSelector dialog
 */
async function handleOpenChapterSelector(command) {
  const { initialSubject, initialGrade, searchTopic } = command.payload || {}

  console.log('[AgentListener] Opening chapter selector dialog:', { initialSubject, initialGrade, searchTopic })

  // Dispatch a custom event that LessonPlanNewView will listen to
  window.dispatchEvent(new CustomEvent('agent-open-chapter-selector', {
    detail: { initialSubject, initialGrade, searchTopic }
  }))

  // Command executed successfully - dialog will be opened by the view
  emitResult(command.commandId, true)
}

// =============================================================================
// New Page-Driven Commands
// =============================================================================

/**
 * Read page schema - discover form elements
 * Enhanced with Agent Form Bridge info when a form is registered
 */
async function handleReadPageSchema(command) {
  const { formSelector } = command.payload || {}

  // Wait for DOM to settle
  await new Promise(resolve => setTimeout(resolve, 200))

  try {
    const elements = discoverFormElements({ formSelector })

    // Build response with optional agentForm info
    const response = {
      commandId: command.commandId,
      elements,
      currentPath: router.currentRoute.value.path,
      error: null,
    }

    // Include registered form info if available
    const registeredForm = getRegisteredForm()
    if (registeredForm) {
      const { formId, handlers } = registeredForm
      const actions = ['applyFormData', 'getFormState']
      if (!handlers.readonly) {
        actions.push('submit')
      }

      response.agentForm = {
        formId,
        readonly: handlers.readonly || false,
        actions,
        dataShape: handlers.getDataShape?.(),
        currentState: handlers.getFormState(),
      }
    }

    // Emit schema back to backend
    socket.value.emit('page_schema', response)
  } catch (error) {
    socket.value.emit('page_schema', {
      commandId: command.commandId,
      elements: [],
      currentPath: router.currentRoute.value.path,
      error: error.message,
    })
  }
}

/**
 * Fill a single field by ID
 */
async function handleFillField(command) {
  const { fieldId, value, label } = command.payload

  // Wait for DOM to settle
  await new Promise(resolve => setTimeout(resolve, 100))

  // Find the form item by fieldId
  const formItem = getDOMElementByFieldId(fieldId)
  if (!formItem) {
    emitResult(command.commandId, false, `Field not found: ${fieldId}`)
    return
  }

  // Check for chapter-picker widget (custom component, not standard input)
  const chapterPicker = formItem.querySelector('[data-widget="chapter-picker"]')
  if (chapterPicker) {
    // Dispatch a custom event that LessonPlanNewView will listen to
    const event = new CustomEvent('agent-set-chapter', {
      bubbles: true,
      detail: { chapterId: value, chapterLabel: label || `章节 ${value}` }
    })
    chapterPicker.dispatchEvent(event)
    console.log('[AgentListener] Dispatched agent-set-chapter event:', value, label)
    applyHighlight(chapterPicker)
    emitResult(command.commandId, true)
    return
  }

  // Find the actual input element
  const input = formItem.querySelector('input, select, textarea')
  if (!input) {
    emitResult(command.commandId, false, `No input element in field: ${fieldId}`)
    return
  }

  // Set value based on element type
  if (input.tagName === 'SELECT') {
    const select = input
    const valueStr = String(value)
    let matchedIndex = Array.from(select.options).findIndex(opt => opt.value === valueStr)

    if (matchedIndex === -1) {
      matchedIndex = Array.from(select.options).findIndex(
        opt => opt.textContent?.trim() === value || opt.text?.trim() === value
      )
    }

    if (matchedIndex !== -1) {
      select.selectedIndex = matchedIndex
      select.value = select.options[matchedIndex].value
      select.dispatchEvent(new Event('change', { bubbles: true }))
    } else {
      emitResult(command.commandId, false, `No matching option for "${value}" in ${fieldId}`)
      return
    }
  } else if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value)
    } else {
      input.value = value
    }
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }

  applyHighlight(input)
  emitResult(command.commandId, true)
}

/**
 * Trigger a widget (open modal, etc.)
 */
async function handleTriggerWidget(command) {
  const { widgetId, action } = command.payload

  // Wait for DOM to settle
  await new Promise(resolve => setTimeout(resolve, 100))

  // Find the form item containing the widget
  const formItem = getDOMElementByFieldId(widgetId)
  if (!formItem) {
    emitResult(command.commandId, false, `Widget not found: ${widgetId}`)
    return
  }

  // Find the widget element
  const widgetEl = formItem.querySelector('[data-widget]')
  const widgetType = widgetEl?.getAttribute('data-widget')

  if (!widgetType) {
    // Fallback: try to find and click a button
    const button = formItem.querySelector('button, .el-button')
    if (button) {
      button.click()
      selectionMode.value = 'page'
      emitResult(command.commandId, true, { modalOpened: true })
      return
    }
    emitResult(command.commandId, false, `No widget or button in field: ${widgetId}`)
    return
  }

  // Get widget definition
  const definition = getWidgetDefinition(widgetType)
  if (!definition) {
    emitResult(command.commandId, false, `Unknown widget type: ${widgetType}`)
    return
  }

  // Get interaction hint
  const hint = definition.getInteractionHint()

  if (action === 'open' && hint.triggerSelector) {
    const trigger = formItem.querySelector(hint.triggerSelector) || formItem.querySelector('button')
    if (trigger) {
      trigger.click()
      selectionMode.value = 'page'
      emitResult(command.commandId, true, { modalOpened: true, widgetType })
    } else {
      emitResult(command.commandId, false, `Trigger not found: ${hint.triggerSelector}`)
    }
  } else {
    emitResult(command.commandId, false, `Unsupported action: ${action}`)
  }
}

/**
 * Watch a field for value changes
 */
async function handleWatchField(command) {
  const { fieldId } = command.payload

  // Find the form item
  const formItem = getDOMElementByFieldId(fieldId)
  if (!formItem) {
    emitResult(command.commandId, false, `Field not found: ${fieldId}`)
    return
  }

  // Clean up existing watcher if any
  if (fieldWatchers.value.has(fieldId)) {
    const existing = fieldWatchers.value.get(fieldId)
    existing.observer?.disconnect()
    fieldWatchers.value.delete(fieldId)
  }

  // Create a MutationObserver to watch for value changes
  const observer = new MutationObserver((mutations) => {
    // Check if value changed
    const input = formItem.querySelector('input, select, textarea')
    const currentValue = input?.value

    // Emit change event
    socket.value.emit('field_changed', {
      fieldId,
      value: currentValue,
    })
  })

  // Also listen for input events
  const input = formItem.querySelector('input, select, textarea')
  const handleInputChange = (event) => {
    socket.value.emit('field_changed', {
      fieldId,
      value: event.target.value,
    })
  }

  if (input) {
    input.addEventListener('change', handleInputChange)
    input.addEventListener('input', handleInputChange)
  }

  // Observe attribute changes on the form item (for widgets with data attributes)
  observer.observe(formItem, {
    attributes: true,
    attributeFilter: ['data-selected-id', 'data-value', 'data-selected-chapter-id'],
    subtree: true,
  })

  // Store for cleanup
  fieldWatchers.value.set(fieldId, {
    observer,
    input,
    handleInputChange,
  })

  // Return current value
  const currentValue = input?.value || formItem.querySelector('[data-widget]')?.getAttribute('data-selected-id')
  emitResult(command.commandId, true, { watching: true, currentValue })
}

/**
 * Get current form state
 */
async function handleGetFormState(command) {
  const { formSelector } = command.payload || {}

  // Wait for DOM to settle
  await new Promise(resolve => setTimeout(resolve, 100))

  const elements = discoverFormElements({ formSelector })
  const state = {}

  for (const el of elements) {
    state[el.id] = {
      value: el.value,
      type: el.type,
      label: el.label,
    }
  }

  socket.value.emit('form_state', {
    commandId: command.commandId,
    state,
    currentPath: router.currentRoute.value.path,
  })
}

/**
 * Apply visual highlight effect to an element
 */
function applyHighlight(element) {
  const originalOutline = element.style.outline
  const originalTransition = element.style.transition

  element.style.transition = 'outline 0.3s ease-in-out'
  element.style.outline = '3px solid #1890ff'

  // Remove highlight after 2 seconds
  setTimeout(() => {
    element.style.outline = originalOutline
    setTimeout(() => {
      element.style.transition = originalTransition
    }, 300)
  }, 2000)
}

/**
 * Emit command result back to backend
 */
function emitResult(commandId, success, error = null) {
  socket.value.emit('command_result', {
    commandId,
    success,
    error,
  })
}

/**
 * Resume agent navigation after user paused it
 */
function resumeNavigation() {
  navigationPaused.value = false
  console.log('[AgentListener] Navigation resumed')

  // If there was a pending path, navigate to it
  if (lastAgentPath.value) {
    router.push(lastAgentPath.value)
  }
}

/**
 * Detect manual navigation and pause agent navigation
 */
function setupNavigationWatcher() {
  // Watch for route changes not initiated by agent
  router.beforeEach((to, from, next) => {
    // If we're connected and this isn't the last agent-initiated path
    if (isConnected.value && lastAgentPath.value && to.path !== lastAgentPath.value) {
      console.log('[AgentListener] Manual navigation detected, pausing agent navigation')
      navigationPaused.value = true
    }
    next()
  })

  // Emit navigation changes to agent
  router.afterEach(async (to, from) => {
    if (socket.value && isConnected.value) {
      socket.value.emit('navigation_changed', {
        path: to.path,
        params: to.params,
        query: to.query,
        fromPath: from.path,
      })
      console.log('[AgentListener] Navigation changed:', to.path)

      // Push page state after DOM stabilizes
      await new Promise(resolve => setTimeout(resolve, 200))
      pushPageState(to.path, to.params)
    }
  })
}

/**
 * Clean up field watchers
 */
function cleanupFieldWatchers() {
  for (const [fieldId, watcher] of fieldWatchers.value) {
    watcher.observer?.disconnect()
    if (watcher.input && watcher.handleInputChange) {
      watcher.input.removeEventListener('change', watcher.handleInputChange)
      watcher.input.removeEventListener('input', watcher.handleInputChange)
    }
  }
  fieldWatchers.value.clear()
}

// =============================================================================
// Page State Push - Auto-sync page path to backend
// =============================================================================

/**
 * Push current page state to backend
 * Only sends path and params - agent uses entity ID to fetch detailed data via API
 */
function pushPageState(path, params) {
  if (!socket.value || !isConnected.value) {
    return
  }

  try {
    socket.value.emit('page_state_changed', {
      path,
      params: params || {},
      timestamp: new Date().toISOString(),
    })
    console.log('[AgentListener] Page state pushed:', path)
  } catch (error) {
    console.warn('[AgentListener] Failed to push page state:', error)
  }
}

// Form change listener removed - we only track page path and params, not form state
// Agent should use entity ID from path params to fetch detailed data via API

// Chapter picker auto-watcher
let chapterPickerObserver = null
let lastChapterPickerId = null
let chapterPickerDebounceTimer = null
const CHAPTER_PICKER_DEBOUNCE_MS = 250  // 250ms debounce per panel discussion

/**
 * Set up auto-watcher for chapter picker widgets
 * When a chapter is selected, notify the agent automatically
 *
 * Design decisions (from panel discussion):
 * - Use 250ms debounce to filter rapid clicks while keeping UI responsive
 * - Only emit if there's an active agent session (handled by backend)
 * - Convert to user message, not special event
 */
function setupChapterPickerWatcher() {
  // Clean up existing observer
  if (chapterPickerObserver) {
    chapterPickerObserver.disconnect()
    chapterPickerObserver = null
  }

  // Watch for chapter picker changes in the entire document
  chapterPickerObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Check for attribute changes on chapter picker widgets
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-selected-id') {
        const widget = mutation.target.closest('[data-widget="chapter-picker"]')
        if (widget) {
          const selectedId = widget.getAttribute('data-selected-id')
          const selectedLabel = widget.getAttribute('data-selected-label')

          // Clear any pending debounce timer
          if (chapterPickerDebounceTimer) {
            clearTimeout(chapterPickerDebounceTimer)
            chapterPickerDebounceTimer = null
          }

          // Debounce the notification
          chapterPickerDebounceTimer = setTimeout(() => {
            // Only notify if a chapter was selected (not cleared)
            // and it's a new selection (not the same as last time)
            if (selectedId && selectedId !== 'null' && selectedId !== lastChapterPickerId) {
              lastChapterPickerId = selectedId
              console.log('[AgentListener] Chapter selected (debounced):', selectedId, selectedLabel)

              // Emit wizard_action to directly continue wizard (bypasses LLM)
              if (socket.value && isConnected.value) {
                socket.value.emit('wizard_action', {
                  type: 'wizard_action',
                  wizardId: 'lesson-plan',
                  action: 'select_chapter',
                  data: {
                    chapterId: parseInt(selectedId, 10),
                    chapterTitle: selectedLabel || '',
                  },
                })
              }
            } else if (!selectedId || selectedId === 'null') {
              // Chapter was cleared
              lastChapterPickerId = null
            }
          }, CHAPTER_PICKER_DEBOUNCE_MS)
        }
      }
    }
  })

  // Observe the entire document for changes
  chapterPickerObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['data-selected-id'],
    subtree: true,
  })

  console.log('[AgentListener] Chapter picker watcher set up with', CHAPTER_PICKER_DEBOUNCE_MS, 'ms debounce')
}

/**
 * Clean up chapter picker watcher
 */
function cleanupChapterPickerWatcher() {
  if (chapterPickerDebounceTimer) {
    clearTimeout(chapterPickerDebounceTimer)
    chapterPickerDebounceTimer = null
  }
  if (chapterPickerObserver) {
    chapterPickerObserver.disconnect()
    chapterPickerObserver = null
  }
  lastChapterPickerId = null
}

/**
 * Handle chapter selection confirmed from dialog (triggered by agent command)
 * Emits chapter_selected event to backend to continue wizard
 */
function handleAgentChapterConfirmed(event) {
  const { chapterId, chapterTitle, subject, grade } = event.detail

  console.log('[AgentListener] Chapter confirmed by user:', { chapterId, chapterTitle, subject, grade })

  if (!socket.value || !isConnected.value) {
    console.error('[AgentListener] Cannot emit chapter_selected: not connected')
    return
  }

  // Emit chapter_selected event to backend
  socket.value.emit('chapter_selected', {
    chapterId,
    chapterTitle,
    subject,
    grade,
  })
}

/**
 * Set up form submission listener
 * Detects when forms are submitted and reports success/error to agent
 */
function setupFormSubmitListener() {
  formSubmitUnsubscribe = onFormSubmit((result) => {
    if (!socket.value || !isConnected.value) {
      return
    }

    console.log('[AgentListener] Form submit result:', result.success)

    // Emit form result to backend
    socket.value.emit('form_result', {
      success: result.success,
      data: result.data,
      error: result.error,
      validationErrors: result.validationErrors,
      redirectUrl: result.redirectUrl,
      currentPath: router.currentRoute.value.path,
    })

    // Reset selection mode after form submission
    selectionMode.value = 'none'

    // Clean up field watchers - form state is now submitted
    cleanupFieldWatchers()
  })
}

onMounted(() => {
  // Only connect if user is logged in
  if (authStore.isLoggedIn) {
    connect()
  }
  setupNavigationWatcher()
  setupFormSubmitListener()
  setupChapterPickerWatcher()
  // Listen for chapter selection confirmed from dialog
  window.addEventListener('agent-chapter-confirmed', handleAgentChapterConfirmed)
})

// Watch for auth state changes - reconnect when user logs in
watch(
  () => authStore.isLoggedIn,
  (isLoggedIn) => {
    if (isLoggedIn && !socket.value) {
      console.log('[AgentListener] User logged in, connecting to agent backend')
      connect()
    } else if (!isLoggedIn && socket.value) {
      console.log('[AgentListener] User logged out, disconnecting from agent backend')
      socket.value.disconnect()
      socket.value = null
      isConnected.value = false
    }
  }
)

onUnmounted(() => {
  cleanupFieldWatchers()
  cleanupChapterPickerWatcher()
  window.removeEventListener('agent-chapter-confirmed', handleAgentChapterConfirmed)
  if (formSubmitUnsubscribe) {
    formSubmitUnsubscribe()
    formSubmitUnsubscribe = null
  }
  // Clear elapsed timer
  if (elapsedInterval) {
    clearInterval(elapsedInterval)
    elapsedInterval = null
  }
  if (socket.value) {
    socket.value.disconnect()
    socket.value = null
  }
})
</script>

<template>
  <!-- This component is invisible - it only listens for commands -->
  <!-- Slot for ChatbotWidget which uses the provided values -->
  <slot></slot>
</template>
