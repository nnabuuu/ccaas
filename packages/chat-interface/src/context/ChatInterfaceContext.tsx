import { createContext, useContext, useMemo } from 'react'
import type { WidgetRegistry, BlockRendererMap } from '@/types/widget'
import type { WidgetCatalogEntry } from '@/widgets/catalog'
import type { McpBridge } from '@/widgets/mcp-bridge'
import { mergeRegistries, mergeCatalogs } from '@/widgets/merge'

export interface ChatInterfaceContextValue {
  widgetRegistry: WidgetRegistry
  widgetCatalog: WidgetCatalogEntry[]
  blockRenderers: BlockRendererMap
  mcpBridge: McpBridge | null
}

const ChatInterfaceCtx = createContext<ChatInterfaceContextValue | null>(null)

export interface ChatInterfaceProviderProps {
  customWidgets?: WidgetRegistry
  customCatalog?: WidgetCatalogEntry[]
  customBlockRenderers?: BlockRendererMap
  mcpBridge?: McpBridge
  children: React.ReactNode
}

export function ChatInterfaceProvider({
  customWidgets,
  customCatalog,
  customBlockRenderers,
  mcpBridge,
  children,
}: ChatInterfaceProviderProps) {
  const value = useMemo<ChatInterfaceContextValue>(() => ({
    widgetRegistry: mergeRegistries(customWidgets),
    widgetCatalog: mergeCatalogs(customCatalog),
    blockRenderers: customBlockRenderers ?? {},
    mcpBridge: mcpBridge ?? null,
  }), [customWidgets, customCatalog, customBlockRenderers, mcpBridge])

  return (
    <ChatInterfaceCtx.Provider value={value}>
      {children}
    </ChatInterfaceCtx.Provider>
  )
}

export function useChatInterfaceContext(): ChatInterfaceContextValue {
  const ctx = useContext(ChatInterfaceCtx)
  if (!ctx) {
    throw new Error('useChatInterfaceContext must be used within a ChatInterfaceProvider')
  }
  return ctx
}
