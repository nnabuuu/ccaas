import { useState, useMemo, useCallback } from 'react'
import { useCustom } from '@refinedev/core'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import type { LucideIcon } from 'lucide-react'
import { DataTable } from '@/components/shared/data-table'
import { StatCard } from '@/components/shared/stat-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { useTenantContext } from '@/hooks/use-tenant-context'
import { formatDistanceToNow } from 'date-fns'
import { Activity, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { formatDuration } from '@/lib/format'

interface SessionItem {
  sessionId: string
  tenantId: string | null
  clientId: string
  status: string
  messageCount: number
  createdAt: string
  lastActivity: string
  hasActiveProcess: boolean
}

type TabValue = 'all' | 'active' | 'error' | 'long_running' | 'completed'

export function SessionListPage() {
  const navigate = useNavigate()
  const { selectedTenantId } = useTenantContext()
  const [page, setPage] = useState(0)
  const [tab, setTab] = useState<TabValue>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const endpoint = '/admin/sessions'

  const { data, isLoading, error, refetch } = useCustom({
    url: endpoint,
    method: 'get',
    config: {
      query: {
        offset: page * 20,
        limit: 20,
        ...(selectedTenantId ? { tenantId: selectedTenantId } : {}),
      },
    },
  })

  const result = data?.data as
    | {
        items?: SessionItem[]
        sessions?: SessionItem[]
        data?: SessionItem[]
        total?: number
        pagination?: { total: number }
      }
    | SessionItem[]
    | undefined

  const allSessions = Array.isArray(result)
    ? result
    : (result?.items ?? result?.sessions ?? result?.data ?? [])

  const total = Array.isArray(result)
    ? result.length
    : (result?.total ?? result?.pagination?.total ?? allSessions.length)

  // Filter sessions based on tab and search
  const sessions = useMemo(() => {
    let filtered = allSessions

    // Tab filtering
    if (tab === 'active') {
      filtered = filtered.filter((s) => s.status === 'processing' || s.hasActiveProcess)
    } else if (tab === 'error') {
      filtered = filtered.filter((s) => s.status === 'error')
    } else if (tab === 'long_running') {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      filtered = filtered.filter(
        (s) =>
          (s.status === 'processing' || s.hasActiveProcess) &&
          new Date(s.createdAt) < oneHourAgo
      )
    } else if (tab === 'completed') {
      filtered = filtered.filter((s) => s.status === 'closed' || s.status === 'completed')
    }

    // Search filtering
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (s) =>
          s.sessionId.toLowerCase().includes(query) ||
          s.clientId?.toLowerCase().includes(query) ||
          s.tenantId?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [allSessions, tab, searchQuery])

  // Calculate KPIs
  const kpis = useMemo(() => {
    const activeSessions = allSessions.filter(
      (s) => s.status === 'processing' || s.hasActiveProcess
    ).length
    const completedLast24h = allSessions.filter((s) => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      return (
        (s.status === 'closed' || s.status === 'completed') &&
        new Date(s.lastActivity) > oneDayAgo
      )
    }).length
    const errorRate =
      allSessions.length > 0
        ? ((allSessions.filter((s) => s.status === 'error').length / allSessions.length) * 100).toFixed(1)
        : '0.0'

    // Calculate average duration (createdAt to lastActivity)
    const durations = allSessions
      .filter((s) => s.status === 'closed' || s.status === 'completed')
      .map((s) => new Date(s.lastActivity).getTime() - new Date(s.createdAt).getTime())
    const avgDuration =
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0

    return {
      activeSessions,
      completedLast24h,
      errorRate,
      avgDuration: formatDuration(avgDuration),
    }
  }, [allSessions])

  // Copy session ID with error handling
  const handleCopySessionId = useCallback(async (sessionId: string) => {
    try {
      await navigator.clipboard.writeText(sessionId)
      // TODO: Replace with toast notification
    } catch (error) {
      console.warn('Failed to copy session ID:', error)
    }
  }, [])

  // Memoize columns to prevent re-creation on every render
  const columns = useMemo<ColumnDef<SessionItem>[]>(
    () => [
      {
        accessorKey: 'sessionId',
        header: 'Session ID',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs">{row.original.sessionId.slice(0, 12)}...</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                handleCopySessionId(row.original.sessionId)
              }}
              aria-label="Copy session ID"
            >
              Copy
            </Button>
          </div>
        ),
      },
      {
        accessorKey: 'tenantId',
        header: 'Tenant',
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.tenantId ? row.original.tenantId.slice(0, 12) + '...' : 'N/A'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'messageCount',
        header: 'Messages',
        cell: ({ row }) => <span>{row.original.messageCount}</span>,
      },
      {
        accessorKey: 'duration',
        header: 'Duration',
        cell: ({ row }) => {
          const durationMs =
            new Date(row.original.lastActivity).getTime() -
            new Date(row.original.createdAt).getTime()
          return <span className="text-xs">{formatDuration(durationMs)}</span>
        },
      },
      {
        accessorKey: 'lastActivity',
        header: 'Last Activity',
        cell: ({ row }) => (
          <span className="text-xs">
            {formatDistanceToNow(new Date(row.original.lastActivity), { addSuffix: true })}
          </span>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/sessions/${row.original.sessionId}`)}
          >
            View Details
          </Button>
        ),
      },
    ],
    [navigate, handleCopySessionId]
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Sessions</h1>
      </div>

      {/* KPI Cards - Using shared StatCard component */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Active Sessions"
          value={kpis.activeSessions}
          icon={Activity}
          description="Currently running or processing"
        />
        <StatCard
          title="Completed (24h)"
          value={kpis.completedLast24h}
          icon={CheckCircle}
          description="Successfully finished"
        />
        <StatCard
          title="Error Rate"
          value={`${kpis.errorRate}%`}
          icon={AlertCircle}
          description="Sessions with errors"
        />
        <StatCard
          title="Avg Duration"
          value={kpis.avgDuration}
          icon={Clock}
          description="For completed sessions"
        />
      </div>

      {/* Tabs and Search */}
      <div className="space-y-4">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as TabValue)
            setPage(0)
          }}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="error">Error</TabsTrigger>
            <TabsTrigger value="long_running">Long Running</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-4">
          <Input
            placeholder="Search by Session ID, Client ID, or Tenant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>Failed to load sessions: {error.message}</p>
            </div>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => refetch()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Table - Fixed pagination to use server total */}
      {!error && (
        <DataTable
          columns={columns}
          data={sessions}
          isLoading={isLoading}
          pageIndex={page}
          pageSize={20}
          pageCount={Math.ceil(total / 20)}
          onPaginationChange={setPage}
        />
      )}

      {/* Empty State */}
      {!isLoading && !error && sessions.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              {searchQuery || tab !== 'all'
                ? 'No sessions match your filters'
                : 'No sessions found'}
            </p>
            {(searchQuery || tab !== 'all') && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearchQuery('')
                  setTab('all')
                }}
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
