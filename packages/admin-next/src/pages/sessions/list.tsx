import { useState, useMemo, useCallback } from 'react'
import { useCustom, useCustomMutation } from '@refinedev/core'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/shared/data-table'
import { StatCard } from '@/components/shared/stat-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { RangePresetButtons, type RangePreset } from '@/components/shared/range-preset-buttons'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useTenantContext } from '@/hooks/use-tenant-context'
import { formatDistanceToNow } from 'date-fns'
import { Activity, CheckCircle, AlertCircle, Clock, StopCircle } from 'lucide-react'
import { formatDuration, formatTokens, formatCost } from '@/lib/format'

interface SessionItem {
  sessionId: string
  tenantId: string | null
  clientId: string
  status: string
  messageCount: number
  totalTokens: number
  estimatedCost: number
  createdAt: string
  lastActivity: string
  hasActiveProcess: boolean
}

type TabValue = 'all' | 'active' | 'error' | 'long_running' | 'completed'

// Duration filter presets (minutes)
const DURATION_PRESETS: RangePreset[] = [
  { label: '< 5min', range: [0, 5] },
  { label: '5-30min', range: [5, 30] },
  { label: '30min-1h', range: [30, 60] },
  { label: '> 1h', range: [60, 180] },
  { label: 'All', range: [0, 180] },
]

// Token filter presets
const TOKEN_PRESETS: RangePreset[] = [
  { label: '< 10K', range: [0, 10000] },
  { label: '10K-100K', range: [10000, 100000] },
  { label: '100K-1M', range: [100000, 1000000] },
  { label: '> 1M', range: [1000000, 10000000] },
  { label: 'All', range: [0, 10000000] },
]

