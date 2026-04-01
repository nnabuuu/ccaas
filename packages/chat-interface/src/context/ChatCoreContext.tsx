import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type RefObject,
  type ReactNode,
} from 'react'
import { useAgentConnection, useAgentChat, useAgentStatus } from '@kedge-agentic/react-sdk'
import type { ChatMessage, ContentBlock, NextAction, QuickSuggestion } from '@/types/chat'
import { parseAssistantContent, buildContentBlocksFromSdkBlocks } from '@/harness/postprocessor'
import { submitToEngine } from '@/harness/submit-engine'
import { toast } from 'sonner'

export interface ChatCoreContextValue {
  // Connection
  sessionReady: boolean
  // Messages
  messages: ChatMessage[]
  isLoadingHistory: boolean
  // Processing
  isProcessing: boolean
  isThinking: boolean
  thinkingVerb: string
  // Input
  input: string
  setInput: (v: string) => void
  inputRef: RefObject<HTMLTextAreaElement>
  // Scroll
  scrollContainerRef: RefObject<HTMLDivElement>
  messagesEndRef: RefObject<HTMLDivElement>
  // Actions
  handleSend: () => Promise<void>
  handleRetry: (messageId: string) => Promise<void>
  handleAction: (action: NextAction) => Promise<void>
  handleWidgetSubmit: (messageId: string, params: Record<string, unknown>) => Promise<void>
  handleSuggestionSelect: (suggestion: QuickSuggestion) => void
  cancelProcessing: () => void
  // Widget states
  widgetStates: Record<string, Record<string, unknown>>
  handleWidgetStateChange: (messageId: string, key: string, value: unknown) => void
  // Skill panel
  skillPanelOpen: boolean
  setSkillPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  // Config passthrough
  quickSuggestions: QuickSuggestion[]
  serverUrl: string
  tenantId: string
  apiKey?: string
}

export interface ChatCoreProviderProps {
  serverUrl: string
  tenantId: string
  sessionTemplate?: string
  sessionContext?: Record<string, unknown>
  quickSuggestions?: QuickSuggestion[]
  userId?: string
  sessionId?: string
  apiKey?: string
  onMessageSent?: () => void
  /** External controlled skill panel open state */
  skillPanelOpen?: boolean
  /** External callback when skill panel open state changes */
  onSkillPanelChange?: (open: boolean) => void
  children: ReactNode
}

const ChatCoreCtx = createContext<ChatCoreContextValue | null>(null)

