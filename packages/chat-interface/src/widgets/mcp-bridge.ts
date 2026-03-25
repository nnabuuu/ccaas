/**
 * MCP Bridge — data hydration via backend MCP proxy.
 */
export interface McpBridge {
  callMcp: (toolName: string, params: Record<string, unknown>) => Promise<unknown>
}

export interface CreateMcpBridgeOptions {
  serverUrl: string
  tenantId: string
}

/**
 * Create a real MCP bridge that calls backend `/api/v1/mcp/call`.
 * Falls back gracefully if the endpoint is not available.
 */
export function createMcpBridge(options: CreateMcpBridgeOptions): McpBridge {
  const { serverUrl, tenantId } = options
  return {
    callMcp: async (toolName: string, params: Record<string, unknown>) => {
      const response = await fetch(`${serverUrl}/api/v1/mcp/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify({ toolName, params }),
      })
      if (!response.ok) {
        throw new Error(`MCP call failed: ${response.status} ${response.statusText}`)
      }
      return response.json()
    },
  }
}

export function createMockMcpBridge(): McpBridge {
  return {
    callMcp: async (toolName: string, _params: Record<string, unknown>) => {
      console.warn(`[MCP Bridge] Mock call to ${toolName} — returning empty result`)
      return { data: [], message: `Mock result for ${toolName}` }
    },
  }
}