export function SessionListPage() {
  const navigate = useNavigate()
  const { selectedTenantId } = useTenantContext()
  const [page, setPage] = useState(0)
  const [tab, setTab] = useState<TabValue>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set())
  const [showBulkKillDialog, setShowBulkKillDialog] = useState(false)
  const [durationRange, setDurationRange] = useState<[number, number]>([0, 180]) // 0-180 minutes
  const [tokenRange, setTokenRange] = useState<[number, number]>([0, 10000000]) // 0-10M tokens

  const endpoint = '/admin/sessions'

  const PAGE_SIZE = 50

  const { data, isLoading, error, refetch } = useCustom({
    url: endpoint,
    method: 'get',
    config: {
      query: {
        page: page + 1, // API uses 1-based pages, DataTable uses 0-based
        pageSize: PAGE_SIZE,
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
    : (result?.data ?? result?.items ?? result?.sessions ?? [])

  const total = Array.isArray(result)
    ? result.length
    : (result?.total ?? result?.pagination?.total ?? allSessions.length)

  // Bulk kill mutation
  const { mutate: bulkKillSessions, isLoading: isKilling } = useCustomMutation()

  // Filter sessions based on tab, search, duration, and tokens
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

    // Duration filtering (in minutes)
    const [minDuration, maxDuration] = durationRange
    if (minDuration > 0 || maxDuration < 180) {
      filtered = filtered.filter((s) => {
        const durationMs =
          new Date(s.lastActivity).getTime() - new Date(s.createdAt).getTime()
        const durationMinutes = durationMs / (1000 * 60)
        return durationMinutes >= minDuration && durationMinutes <= maxDuration
      })
    }

    // Token filtering
    const [minTokens, maxTokens] = tokenRange
    if (minTokens > 0 || maxTokens < 10000000) {
      filtered = filtered.filter((s) => {
        const tokens = s.totalTokens || 0
        return tokens >= minTokens && tokens <= maxTokens
      })
    }

    return filtered
  }, [allSessions, tab, searchQuery, durationRange, tokenRange])

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

  // Bulk selection handlers
  const handleSelectSession = useCallback((sessionId: string, checked: boolean) => {
    setSelectedSessions((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(sessionId)
      } else {
        next.delete(sessionId)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedSessions(new Set(sessions.map((s) => s.sessionId)))
    } else {
      setSelectedSessions(new Set())
    }
  }, [sessions])

  const handleBulkTerminate = useCallback(() => {
    if (selectedSessions.size === 0) return
    setShowBulkKillDialog(true)
  }, [selectedSessions.size])

  const confirmBulkTerminate = useCallback(() => {
    const sessionIds = Array.from(selectedSessions)
    bulkKillSessions(
      {
        url: '/admin/sessions/bulk-kill',
        method: 'post',
        values: { sessionIds },
      },
      {
        onSuccess: (data: any) => {
          const result = data.data
          alert(
            `Terminated ${result.successCount}/${result.totalRequested} sessions successfully.` +
              (result.failedCount > 0
                ? `\n${result.failedCount} sessions failed to terminate.`
                : '')
          )
          setSelectedSessions(new Set())
          setShowBulkKillDialog(false)
          refetch()
        },
        onError: (error: any) => {
          alert(`Failed to terminate sessions: ${error.message}`)
          setShowBulkKillDialog(false)
        },
      }
    )
  }, [selectedSessions, bulkKillSessions, refetch])

  // Memoize columns to prevent re-creation on every render
  const columns = useMemo<ColumnDef<SessionItem>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              sessions.length > 0 &&
              sessions.every((s) => selectedSessions.has(s.sessionId))
            }
            onCheckedChange={(checked: boolean | 'indeterminate') =>
              handleSelectAll(checked === true)
            }
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedSessions.has(row.original.sessionId)}
            onCheckedChange={(checked: boolean | 'indeterminate') =>
              handleSelectSession(row.original.sessionId, checked === true)
            }
            aria-label="Select row"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
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
        accessorKey: 'totalTokens',
        header: 'Total Tokens',
        cell: ({ row }) => (
          <span className="text-xs font-mono">
            {formatTokens(row.original.totalTokens || 0)}
          </span>
        ),
      },
      {
        accessorKey: 'estimatedCost',
        header: 'Cost',
        cell: ({ row }) => (
          <span className="text-xs font-mono">
            {formatCost(row.original.estimatedCost || 0)}
          </span>
        ),
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
    [navigate, handleCopySessionId, sessions, selectedSessions, handleSelectAll, handleSelectSession]
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Sessions</h1>
        {selectedSessions.size > 0 && (
          <Button
            variant="destructive"
            onClick={handleBulkTerminate}
            disabled={isKilling}
          >
            <StopCircle className="h-4 w-4 mr-2" />
            {isKilling
              ? 'Terminating...'
              : `Terminate Selected (${selectedSessions.size})`}
          </Button>
        )}
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

        <div className="flex flex-col gap-4">
          <Input
            placeholder="Search by Session ID, Client ID, or Tenant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />

          {/* Advanced Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Duration Filter */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Duration</label>
                    <span className="text-xs text-muted-foreground">
                      {durationRange[0]} - {durationRange[1]} min
                    </span>
                  </div>
                  <RangePresetButtons
                    presets={DURATION_PRESETS}
                    current={durationRange}
                    onChange={setDurationRange}
                  />
                </div>

                {/* Token Filter */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Tokens</label>
                    <span className="text-xs text-muted-foreground">
                      {formatTokens(tokenRange[0])} - {formatTokens(tokenRange[1])}
                    </span>
                  </div>
                  <RangePresetButtons
                    presets={TOKEN_PRESETS}
                    current={tokenRange}
                    onChange={setTokenRange}
                  />
                </div>
              </div>

              {/* Filter Summary */}
              {(sessions.length < allSessions.length || searchQuery) && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {sessions.length} of {allSessions.length} sessions
                    {searchQuery && ` matching "${searchQuery}"`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
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
          pageSize={PAGE_SIZE}
          pageCount={Math.ceil(total / PAGE_SIZE)}
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

      {/* Bulk Terminate Confirmation Dialog */}
      <AlertDialog open={showBulkKillDialog} onOpenChange={setShowBulkKillDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminate {selectedSessions.size} Sessions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will forcefully terminate {selectedSessions.size} selected session
              {selectedSessions.size > 1 ? 's' : ''}. Any running AgentEngine processes will be
              killed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isKilling}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkTerminate}
              disabled={isKilling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isKilling ? 'Terminating...' : 'Terminate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
