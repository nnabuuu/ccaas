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
export { useFiles } from './hooks/useFiles'
export { useFileVersions } from './hooks/useFileVersions'
export { useFilePreview, clearPreviewCache } from './hooks/useFilePreview'
export { useTaskTracking } from './hooks/useTaskTracking'

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
export { FilePanel } from './components/FilePanel'
export { FileList } from './components/FileList'
export { FileListItem } from './components/FileListItem'
export { FilePreview } from './components/FilePreview'
export { FileTextPreview } from './components/FileTextPreview'
export { FileImagePreview } from './components/FileImagePreview'
export { FileUploadButton } from './components/FileUploadButton'
export { FileVersionHistory } from './components/FileVersionHistory'
export { FileVersionCompare } from './components/FileVersionCompare'
export { TasksView } from './components/TasksView'
export { TasksHeader } from './components/TasksHeader'
export { TasksList } from './components/TasksList'
export { UnifiedTaskCard } from './components/UnifiedTaskCard'

// Utilities
export { parseOutputUpdate } from './utils/parseOutputUpdate'
export { createApiClient, ApiError } from './utils/apiClient'
export { getFileIcon, formatFileSize, formatFileDate } from './utils/fileIcons'
export { computeLineDiff, formatSizeDiff, getDiffColor } from './utils/diffUtils'

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
  UseFilesOptions,
  UseFilesReturn,
  UseFileVersionsOptions,
  UseFileVersionsReturn,
  UseFilePreviewOptions,
  UseFilePreviewReturn,
  UseTaskTrackingOptions,
  UseTaskTrackingReturn,

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
  UnifiedTask,
  TaskGroups,
  TaskBadgeState,
  FileMetadata,
  FileVersion,
  FilePreviewData,

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
export type { FilePanelProps } from './components/FilePanel'
export type { FileListProps } from './components/FileList'
export type { FileListItemProps } from './components/FileListItem'
export type { FilePreviewProps } from './components/FilePreview'
export type { FileTextPreviewProps } from './components/FileTextPreview'
export type { FileImagePreviewProps } from './components/FileImagePreview'
export type { FileUploadButtonProps } from './components/FileUploadButton'
export type { FileVersionHistoryProps } from './components/FileVersionHistory'
export type { FileVersionCompareProps } from './components/FileVersionCompare'
export type { TasksViewProps } from './components/TasksView'
export type { TasksHeaderProps } from './components/TasksHeader'
export type { TasksListProps } from './components/TasksList'
export type { UnifiedTaskCardProps } from './components/UnifiedTaskCard'

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
