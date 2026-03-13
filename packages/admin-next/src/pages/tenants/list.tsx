import { useList } from '@refinedev/core'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { T } from '@/components/shared/t'

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
      header: () => <T zh="名称" en="Name" />,
      cell: ({ row }) => (
        <div>
          <span className="font-medium">{row.original.name}</span>
          <span className="ml-2 text-xs text-muted-foreground font-mono">{row.original.slug}</span>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: () => <T zh="状态" en="Status" />,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'plan',
      header: () => <T zh="计划" en="Plan" />,
      cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.original.plan}</Badge>,
    },
    {
      accessorKey: 'maxSessions',
      header: () => <T zh="最大会话数" en="Max Sessions" />,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => navigate(`/tenants/${row.original.id}`)}>
          <T zh="查看" en="View" />
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight"><T zh="租户" en="Tenants" /></h1>
        <Button onClick={() => navigate('/tenants/create')}>
          <Plus className="mr-2 h-4 w-4" /> <T zh="创建租户" en="Create Tenant" />
        </Button>
      </div>
      <DataTable columns={columns} data={tenants} isLoading={isLoading} />
    </div>
  )
}
