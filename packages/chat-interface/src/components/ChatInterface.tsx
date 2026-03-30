import {
  ChatInterfaceRoot,
  ChatInterfaceToaster,
  ChatInterfaceContextBar,
  ChatInterfaceSkillPanel,
  ChatInterfaceMessages,
  ChatInterfaceEmptyState,
  ChatInterfaceQuickSuggestions,
  ChatInterfaceComposer,
} from './chat'
import type { SessionContextChip } from '@/types/session-context'
import type { QuickSuggestion } from '@/types/chat'
import type { WidgetRegistry, BlockRendererMap } from '@/types/widget'
import type { WidgetCatalogEntry } from '@/widgets/catalog'
import type { McpBridge } from '@/widgets/mcp-bridge'

export interface ChatInterfaceProps {
  serverUrl: string
  tenantId: string
  sessionTemplate?: string
  contextChips?: SessionContextChip[]
  quickSuggestions?: QuickSuggestion[]
  sessionContext?: Record<string, unknown>
  onChipClick?: (chip: SessionContextChip) => void
  customWidgets?: WidgetRegistry
  customCatalog?: WidgetCatalogEntry[]
  customBlockRenderers?: BlockRendererMap
  mcpBridge?: McpBridge
  userId?: string
  sessionId?: string
  /** API key for X-API-Key header authentication */
  apiKey?: string
  onMenuClick?: () => void
  onMessageSent?: () => void
  /** Extra trailing content inserted before the "技能" button in the context bar */
  contextBarTrailing?: React.ReactNode
  /** Hide the built-in skill toggle button in the context bar */
  hideSkillToggle?: boolean
}

export function ChatInterface({
  serverUrl,
  tenantId,
  sessionTemplate,
  contextChips = [],
  quickSuggestions = [],
  sessionContext = {},
  onChipClick,
  customWidgets,
  customCatalog,
  customBlockRenderers,
  mcpBridge,
  userId,
  sessionId,
  apiKey,
  onMenuClick,
  onMessageSent,
  contextBarTrailing,
  hideSkillToggle,
}: ChatInterfaceProps) {
  return (
    <ChatInterfaceRoot
      serverUrl={serverUrl}
      tenantId={tenantId}
      sessionTemplate={sessionTemplate}
      quickSuggestions={quickSuggestions}
      sessionContext={sessionContext}
      customWidgets={customWidgets}
      customCatalog={customCatalog}
      customBlockRenderers={customBlockRenderers}
      mcpBridge={mcpBridge}
      userId={userId}
      sessionId={sessionId}
      apiKey={apiKey}
      onMessageSent={onMessageSent}
    >
      <ChatInterfaceToaster />
      <ChatInterfaceContextBar
        chips={contextChips}
        onChipClick={onChipClick}
        onMenuClick={onMenuClick}
        trailing={contextBarTrailing}
        hideSkillToggle={hideSkillToggle}
      />
      <ChatInterfaceSkillPanel />
      <ChatInterfaceMessages />
      <ChatInterfaceQuickSuggestions />
      <ChatInterfaceComposer />
    </ChatInterfaceRoot>
  )
}

// Compound component pattern
ChatInterface.Root = ChatInterfaceRoot
ChatInterface.ContextBar = ChatInterfaceContextBar
ChatInterface.SkillPanel = ChatInterfaceSkillPanel
ChatInterface.Messages = ChatInterfaceMessages
ChatInterface.EmptyState = ChatInterfaceEmptyState
ChatInterface.QuickSuggestions = ChatInterfaceQuickSuggestions
ChatInterface.Composer = ChatInterfaceComposer
ChatInterface.Toaster = ChatInterfaceToaster
