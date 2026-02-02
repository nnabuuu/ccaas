import { useState } from 'react'
import { useCustom } from '@refinedev/core'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface ScheduledTask {
  id: string
  name: string
  description?: string
  cronExpression: string
  status: string
  lastRunAt?: string
  nextRunAt?: string
  createdAt: string
}

export function SchedulerListPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)

  const { data, isLoading } = useCustom({
    url: '/scheduler/tasks',
    method: 'get',
    config: {
      query: { page: page + 1, limit: 20 },
    },
  })

  const result = data?.data as { tasks?: ScheduledTask[]; data?: ScheduledTask[]; total?: number } | ScheduledTask[] | undefined
  const tasks = Array.isArray(result) ? result : (result?.tasks ?? result?.data ?? [])
  const total = Array.isArray(result) ? result.length : (result?.total ?? 0)

  const columns: ColumnDef<ScheduledTask>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'cronExpression',
      header: 'Schedule',
      cell: ({ row }) => <code className="text-xs bg-muted px-2 py-1 rounded">{row.original.cronExpression}</code>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'lastRunAt',
      header: 'Last Run',
      cell: ({ row }) => row.original.lastRunAt
        ? formatDistanceToNow(new Date(row.original.lastRunAt), { addSuffix: true })
        : '-',
    },
    {
      accessorKey: 'nextRunAt',
      header: 'Next Run',
      cell: ({ row }) => row.original.nextRunAt
        ? formatDistanceToNow(new Date(row.original.nextRunAt), { addSuffix: true })
        : '-',
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => navigate(`/scheduler/${row.original.id}`)}>
          View
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Scheduler</h1>
        <Button onClick={() => navigate('/scheduler/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={tasks}
        isLoading={isLoading}
        pageIndex={page}
        pageSize={20}
        pageCount={Math.ceil(total / 20)}
        onPaginationChange={setPage}
      />
    </div>
  )
}
