/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, useCallback } from 'react'
import { useCustom } from '@refinedev/core'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Cable, Wifi } from 'lucide-react'
import { useAdminSocket } from '@/hooks/use-admin-socket'
import { formatDistanceToNow } from 'date-fns'

interface SdkConnection {
  id: string
  sdkType: string
  sdkVersion: string
  tenantId: string
  solutionName?: string
  connectedAt: string
}

interface SdkConnectionsProps {
  tenantId?: string
}

export function SdkConnections({ tenantId }: SdkConnectionsProps) {
  const { on } = useAdminSocket()

  const query = tenantId ? { tenantId } : undefined
  const { data, isLoading } = useCustom({
    url: '/admin/sdk-connections',
    method: 'get',
    config: { query },
  })

  // Track connections with real-time updates via socket
  // Initial state is derived from API data
  const [connections, setConnections] = useState<SdkConnection[]>(() => {
    const raw = data?.data
    const list = (Array.isArray(raw) ? raw : (raw as { connections?: SdkConnection[] })?.connections ?? []) as SdkConnection[]
    return tenantId ? list.filter((c) => c.tenantId === tenantId) : list
  })

  const handleConnected = useCallback(
    (conn: unknown) => {
      const newConn = conn as SdkConnection
      if (tenantId && newConn.tenantId !== tenantId) return
      setConnections((prev) => [...prev.filter((c) => c.id !== newConn.id), newConn])
    },
    [tenantId],
  )

  const handleDisconnected = useCallback(
    (payload: unknown) => {
      const { id } = payload as { id: string }
      setConnections((prev) => prev.filter((c) => c.id !== id))
    },
    [],
  )

  useEffect(() => {
    const offConnect = on('admin:sdk_connected', handleConnected)
    const offDisconnect = on('admin:sdk_disconnected', handleDisconnected)
    return () => {
      offConnect()
      offDisconnect()
    }
  }, [on, handleConnected, handleDisconnected])

  const sdkTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'vue':
        return 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
      case 'react':
        return 'bg-blue-500/10 text-blue-700 border-blue-200'
      case 'vanilla':
        return 'bg-amber-500/10 text-amber-700 border-amber-200'
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-200'
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-32 text-muted-foreground">Loading connections...</div>
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Cable className="h-4 w-4" />
          SDK Connections
        </CardTitle>
        <Badge variant={connections.length > 0 ? 'success' : 'secondary'}>
          {connections.length} connected
        </Badge>
      </CardHeader>
      <CardContent>
        {connections.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="flex flex-col gap-2 rounded-lg border p-3"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={sdkTypeColor(conn.sdkType)}>
                    {conn.sdkType}
                  </Badge>
                  <div className="flex items-center gap-1 text-emerald-600">
                    <Wifi className="h-3 w-3" />
                    <span className="text-xs">Live</span>
                  </div>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Version</span>
                    <span className="font-mono">{conn.sdkVersion}</span>
                  </div>
                  {conn.solutionName && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Solution</span>
                      <span className="truncate ml-2">{conn.solutionName}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tenant</span>
                    <span className="font-mono truncate ml-2">{conn.tenantId.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Connected</span>
                    <span>{formatDistanceToNow(new Date(conn.connectedAt), { addSuffix: true })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <WifiOff className="h-8 w-8" />
            <p className="text-sm">No SDK clients currently connected</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Aggregates SDK connections by sdkType for dashboard widget use.
 */
export function useSdkDistribution() {
  const { on } = useAdminSocket()

  const { data } = useCustom({
    url: '/admin/sdk-connections',
    method: 'get',
  })

  // Track connections with real-time updates via socket
  // Initial state is derived from API data
  const [connections, setConnections] = useState<SdkConnection[]>(() => {
    const raw = data?.data
    const list = (Array.isArray(raw) ? raw : (raw as { connections?: SdkConnection[] })?.connections ?? []) as SdkConnection[]
    return list
  })

  useEffect(() => {
    const offConnect = on('admin:sdk_connected', (conn: unknown) => {
      const c = conn as SdkConnection
      setConnections((prev) => [...prev.filter((p) => p.id !== c.id), c])
    })
    const offDisconnect = on('admin:sdk_disconnected', (payload: unknown) => {
      const { id } = payload as { id: string }
      setConnections((prev) => prev.filter((p) => p.id !== id))
    })
    return () => {
      offConnect()
      offDisconnect()
    }
  }, [on])

  const distribution = connections.reduce<Record<string, number>>((acc, c) => {
    acc[c.sdkType] = (acc[c.sdkType] || 0) + 1
    return acc
  }, {})

  return {
    total: connections.length,
    distribution: Object.entries(distribution).map(([name, value]) => ({ name, value })),
  }
}
