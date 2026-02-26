/**
 * @kedge-agentic/react-sdk
 *
 * React hooks and utilities for integrating with Claude-Code-as-a-Service backend.
 *
 * @packageDocumentation
 */

// Hooks
export { useAgentConnection } from './hooks/useAgentConnection'
export { useAgentChat } from './hooks/useAgentChat'
export { useSseStream } from './hooks/useSseStream'
export { useAgentStatus } from './hooks/useAgentStatus'
export { useQueueStatus } from './hooks/useQueueStatus'
export { useOutputSync } from './hooks/useOutputSync'
export { useSkills } from './hooks/useSkills'
export { useChatLayout } from './hooks/useChatLayout'
export { usePageContext } from './hooks/usePageContext'
export { useFiles } from './hooks/useFiles'
export { useFileVersions } from './hooks/useFileVersions'
export { useFilePreview, clearPreviewCache } from './hooks/useFilePreview'
export { useTaskTracking } from './hooks/useTaskTracking'
export { useMessageSplitter } from './hooks/useMessageSplitter'
export { useTurns } from './hooks/useTurns'
export { useFileContent } from './hooks/useFileContent'
export { useWorkspaceTree } from './hooks/useWorkspaceTree'

// Components
export { ChatPanel } from './components/ChatPanel'
export { MessageBubble } from './components/MessageBubble'
export { InlineToolCard } from './components/InlineToolCard'
export { AssistantMessageGroup } from './components/AssistantMessageGroup'
export { DefaultSyncButton } from './components/DefaultSyncButton'
export { AgentActivityLine } from './components/AgentActivityLine'
export { ThinkingIndicator } from './components/ThinkingIndicator'
export { ToolActivityIndicator } from './components/ToolActivityIndicator'
export { ChatLayoutControls } from './components/ChatLayoutControls'
export { CollapsedChatTab } from './components/CollapsedChatTab'
export { ChatSection } from './components/ChatSection'
export { SubAgentCard } from './components/SubAgentCard'
export { OutputUpdateCard } from './components/OutputUpdateCard'
export { QuickActions } from './components/QuickActions'
export { TokenBadge } from './components/TokenBadge'
export { SyncCardPanel } from './components/SyncCardPanel'
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
export { QueueStatusIndicator } from './components/QueueStatusIndicator'

// Utilities
export { parseOutputUpdate } from './utils/parseOutputUpdate'
export { createApiClient, ApiError } from './utils/apiClient'
export { getFileIcon, formatFileSize, formatFileDate } from './utils/fileIcons'
export { computeLineDiff, formatSizeDiff, getDiffColor } from './utils/diffUtils'
export { formatDuration, formatDurationCompact } from './utils/formatDuration'
export { getToolActivityDescription, TOOL_ACTIVITY_MAP } from './utils/toolActivityMapping'
export { getThinkingVerb, THINKING_VERBS } from './utils/thinkingVerbs'
// templateResolver: functions removed — template resolution now happens server-side

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
  UseMessageSplitterOptions,
  UseMessageSplitterReturn,

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
  TokenUsage,

  // Message splitting types
  SegmentType,
  DisplaySegment,
  SplitMessage,

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
export type { AssistantMessageGroupProps } from './components/AssistantMessageGroup'
export type { DefaultSyncButtonProps } from './components/DefaultSyncButton'
export type { AgentActivityLineProps } from './components/AgentActivityLine'
export type { ThinkingIndicatorProps } from './components/ThinkingIndicator'
export type { ToolActivityIndicatorProps } from './components/ToolActivityIndicator'
export type { ChatLayoutControlsProps } from './components/ChatLayoutControls'
export type { CollapsedChatTabProps } from './components/CollapsedChatTab'
export type { SubAgentCardProps } from './components/SubAgentCard'
export type { OutputUpdateCardProps } from './components/OutputUpdateCard'
export type { QuickAction, QuickActionsProps } from './components/QuickActions'
export type { TokenBadgeProps } from './components/TokenBadge'
export type { SyncCardPanelProps } from './components/SyncCardPanel'
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
export type { QueueStatusIndicatorProps } from './components/QueueStatusIndicator'

// Turns hook types
export type { Turn, UseTurnsOptions, UseTurnsReturn } from './hooks/useTurns'

// Workspace file access hook types
export type {
  FileContentData,
  UseFileContentOptions,
  UseFileContentReturn,
} from './hooks/useFileContent'
export type {
  WorkspaceFileTreeNode,
  UseWorkspaceTreeOptions,
  UseWorkspaceTreeReturn,
} from './hooks/useWorkspaceTree'

// Template resolver types
export type {
  ResolvedTemplateParams,
} from './utils/templateResolver'

// Re-export commonly used @kedge-agentic/common types for convenience
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
  SessionTemplate,
  SessionTemplateMap,
} from '@kedge-agentic/common'

export type { EventTodoItem as TodoItem } from '@kedge-agentic/common'

// Queue status hook types
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
} from './hooks/useQueueStatus'
