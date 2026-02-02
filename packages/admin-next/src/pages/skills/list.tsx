import { useList } from '@refinedev/core'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTenantContext } from '@/hooks/use-tenant-context'

interface Skill {
  id: string
  name: string
  slug: string
  type: string
  status: string
  version: number
  tenantId: string
  updatedAt: string
}

export function SkillListPage() {
  const navigate = useNavigate()
  const { selectedTenantId } = useTenantContext()

  const { data, isLoading } = useList<Skill>({
    resource: 'skills',
    filters: selectedTenantId ? [{ field: 'tenantId', operator: 'eq', value: selectedTenantId }] : [],
    pagination: { current: 1, pageSize: 50 },
  })

  const skills = data?.data ?? []

  const columns: ColumnDef<Skill>[] = [
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
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => <Badge variant="outline">{row.original.type}</Badge>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'version',
      header: 'Version',
      cell: ({ row }) => <span className="font-mono text-sm">v{row.original.version}</span>,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => navigate(`/skills/${row.original.slug ?? row.original.id}`)}>
          Edit
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Skills</h1>
      </div>
      <DataTable columns={columns} data={skills} isLoading={isLoading} />
    </div>
  )
}
