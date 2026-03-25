import { useCallback } from 'react'
import { useChatInterfaceContext } from '@/context/ChatInterfaceContext'

export function useMcpBridge() {
  const { mcpBridge } = useChatInterfaceContext()

  const callMcp = useCallback(
    async (toolName: string, params: Record<string, unknown>) => {
      if (!mcpBridge) {
        console.warn('[useMcpBridge] No MCP bridge configured')
        return null
      }
      return mcpBridge.callMcp(toolName, params)
    },
    [mcpBridge],
  )

  return { callMcp, hasBridge: !!mcpBridge }
}
