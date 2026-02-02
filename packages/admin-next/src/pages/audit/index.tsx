import { useState } from 'react'
import { useCustom } from '@refinedev/core'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTenantContext } from '@/hooks/use-tenant-context'
import { formatDistanceToNow } from 'date-fns'

interface AuditEntry {
  id: string
  action: string
  userId?: string
  targetType?: string
  targetId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  timestamp: string
}

const actionTypes = [
  'all',
  'skill.create', 'skill.update', 'skill.publish', 'skill.archive', 'skill.rollback',
  'session.kill', 'session.restart',
  'apikey.create', 'apikey.revoke',
  'tenant.create', 'tenant.update',
]

export function AuditLogPage() {
  const { selectedTenantId } = useTenantContext()
  const [page, setPage] = useState(0)
  const [actionFilter, setActionFilter] = useState('all')

  const { data, isLoading } = useCustom({
    url: '/admin/audit/log',
    method: 'get',
    config: {
      query: {
        page: page + 1,
        limit: 20,
        ...(actionFilter !== 'all' ? { action: actionFilter } : {}),
        ...(selectedTenantId ? { tenantId: selectedTenantId } : {}),
      },
    },
  })

  const result = data?.data as { logs?: AuditEntry[]; data?: AuditEntry[]; total?: number } | AuditEntry[] | undefined
  const logs = Array.isArray(result) ? result : (result?.logs ?? result?.data ?? [])
  const total = Array.isArray(result) ? result.length : (result?.total ?? 0)

  const columns: ColumnDef<AuditEntry>[] = [
    {
      accessorKey: 'action',
      header: 'Action',
      cell: ({ row }) => {
        const [category, action] = row.original.action.split('.')
        return (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{category}</Badge>
            <span className="text-sm">{action}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'targetType',
      header: 'Target',
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.targetType && (
            <span className="font-mono text-xs">{row.original.targetType}:{row.original.targetId?.slice(0, 8)}</span>
          )}
        </span>
      ),
    },
    {
      accessorKey: 'userId',
      header: 'User',
      cell: ({ row }) => <span className="text-sm font-mono">{row.original.userId ?? '-'}</span>,
    },
    {
      accessorKey: 'timestamp',
      header: 'Time',
      cell: ({ row }) => formatDistanceToNow(new Date(row.original.timestamp), { addSuffix: true }),
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>

      <div className="flex items-center gap-4">
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0) }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            {actionTypes.map((a) => (
              <SelectItem key={a} value={a}>
                {a === 'all' ? 'All Actions' : a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={logs}
        isLoading={isLoading}
        pageIndex={page}
        pageSize={20}
        pageCount={Math.ceil(total / 20)}
        onPaginationChange={setPage}
      />
    </div>
  )
}