export function ChatCoreProvider({
  serverUrl,
  tenantId,
  sessionTemplate,
  sessionContext = {},
  quickSuggestions = [],
  userId,
  sessionId: externalSessionId,
  apiKey,
  onMessageSent,
  skillPanelOpen: externalSkillPanelOpen,
  onSkillPanelChange,
  children,
}: ChatCoreProviderProps) {
  const [input, setInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [widgetStates, setWidgetStates] = useState<Record<string, Record<string, unknown>>>({})
  const [internalSkillPanelOpen, setInternalSkillPanelOpen] = useState(false)

  // Controlled component pattern: external prop takes priority
  const skillPanelOpen = externalSkillPanelOpen ?? internalSkillPanelOpen
  const setSkillPanelOpen = useCallback((open: boolean | ((prev: boolean) => boolean)) => {
    const newValue = typeof open === 'function' ? open(externalSkillPanelOpen ?? internalSkillPanelOpen) : open
    if (onSkillPanelChange) {
      onSkillPanelChange(newValue)
    } else {
      setInternalSkillPanelOpen(newValue)
    }
  }, [onSkillPanelChange, externalSkillPanelOpen, internalSkillPanelOpen])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const connection = useAgentConnection({
    serverUrl,
    tenantId,
    autoConnect: true,
    transport: 'sse',
    sessionId: externalSessionId,
    userId,
    apiKey,
  })

  const chat = useAgentChat({
    connection,
    tenantId,
    sessionTemplate,
    transport: 'sse',
    userId,
  })

  const status = useAgentStatus({ connection })

  const { sendMessage, isProcessing, messages, isLoadingHistory, currentStreamContent, cancelProcessing } = chat

  // Convert react-sdk messages to ChatMessage format
  useEffect(() => {
    const converted: ChatMessage[] = messages.map((msg) => {
      const contentText = msg.content || ''
      const isStreaming = msg.isStreaming ?? false

      let contentBlocks: ContentBlock[]
      let nextActions: NextAction[] | undefined

      // Check for react-sdk contentBlocks containing widget tool calls
      // react-sdk Message exposes contentBlocks (TextBlock | ToolBlock) — access via
      // property check since chat-interface doesn't depend on the exact SDK Message type
      const rawBlocks = 'contentBlocks' in msg ? (msg as unknown as Record<string, unknown>).contentBlocks : undefined
      const sdkBlocks = Array.isArray(rawBlocks) && rawBlocks.every(
        (b: unknown) => typeof b === 'object' && b !== null && 'type' in b,
      )
        ? (rawBlocks as Array<{ type: string; text?: string; content?: string; thinkingId?: string; isComplete?: boolean; tool?: { toolName: string; toolId: string; toolInput?: unknown; toolOutput?: unknown; toolError?: string; description?: string; success?: boolean; duration?: number; phase: string } }>)
        : undefined
      if (msg.role === 'assistant' && sdkBlocks && sdkBlocks.length > 0) {
        // Tool-as-Widget path: build interleaved text + widget blocks from SDK contentBlocks
        const result = buildContentBlocksFromSdkBlocks(sdkBlocks, isStreaming)
        contentBlocks = result.contentBlocks
        nextActions = result.nextActions
      } else if (msg.role === 'assistant' && contentText) {
        // Phase 1 path: parse text for ```widget/```file fenced blocks
        contentBlocks = parseAssistantContent(contentText, isStreaming)
      } else if (contentText) {
        contentBlocks = [{ type: 'text', content: contentText }]
      } else {
        contentBlocks = []
      }

      return {
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        timestamp: msg.createdAt ?? new Date().toISOString(),
        content: contentBlocks,
        isStreaming: isStreaming && msg.role === 'assistant',
        nextActions,
      }
    })
    setChatMessages(converted)
  }, [messages])

  // Throttled auto-scroll to bottom
  useEffect(() => {
    clearTimeout(scrollTimeoutRef.current)
    scrollTimeoutRef.current = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
    return () => clearTimeout(scrollTimeoutRef.current)
  }, [chatMessages, currentStreamContent])

  const onMessageSentRef = useRef(onMessageSent)
  onMessageSentRef.current = onMessageSent

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isProcessing) return
    setInput('')
    try {
      await sendMessage(text)
      onMessageSentRef.current?.()
    } catch (err) {
      setInput(text)
      console.error('Failed to send message:', err)
      toast.error('消息发送失败，请重试')
    }
  }, [input, isProcessing, sendMessage])

  const handleRetry = useCallback(async (messageId: string) => {
    if (isProcessing) return
    const idx = chatMessages.findIndex(m => m.id === messageId)
    for (let i = idx - 1; i >= 0; i--) {
      if (chatMessages[i].role === 'user') {
        const text = chatMessages[i].content
          .filter((b): b is { type: 'text'; content: string } => b.type === 'text')
          .map(b => b.content)
          .join('\n')
        if (text) {
          try {
            await sendMessage(text)
          } catch (err) {
            console.error('Failed to retry message:', err)
            toast.error('重试失败，请重试')
          }
        }
        break
      }
    }
  }, [chatMessages, sendMessage, isProcessing])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isProcessing && !skillPanelOpen) {
        e.preventDefault()
        cancelProcessing()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isProcessing, cancelProcessing, skillPanelOpen])

  const handleSuggestionSelect = useCallback((suggestion: QuickSuggestion) => {
    setInput(suggestion.prompt)
    inputRef.current?.focus()
  }, [])

  const handleAction = useCallback(async (action: NextAction) => {
    try {
      await sendMessage(action.prompt)
    } catch (err) {
      console.error('Failed to send action:', err)
      toast.error('操作执行失败，请重试')
    }
  }, [sendMessage])

  const handleWidgetSubmit = useCallback(async (messageId: string, params: Record<string, unknown>) => {
    try {
      // ActionRow shortcut: send prompt as a chat message directly
      if (params._action === 'send_message' && typeof params.prompt === 'string') {
        await sendMessage(params.prompt)
        return
      }

      await submitToEngine({
        submission: {
          sourceWidgetType: (params._widgetType as string) ?? 'unknown',
          targetSkill: (params._action as string) ?? 'default',
          params,
          context: sessionContext,
        },
        sendMessage,
      })
    } catch (err) {
      console.error('Failed to submit widget:', err)
      toast.error('提交失败，请重试')
    }
  }, [sendMessage, sessionContext])

  const handleWidgetStateChange = useCallback((messageId: string, key: string, value: unknown) => {
    setWidgetStates(prev => ({
      ...prev,
      [messageId]: { ...(prev[messageId] ?? {}), [key]: value },
    }))
  }, [])

  const value = useMemo<ChatCoreContextValue>(() => ({
    sessionReady: connection.sessionReady,
    messages: chatMessages,
    isLoadingHistory,
    isProcessing,
    isThinking: status.isThinking,
    thinkingVerb: status.thinkingVerb,
    input,
    setInput,
    inputRef: inputRef as RefObject<HTMLTextAreaElement>,
    scrollContainerRef: scrollContainerRef as RefObject<HTMLDivElement>,
    messagesEndRef: messagesEndRef as RefObject<HTMLDivElement>,
    handleSend,
    handleRetry,
    handleAction,
    handleWidgetSubmit,
    handleSuggestionSelect,
    cancelProcessing,
    widgetStates,
    handleWidgetStateChange,
    skillPanelOpen,
    setSkillPanelOpen,
    quickSuggestions,
    serverUrl,
    tenantId,
    apiKey,
  }), [
    connection.sessionReady,
    chatMessages,
    isLoadingHistory,
    isProcessing,
    status.isThinking,
    status.thinkingVerb,
    input,
    handleSend,
    handleRetry,
    handleAction,
    handleWidgetSubmit,
    handleSuggestionSelect,
    cancelProcessing,
    widgetStates,
    handleWidgetStateChange,
    skillPanelOpen,
    setSkillPanelOpen,
    quickSuggestions,
    serverUrl,
    tenantId,
    apiKey,
  ])

  return (
    <ChatCoreCtx.Provider value={value}>
      {children}
    </ChatCoreCtx.Provider>
  )
}

export function useChatCore(): ChatCoreContextValue {
  const ctx = useContext(ChatCoreCtx)
  if (!ctx) {
    throw new Error('useChatCore must be used within a ChatCoreProvider')
  }
  return ctx
}
