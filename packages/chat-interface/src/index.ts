/**
 * @kedge-agentic/chat-interface
 *
 * Extensible chat UI component library.
 * Use as a standalone app or embed in solution projects.
 *
 * @packageDocumentation
 */

// === Components ===
export { ChatInterface } from './components/ChatInterface'
export type { ChatInterfaceProps } from './components/ChatInterface'
export { ChatSidebar } from './components/ChatSidebar'
export type { ChatSidebarProps, SidebarSession, SidebarSkillItem } from './components/ChatSidebar'
export { MessageRenderer } from './components/MessageRenderer'
export { WidgetRenderer } from './components/WidgetRenderer'
export { SessionContextBar } from './components/SessionContextBar'
export { SkillBadge } from './components/SkillBadge'
export { FileCard } from './components/FileCard'
export { NextActions } from './components/NextActions'
export { ToolActivityBlock } from './components/ToolActivityBlock'
export { ThinkingBlockView } from './components/ThinkingBlockView'
export { ToolGroup } from './components/ToolGroup'
export type { ToolGroupData } from './components/ToolGroup'
export { QuickSuggestions } from './components/QuickSuggestions'
export { SkillPanel } from './components/SkillPanel'
export type { SkillPanelProps } from './components/SkillPanel'
export { Tooltip } from './components/Tooltip'
export { ScrollToBottom } from './components/ScrollToBottom'
export { MermaidBlock } from './components/MermaidBlock'

// === Compound Sub-components ===
export {
  ChatInterfaceRoot,
  ChatInterfaceContextBar,
  ChatInterfaceSkillPanel,
  ChatInterfaceMessages,
  ChatInterfaceEmptyState,
  ChatInterfaceQuickSuggestions,
  ChatInterfaceComposer,
  ChatInterfaceToaster,
} from './components/chat'
export type {
  ChatInterfaceRootProps,
  ChatInterfaceContextBarProps,
  ChatInterfaceMessagesProps,
  ChatInterfaceEmptyStateProps,
  ChatInterfaceQuickSuggestionsProps,
  ChatInterfaceComposerProps,
  ChatInterfaceToasterProps,
} from './components/chat'

// === Context ===
export { ChatInterfaceProvider, useChatInterfaceContext } from './context/ChatInterfaceContext'
export type { ChatInterfaceProviderProps, ChatInterfaceContextValue } from './context/ChatInterfaceContext'
export { ChatCoreProvider, useChatCore } from './context/ChatCoreContext'
export type { ChatCoreProviderProps, ChatCoreContextValue } from './context/ChatCoreContext'

// === Hooks ===
export { useAuth } from './hooks/useAuth'
export type { UseAuthReturn } from './hooks/useAuth'
export { useSessionList } from './hooks/useSessionList'
export { useSessionContext } from './hooks/useSessionContext'
export { useQuickSuggestions } from './hooks/useQuickSuggestions'
export { useWidgetState } from './hooks/useWidgetState'
export { useMcpBridge } from './hooks/useMcpBridge'

// === Widget System ===
export { builtinRegistry, getWidgetComponent, getRegisteredWidgetTypes } from './widgets/registry'
export { builtinCatalog, widgetCatalog, getWidgetCatalogPrompt } from './widgets/catalog'
export type { WidgetCatalogEntry, PropSchema } from './widgets/catalog'
export { mergeRegistries, mergeCatalogs } from './widgets/merge'
export { createMockMcpBridge, createMcpBridge } from './widgets/mcp-bridge'
export type { McpBridge } from './widgets/mcp-bridge'

// === Widget Components ===
export { StepWizard } from './widgets/components/StepWizard'
export { FormCollect } from './widgets/components/FormCollect'
export { TreeSelector } from './widgets/components/TreeSelector'
export { BarList } from './widgets/components/BarList'
export { ReviewPanel } from './widgets/components/ReviewPanel'
export { MetricDashboard } from './widgets/components/MetricDashboard'
export { Summary } from './widgets/components/Summary'

// === Harness ===
export { parseAssistantContent, parseLlmResponse, extractNextActions, buildContentBlocksFromSdkBlocks } from './harness/postprocessor'
export { stripMcpPrefix, getToolSummary } from './components/ToolActivityBlock'
export { submitToEngine, buildSubmissionPayload } from './harness/submit-engine'
export type { SubmitToEngineOptions } from './harness/submit-engine'
export { buildAppendPrompt, sessionContextToPrompt } from './harness/preprocessor'

// === Types ===
export type {
  JsonRenderSpec,
  JsonRenderElement,
  McpSourceDeclaration,
  WidgetComponentProps,
  WidgetComponent,
  WidgetRegistry,
  BlockRenderer,
  BlockRendererMap,
  ToolRenderer,
  ToolRendererMap,
} from './types/widget'

export type {
  ChatMessage,
  ContentBlock,
  CustomBlock,
  TextBlock,
  WidgetBlock,
  FileBlock,
  McpResultBlock,
  ToolUseBlock,
  ThinkingBlock,
  NextAction,
  QuickSuggestion,
  EngineSubmission,
} from './types/chat'

export type {
  SessionContext,
  SessionContextChip,
} from './types/session-context'
