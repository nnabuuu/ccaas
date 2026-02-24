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

// Chat Integration
export { useAgentChat } from './useAgentChat'
export type { UseAgentChatOptions, UseAgentChatReturn } from './useAgentChat'

// HTTP Streaming (SSE) - No WebSocket required
export { useSseChat } from './useSseChat'
export type { UseSseChatOptions, UseSseChatReturn, SseChatMessage } from './useSseChat'

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
