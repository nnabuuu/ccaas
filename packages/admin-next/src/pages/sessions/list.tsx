import { useState } from 'react'
import { useCustom } from '@refinedev/core'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTenantContext } from '@/hooks/use-tenant-context'
import { formatDistanceToNow } from 'date-fns'

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

const columns: ColumnDef<SessionItem>[] = [
  {
    accessorKey: 'sessionId',
    header: 'Session ID',
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.sessionId.slice(0, 12)}...</span>
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
  },
  {
    accessorKey: 'lastActivity',
    header: 'Last Activity',
    cell: ({ row }) => formatDistanceToNow(new Date(row.original.lastActivity), { addSuffix: true }),
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => formatDistanceToNow(new Date(row.original.createdAt), { addSuffix: true }),
  },
]

export function SessionListPage() {
  const navigate = useNavigate()
  const { selectedTenantId } = useTenantContext()
  const [page, setPage] = useState(0)
  const [tab, setTab] = useState<'all' | 'active'>('all')

  const endpoint = tab === 'active' ? '/admin/sessions/active' : '/admin/sessions'

  const { data, isLoading } = useCustom({
    url: endpoint,
    method: 'get',
    config: {
      query: {
        page: page + 1,
        limit: 20,
        ...(selectedTenantId ? { tenantId: selectedTenantId } : {}),
      },
    },
  })

  const result = data?.data as { sessions?: SessionItem[]; data?: SessionItem[]; total?: number; pagination?: { total: number } } | SessionItem[] | undefined
  const sessions = Array.isArray(result)
    ? result
    : (result?.sessions ?? result?.data ?? [])
  const total = Array.isArray(result)
    ? result.length
    : (result?.total ?? result?.pagination?.total ?? 0)

  const clickableColumns: ColumnDef<SessionItem>[] = [
    ...columns,
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => navigate(`/sessions/${row.original.sessionId}`)}>
          View
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Sessions</h1>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as 'all' | 'active'); setPage(0) }}>
        <TabsList>
          <TabsTrigger value="all">All Sessions</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        columns={clickableColumns}
        data={sessions}
        isLoading={isLoading}
        pageIndex={page}
        pageSize={20}
        pageCount={Math.ceil(total / 20)}
        onPaginationChange={setPage}
      />
    </div>
  )
}
