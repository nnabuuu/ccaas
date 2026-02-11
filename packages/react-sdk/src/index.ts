/**
 * @ccaas/react-sdk
 *
 * React hooks and utilities for integrating with Claude-Code-as-a-Service backend.
 *
 * @packageDocumentation
 */

// Hooks
export { useAgentConnection } from './hooks/useAgentConnection'
export { useAgentChat } from './hooks/useAgentChat'
export { useAgentStatus } from './hooks/useAgentStatus'
export { useOutputSync } from './hooks/useOutputSync'
export { useSkills } from './hooks/useSkills'
export { useChatLayout } from './hooks/useChatLayout'
export { usePageContext } from './hooks/usePageContext'

// Components
export { ChatPanel } from './components/ChatPanel'
export { MessageBubble } from './components/MessageBubble'
export { InlineToolCard } from './components/InlineToolCard'
export { AgentActivityLine } from './components/AgentActivityLine'
export { ThinkingIndicator } from './components/ThinkingIndicator'
export { ToolActivityIndicator } from './components/ToolActivityIndicator'
export { ChatLayoutControls } from './components/ChatLayoutControls'
export { CollapsedChatTab } from './components/CollapsedChatTab'
export { ChatSection } from './components/ChatSection'
export { SubAgentCard } from './components/SubAgentCard'
export { OutputUpdateCard } from './components/OutputUpdateCard'
export { QuickActions } from './components/QuickActions'

// Utilities
export { parseOutputUpdate } from './utils/parseOutputUpdate'
export { createApiClient, ApiError } from './utils/apiClient'

// Non-type exports from types (COLOR_MAP)
export { COLOR_MAP } from './types'

// Types
export type {
  // Hook option/return types
  UseAgentConnectionOptions,
  UseAgentConnectionReturn,
  UseAgentChatOptions,
  UseAgentChatReturn,
  SendMessageOptions,
  UseAgentStatusOptions,
  UseAgentStatusReturn,
  AgentStatusValue,
  UseOutputSyncOptions,
  UseOutputSyncReturn,
  UseSkillsOptions,
  UseSkillsReturn,
  UseChatLayoutReturn,

  // Common data types
  Message,
  ContentBlock,
  TextBlock,
  ToolBlock,
  ToolActivity,
  OutputUpdate,
  UndoEntry,
  SolutionConfig,
  McpServerConfig,
  TodoStats,
  PageContext,

  // Color scheme and layout types
  ColorScheme,
  ColorClasses,
  ChatLayoutMode,

  // Component prop types
  ChatPanelProps,
  MessageBubbleProps,
  ChatSectionProps,

  // API types
  ApiClientOptions,
  CompletionParams,
} from './types'

// Component-specific prop types
export type { AgentActivityLineProps } from './components/AgentActivityLine'
export type { ThinkingIndicatorProps } from './components/ThinkingIndicator'
export type { ToolActivityIndicatorProps } from './components/ToolActivityIndicator'
export type { ChatLayoutControlsProps } from './components/ChatLayoutControls'
export type { CollapsedChatTabProps } from './components/CollapsedChatTab'
export type { SubAgentCardProps } from './components/SubAgentCard'
export type { OutputUpdateCardProps } from './components/OutputUpdateCard'
export type { QuickAction, QuickActionsProps } from './components/QuickActions'

// Re-export commonly used @ccaas/common types for convenience
export type {
  TextDeltaEvent,
  OutputUpdateEvent,
  AgentStatusEvent,
  ToolActivityEvent,
  AgentThinkingEvent,
  TokenUsageEvent,
  TodoUpdateEvent,
  TodoUpdatePayload,
  Skill,
  ActiveSubAgent,
} from '@ccaas/common'

export type { EventTodoItem as TodoItem } from '@ccaas/common'
