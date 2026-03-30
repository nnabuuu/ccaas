import type { ReactNode } from 'react'
import type { WidgetRegistry, BlockRendererMap } from '@/types/widget'
import type { WidgetCatalogEntry } from '@/widgets/catalog'
import type { McpBridge } from '@/widgets/mcp-bridge'
import type { QuickSuggestion } from '@/types/chat'
import { ChatInterfaceProvider } from '@/context/ChatInterfaceContext'
import { ChatCoreProvider } from '@/context/ChatCoreContext'

export interface ChatInterfaceRootProps {
  // Connection
  serverUrl: string
  tenantId: string
  sessionTemplate?: string
  userId?: string
  sessionId?: string
  apiKey?: string
  // Config
  quickSuggestions?: QuickSuggestion[]
  sessionContext?: Record<string, unknown>
  // Widget/block extensions
  customWidgets?: WidgetRegistry
  customCatalog?: WidgetCatalogEntry[]
  customBlockRenderers?: BlockRendererMap
  mcpBridge?: McpBridge
  // Callbacks
  onMessageSent?: () => void
  // Skill panel controlled state
  skillPanelOpen?: boolean
  onSkillPanelChange?: (open: boolean) => void
  // Layout
  className?: string
  children: ReactNode
}

export function ChatInterfaceRoot({
  serverUrl,
  tenantId,
  sessionTemplate,
  userId,
  sessionId,
  apiKey,
  quickSuggestions,
  sessionContext,
  customWidgets,
  customCatalog,
  customBlockRenderers,
  mcpBridge,
  onMessageSent,
  skillPanelOpen,
  onSkillPanelChange,
  className,
  children,
}: ChatInterfaceRootProps) {
  return (
    <ChatInterfaceProvider
      customWidgets={customWidgets}
      customCatalog={customCatalog}
      customBlockRenderers={customBlockRenderers}
      mcpBridge={mcpBridge}
    >
      <ChatCoreProvider
        serverUrl={serverUrl}
        tenantId={tenantId}
        sessionTemplate={sessionTemplate}
        sessionContext={sessionContext}
        quickSuggestions={quickSuggestions}
        userId={userId}
        sessionId={sessionId}
        apiKey={apiKey}
        onMessageSent={onMessageSent}
        skillPanelOpen={skillPanelOpen}
        onSkillPanelChange={onSkillPanelChange}
      >
        <div className={className ?? 'w-full h-full flex flex-col'}>
          <div className="flex-1 flex flex-col overflow-hidden bg-ck-bg2">
            {children}
          </div>
        </div>
      </ChatCoreProvider>
    </ChatInterfaceProvider>
  )
}
