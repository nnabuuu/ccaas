/**
 * Composables
 *
 * Barrel export for all Vue composables.
 */

export { useFormBridge } from './useFormBridge'
export type { UseFormBridgeOptions, UseFormBridgeReturn } from './useFormBridge'

export { useAIEditing } from './useAIEditing'
export type { UseAIEditingOptions, UseAIEditingReturn } from './useAIEditing'

export { usePlanMode } from './usePlanMode'
export type { UsePlanModeReturn } from './usePlanMode'

export { useAgentState } from './useAgentState'
export type { UseAgentStateReturn } from './useAgentState'

export { useTodoProgress } from './useTodoProgress'
export type { UseTodoProgressReturn } from './useTodoProgress'

export { useToolActivity } from './useToolActivity'
export type { UseToolActivityReturn } from './useToolActivity'

// Phase 1.6: Enhanced Event Transparency
export { useThinking } from './useThinking'
export type { UseThinkingReturn } from './useThinking'

export { useExploration } from './useExploration'
export type {
  UseExplorationReturn,
  ExplorationActivity,
  ExplorationHistoryEntry,
} from './useExploration'

export { useTokenUsage } from './useTokenUsage'
export type { UseTokenUsageReturn, SessionTokens } from './useTokenUsage'

// Connection Management (SSE-first)
export { useAgentConnection } from './useAgentConnection'
export type { UseAgentConnectionOptions, UseAgentConnectionReturn } from '../types/connection'

// Chat Integration
export { useAgentChat } from './useAgentChat'
export type { UseAgentChatOptions, UseAgentChatReturn } from './useAgentChat'

// HTTP Streaming (SSE) - No WebSocket required
export { useSseChat } from './useSseChat'
export type { UseSseChatOptions, UseSseChatReturn, SseChatMessage } from './useSseChat'

// Full-featured SSE Chat (recommended for new solutions)
export { useAgentChatSse } from './useAgentChatSse'

// Low-level SSE Stream
export { useSseStream } from './useSseStream'

export { useEntityBridge } from './useEntityBridge'
export type { UseEntityBridgeReturn } from './useEntityBridge'

// Generic Output Sync
export { useOutputSync } from './useOutputSync'

// Skills Management
export { useSkills } from './useSkills'

// Workspace File Access
export { useFileContent } from './useFileContent'
export type { UseFileContentOptions, UseFileContentReturn, FileContentData } from './useFileContent'

export { useWorkspaceTree } from './useWorkspaceTree'
export type { UseWorkspaceTreeOptions, UseWorkspaceTreeReturn, WorkspaceFileTreeNode } from './useWorkspaceTree'

// Chat Layout
export { useChatLayout } from './useChatLayout'

// Queue Status Monitoring
export { useQueueStatus } from './useQueueStatus'
export type {
  QueueItemStatus,
  QueueItem,
  QueueDepth,
  MessageProcessingStartedEvent,
  MessageProcessingCompletedEvent,
  MessageProcessingFailedEvent,
  QueueStatusEvent,
  ProcessingStatus,
  UseQueueStatusOptions,
  UseQueueStatusReturn,
} from './useQueueStatus'

// Per-Turn Metrics
export { useTurns } from './useTurns'
export type { Turn, UseTurnsOptions, UseTurnsReturn } from './useTurns'

// Agent Status Tracking (SSE-first)
export { useAgentStatus } from './useAgentStatus'
export type {
  AgentStatusValue,
  UseAgentStatusOptions,
  UseAgentStatusReturn,
} from './useAgentStatus'

// Page Context Management
export { usePageContext } from './usePageContext'
export type { UsePageContextReturn } from './usePageContext'

// File Management
export { useFiles } from './useFiles'

export { useFileVersions } from './useFileVersions'

export { useFilePreview, clearPreviewCache } from './useFilePreview'

// Task Tracking
export { useTaskTracking } from './useTaskTracking'

// Message Splitting
export { useMessageSplitter } from './useMessageSplitter'
export type {
  UseMessageSplitterOptions,
  UseMessageSplitterReturn,
} from './useMessageSplitter'
