import { useList } from '@refinedev/core'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface Tenant {
  id: string
  name: string
  slug: string
  status: string
  plan: string
  maxSessions: number
  maxSkills: number
  createdAt: string
}

export function TenantListPage() {
  const navigate = useNavigate()

  const { data, isLoading } = useList<Tenant>({
    resource: 'tenants',
    pagination: { current: 1, pageSize: 50 },
  })

  const tenants = data?.data ?? []

  const columns: ColumnDef<Tenant>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div>
          <span className="font-medium">{row.original.name}</span>
          <span className="ml-2 text-xs text-muted-foreground font-mono">{row.original.slug}</span>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'plan',
      header: 'Plan',
      cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.original.plan}</Badge>,
    },
    {
      accessorKey: 'maxSessions',
      header: 'Max Sessions',
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => navigate(`/tenants/${row.original.id}`)}>
          View
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Tenants</h1>
        <Button onClick={() => navigate('/tenants/create')}>
          <Plus className="mr-2 h-4 w-4" /> Create Tenant
        </Button>
      </div>
      <DataTable columns={columns} data={tenants} isLoading={isLoading} />
    </div>
  )
}
