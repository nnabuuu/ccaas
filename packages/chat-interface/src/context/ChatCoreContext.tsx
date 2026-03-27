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
import { parseAssistantContent } from '@/harness/postprocessor'
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
  children,
}: ChatCoreProviderProps) {
  const [input, setInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [widgetStates, setWidgetStates] = useState<Record<string, Record<string, unknown>>>({})
  const [skillPanelOpen, setSkillPanelOpen] = useState(false)
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
      if (msg.role === 'assistant' && contentText) {
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
