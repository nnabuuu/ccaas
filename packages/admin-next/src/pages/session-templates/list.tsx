import { useList, useDelete } from '@refinedev/core'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { DataTable } from '@/components/shared/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Plus, Edit, Trash2 } from 'lucide-react'
import { useTenantContext } from '@/hooks/use-tenant-context'
import type { SessionTemplate } from '@kedge-agentic/common'

interface TemplateItem {
  name: string
  template: SessionTemplate
}

export function SessionTemplatesListPage() {
  const navigate = useNavigate()
  const { selectedTenantId } = useTenantContext()
  const tenantId = selectedTenantId || 'default'

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data, isLoading, refetch } = useList<TemplateItem>({
    resource: 'session-templates',
    meta: { tenantId },
  })

  const { mutate: deleteTemplate, isLoading: isDeleting } = useDelete()

  const templates = data?.data ?? []

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return

    deleteTemplate(
      {
        resource: 'session-templates',
        id: deleteTarget,
        meta: { tenantId },
      },
      {
        onSuccess: () => {
          toast.success(`Template "${deleteTarget}" deleted`)
          setDeleteTarget(null)
          refetch()
        },
        onError: () => {
          toast.error(`Failed to delete template "${deleteTarget}"`)
          setDeleteTarget(null)
        },
      },
    )
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
            onClick={() => setDeleteTarget(row.original.name)}
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
        pageCount={1}
        pageIndex={0}
        pageSize={templates.length || 10}
        onPaginationChange={() => {}}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete template &quot;{deleteTarget}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
