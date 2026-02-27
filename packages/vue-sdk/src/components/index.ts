/**
 * Vue SFC Components
 *
 * Pre-built UI components for chat, file management, task tracking, and layout.
 * All components use Tailwind CSS for styling.
 */

// Chat Core
export { default as ChatPanel } from './ChatPanel.vue'
export { default as MessageBubble } from './MessageBubble.vue'
export { default as AssistantMessageGroup } from './AssistantMessageGroup.vue'
export { default as AgentActivityLine } from './AgentActivityLine.vue'
export { default as ThinkingIndicator } from './ThinkingIndicator.vue'
export { default as ToolActivityIndicator } from './ToolActivityIndicator.vue'
export { default as InlineToolCard } from './InlineToolCard.vue'
export { default as SubAgentCard } from './SubAgentCard.vue'
export { default as QuickActions } from './QuickActions.vue'
export { default as TokenBadge } from './TokenBadge.vue'

// Output Sync
export { default as OutputUpdateCard } from './OutputUpdateCard.vue'
export { default as DefaultSyncButton } from './DefaultSyncButton.vue'
export { default as SyncCardPanel } from './SyncCardPanel.vue'

// Layout
export { default as ChatSection } from './ChatSection.vue'
export { default as ChatLayoutControls } from './ChatLayoutControls.vue'
export { default as CollapsedChatTab } from './CollapsedChatTab.vue'

// File Management
export { default as FilePanel } from './FilePanel.vue'
export { default as FileList } from './FileList.vue'
export { default as FileListItem } from './FileListItem.vue'
export { default as FilePreview } from './FilePreview.vue'
export { default as FileImagePreview } from './FileImagePreview.vue'
export { default as FileTextPreview } from './FileTextPreview.vue'
export { default as FileUploadButton } from './FileUploadButton.vue'
export { default as FileVersionHistory } from './FileVersionHistory.vue'
export { default as FileVersionCompare } from './FileVersionCompare.vue'

// Tasks & Queue
export { default as TasksView } from './TasksView.vue'
export { default as TasksHeader } from './TasksHeader.vue'
export { default as TasksList } from './TasksList.vue'
export { default as UnifiedTaskCard } from './UnifiedTaskCard.vue'
export { default as QueueStatusIndicator } from './QueueStatusIndicator.vue'
