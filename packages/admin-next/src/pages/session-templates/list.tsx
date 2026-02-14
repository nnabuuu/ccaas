import { useList } from '@refinedev/core'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/shared/data-table'
import { Button } from '@/components/ui/button'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { useTenantContext } from '@/hooks/use-tenant-context'
import { apiClient } from '@/lib/api-client'
import type { SessionTemplate } from '@ccaas/common'

interface TemplateItem {
  name: string
  template: SessionTemplate
}

export function SessionTemplatesListPage() {
  const navigate = useNavigate()
  const { selectedTenantId } = useTenantContext()

  const { data, isLoading, refetch } = useList<TemplateItem>({
    resource: 'session-templates',
    meta: { tenantId: selectedTenantId || 'default' },
  })

  const templates = data?.data ?? []

  const handleDelete = async (name: string) => {
    if (confirm(`Delete template "${name}"?`)) {
      try {
        await apiClient.delete(
          `/admin/tenants/${selectedTenantId || 'default'}/session-templates/${name}`
        )
        refetch()
      } catch (error) {
        console.error('Failed to delete template:', error)
        alert('Failed to delete template')
      }
    }
  }

  const columns: ColumnDef<TemplateItem>[] = [
    {
      accessorKey: 'name',
      header: 'Template Name',
    },
    {
      accessorKey: 'template.description',
      header: 'Description',
    },
    {
      id: 'skills',
      header: 'Skills',
      cell: ({ row }) => {
        const skills = row.original.template.enabledSkillSlugs || []
        return (
          <div className="flex gap-1 flex-wrap">
            {skills.slice(0, 3).map(skill => (
              <Badge key={skill} variant="secondary">{skill}</Badge>
            ))}
            {skills.length > 3 && (
              <Badge variant="outline">+{skills.length - 3}</Badge>
            )}
          </div>
        )
      },
    },
    {
      id: 'hasPrompt',
      header: 'System Prompt',
      cell: ({ row }) => {
        const hasPrompt = !!row.original.template.appendSystemPrompt
        return (
          <Badge variant={hasPrompt ? 'default' : 'outline'}>
            {hasPrompt ? 'Yes' : 'No'}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/session-templates/${row.original.name}/edit`)}
          >
            <Edit className="h-4 w-4 mr-1" /> Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDelete(row.original.name)}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Session Templates</h1>
        <Button onClick={() => navigate('/session-templates/create')}>
          <Plus className="mr-2 h-4 w-4" /> Create Template
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={templates}
        isLoading={isLoading}
        pageCount={0}
        pageIndex={0}
        pageSize={templates.length}
        onPaginationChange={() => {}}
      />
    </div>
  )
}
