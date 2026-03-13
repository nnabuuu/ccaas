import { useState, useMemo, useCallback } from 'react'
import { useCustom, useCustomMutation } from '@refinedev/core'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { DateRange } from 'react-day-picker'
import { DataTable } from '@/components/shared/data-table'
import { StatCard } from '@/components/shared/stat-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { DateRangePicker } from '@/components/shared/date-range-picker'
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
import { toast } from 'sonner'
import { T } from '@/components/shared/t'
import { useLang } from '@/contexts/language-context'

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

export function SessionListPage() {
  const navigate = useNavigate()
  const { selectedTenantId } = useTenantContext()
  const { lang } = useLang()
  const [page, setPage] = useState(0)
  const [tab, setTab] = useState<TabValue>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set())
  const [showBulkKillDialog, setShowBulkKillDialog] = useState(false)

  const endpoint = '/admin/sessions'

  const PAGE_SIZE = 50

  const { data, isLoading, error, refetch } = useCustom({
    url: endpoint,
    method: 'get',
    config: {
      query: {
        page: page + 1,
        pageSize: PAGE_SIZE,
        ...(selectedTenantId ? { tenantId: selectedTenantId } : {}),
        ...(dateRange?.from ? { startDate: dateRange.from.toISOString() } : {}),
        ...(dateRange?.to ? { endDate: dateRange.to.toISOString() } : {}),
      },
    },
  })

  const result = data?.data as { data?: SessionItem[]; total?: number } | undefined
  const allSessions = useMemo(() => result?.data ?? [], [result?.data])
  const total = result?.total ?? allSessions.length

  const { mutate: bulkKillSessions, isLoading: isKilling } = useCustomMutation()

  // eslint-disable-next-line react-hooks/purity
  const oneHourAgo = useMemo(() => new Date(Date.now() - 60 * 60 * 1000), [])
  // eslint-disable-next-line react-hooks/purity
  const oneDayAgo = useMemo(() => new Date(Date.now() - 24 * 60 * 60 * 1000), [])

  const sessions = useMemo(() => {
    let filtered = allSessions

    if (tab === 'active') {
      filtered = filtered.filter((s) => s.status === 'processing' || s.hasActiveProcess)
    } else if (tab === 'error') {
      filtered = filtered.filter((s) => s.status === 'error')
    } else if (tab === 'long_running') {
      filtered = filtered.filter(
        (s) =>
          (s.status === 'processing' || s.hasActiveProcess) &&
          new Date(s.createdAt) < oneHourAgo
      )
    } else if (tab === 'completed') {
      filtered = filtered.filter((s) => s.status === 'closed' || s.status === 'completed')
    }

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
  }, [allSessions, tab, searchQuery, oneHourAgo])

  const kpis = useMemo(() => {
    const activeSessions = allSessions.filter(
      (s) => s.status === 'processing' || s.hasActiveProcess
    ).length
    const completedLast24h = allSessions.filter((s) => {
      return (
        (s.status === 'closed' || s.status === 'completed') &&
        new Date(s.lastActivity) > oneDayAgo
      )
    }).length
    const errorRate =
      allSessions.length > 0
        ? ((allSessions.filter((s) => s.status === 'error').length / allSessions.length) * 100).toFixed(1)
        : '0.0'

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
  }, [allSessions, oneDayAgo])

  const handleCopySessionId = useCallback(async (sessionId: string) => {
    try {
      await navigator.clipboard.writeText(sessionId)
      toast.success(lang === 'zh' ? '会话 ID 已复制' : 'Session ID copied')
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Failed to copy session ID:', error)
      }
    }
  }, [lang])

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
        onSuccess: (data: unknown) => {
          const result = (data as { data: { successCount: number; totalRequested: number; failedCount: number } }).data
          if (result.failedCount > 0) {
            toast.warning(`Terminated ${result.successCount}/${result.totalRequested} sessions. ${result.failedCount} failed.`)
          } else {
            toast.success(`Terminated ${result.successCount} session${result.successCount !== 1 ? 's' : ''} successfully.`)
          }
          setSelectedSessions(new Set())
          setShowBulkKillDialog(false)
          refetch()
        },
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error)
          toast.error(`Failed to terminate sessions: ${message}`)
          setShowBulkKillDialog(false)
        },
      }
    )
  }, [selectedSessions, bulkKillSessions, refetch])

  const columns = useMemo<ColumnDef<SessionItem>[]>(
    () => [
      {
        id: 'select',
        header: () => (
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
        header: () => <T zh="会话 ID" en="Session ID" />,
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
              <T zh="复制" en="Copy" />
            </Button>
          </div>
        ),
      },
      {
        accessorKey: 'tenantId',
        header: () => <T zh="租户" en="Tenant" />,
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.tenantId ? row.original.tenantId.slice(0, 12) + '...' : 'N/A'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: () => <T zh="状态" en="Status" />,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'messageCount',
        header: () => <T zh="消息" en="Messages" />,
        cell: ({ row }) => <span>{row.original.messageCount}</span>,
      },
      {
        accessorKey: 'totalTokens',
        header: () => <T zh="总 Token" en="Total Tokens" />,
        cell: ({ row }) => (
          <span className="text-xs font-mono">
            {formatTokens(row.original.totalTokens || 0)}
          </span>
        ),
      },
      {
        accessorKey: 'estimatedCost',
        header: () => <T zh="费用" en="Cost" />,
        cell: ({ row }) => (
          <span className="text-xs font-mono">
            {formatCost(row.original.estimatedCost || 0)}
          </span>
        ),
      },
      {
        accessorKey: 'duration',
        header: () => <T zh="时长" en="Duration" />,
        cell: ({ row }) => {
          const durationMs =
            new Date(row.original.lastActivity).getTime() -
            new Date(row.original.createdAt).getTime()
          return <span className="text-xs">{formatDuration(durationMs)}</span>
        },
      },
      {
        accessorKey: 'lastActivity',
        header: () => <T zh="最近活动" en="Last Activity" />,
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
            <T zh="查看详情" en="View Details" />
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
        <h1 className="text-3xl font-bold tracking-tight"><T zh="会话" en="Sessions" /></h1>
        {selectedSessions.size > 0 && (
          <Button
            variant="destructive"
            onClick={handleBulkTerminate}
            disabled={isKilling}
          >
            <StopCircle className="h-4 w-4 mr-2" />
            {isKilling
              ? <T zh="终止中..." en="Terminating..." />
              : <><span className="zh">终止选中 ({selectedSessions.size})</span><span className="en">Terminate Selected ({selectedSessions.size})</span></>}
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title={<T zh="活跃会话" en="Active Sessions" />}
          value={kpis.activeSessions}
          icon={Activity}
          description={<T zh="正在运行或处理中" en="Currently running or processing" />}
        />
        <StatCard
          title={<T zh="已完成 (24h)" en="Completed (24h)" />}
          value={kpis.completedLast24h}
          icon={CheckCircle}
          description={<T zh="成功完成" en="Successfully finished" />}
        />
        <StatCard
          title={<T zh="错误率" en="Error Rate" />}
          value={`${kpis.errorRate}%`}
          icon={AlertCircle}
          description={<T zh="出错的会话" en="Sessions with errors" />}
        />
        <StatCard
          title={<T zh="平均时长" en="Avg Duration" />}
          value={kpis.avgDuration}
          icon={Clock}
          description={<T zh="已完成会话" en="For completed sessions" />}
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
            <TabsTrigger value="all"><T zh="全部" en="All" /></TabsTrigger>
            <TabsTrigger value="active"><T zh="活跃" en="Active" /></TabsTrigger>
            <TabsTrigger value="error"><T zh="错误" en="Error" /></TabsTrigger>
            <TabsTrigger value="long_running"><T zh="长时间运行" en="Long Running" /></TabsTrigger>
            <TabsTrigger value="completed"><T zh="已完成" en="Completed" /></TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-4">
          <Input
            placeholder={lang === 'zh' ? '按会话 ID、客户端 ID 或租户搜索...' : 'Search by Session ID, Client ID, or Tenant...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />

          {/* Advanced Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Date Range Filter */}
                <div className="space-y-3">
                  <label className="text-sm font-medium"><T zh="日期范围" en="Date Range" /></label>
                  <DateRangePicker
                    value={dateRange}
                    onChange={(range) => {
                      setDateRange(range)
                      setPage(0)
                    }}
                    className="max-w-md"
                  />
                </div>

                {/* Filter Summary */}
                {(sessions.length < allSessions.length || searchQuery || dateRange) && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      <span className="zh">
                        显示 {sessions.length} / {allSessions.length} 个会话
                        {searchQuery && ` 匹配 "${searchQuery}"`}
                        {dateRange?.from && ` 从 ${dateRange.from.toLocaleDateString()}`}
                        {dateRange?.to && ` 到 ${dateRange.to.toLocaleDateString()}`}
                      </span>
                      <span className="en">
                        Showing {sessions.length} of {allSessions.length} sessions
                        {searchQuery && ` matching "${searchQuery}"`}
                        {dateRange?.from && ` from ${dateRange.from.toLocaleDateString()}`}
                        {dateRange?.to && ` to ${dateRange.to.toLocaleDateString()}`}
                      </span>
                    </p>
                  </div>
                )}
              </div>
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
              <p><span className="zh">加载会话失败: </span><span className="en">Failed to load sessions: </span>{error.message}</p>
            </div>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => refetch()}
            >
              <T zh="重试" en="Retry" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Table */}
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
                ? <T zh="没有匹配筛选条件的会话" en="No sessions match your filters" />
                : <T zh="暂无会话" en="No sessions found" />}
            </p>
            {(searchQuery || tab !== 'all' || dateRange) && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearchQuery('')
                  setTab('all')
                  setDateRange(undefined)
                }}
              >
                <T zh="清除筛选" en="Clear Filters" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bulk Terminate Confirmation Dialog */}
      <AlertDialog open={showBulkKillDialog} onOpenChange={setShowBulkKillDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <span className="zh">终止 {selectedSessions.size} 个会话？</span>
              <span className="en">Terminate {selectedSessions.size} Sessions?</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <span className="zh">
                这将强制终止 {selectedSessions.size} 个选中的会话。所有运行中的 AgentEngine 进程将被终止。此操作不可撤销。
              </span>
              <span className="en">
                This will forcefully terminate {selectedSessions.size} selected session
                {selectedSessions.size > 1 ? 's' : ''}. Any running AgentEngine processes will be
                killed. This action cannot be undone.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isKilling}><T zh="取消" en="Cancel" /></AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkTerminate}
              disabled={isKilling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isKilling ? <T zh="终止中..." en="Terminating..." /> : <T zh="终止" en="Terminate" />}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
