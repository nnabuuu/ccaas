import { useState, useEffect } from 'react'
import { useCustom } from '@refinedev/core'
import { DataTable } from '@/components/shared/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, MoreVertical, Ban, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { type ColumnDef } from '@tanstack/react-table'
import { CreateUserModal } from './create-modal'
import { useTenantContext } from '@/hooks/use-tenant-context'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import { T } from '@/components/shared/t'

interface TenantUser {
  id: string
  email: string
  name: string
  status: 'active' | 'suspended' | 'deleted'
  role: string
  canCreateSkills: boolean
  isActive: boolean
  userTenantId: string
  joinedAt: string
  createdAt: string
}

async function handleSuspend(userId: string, refetch: () => void) {
  if (!confirm('Are you sure you want to suspend this user?')) return

  try {
    await apiClient.patch(`/admin/users/${userId}`, { status: 'suspended' })
    toast.success('User suspended')
    refetch()
  } catch (err) {
    const message = err instanceof Error && 'response' in err
      ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to suspend user')
      : 'Failed to suspend user'
    toast.error(message)
  }
}

async function handleDelete(userId: string, refetch: () => void) {
  if (!confirm('Are you sure you want to delete this user? Their API keys will be revoked.')) return

  try {
    await apiClient.delete(`/admin/users/${userId}`)
    toast.success('User deleted')
    refetch()
  } catch (err) {
    const message = err instanceof Error && 'response' in err
      ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to delete user')
      : 'Failed to delete user'
    toast.error(message)
  }
}

function getColumns(refetch: () => void): ColumnDef<TenantUser>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Name',
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.email}</span>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => {
        const role = row.original.role
        const variant = role === 'admin'
          ? 'bg-red-100 text-red-800 hover:bg-red-100 border-red-200'
          : role === 'developer'
            ? 'bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200'
            : ''
        return (
          <Badge className={variant} variant={role === 'viewer' ? 'secondary' : 'default'}>
            {role}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'active' ? 'default' : 'destructive'}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(row.original.createdAt), { addSuffix: true })}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {row.original.status === 'active' && (
              <DropdownMenuItem onClick={() => handleSuspend(row.original.id, refetch)}>
                <Ban className="mr-2 h-4 w-4" />
                Suspend
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => handleDelete(row.original.id, refetch)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]
}

export function UsersListPage() {
  const [page, setPage] = useState(0)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const { selectedTenantId } = useTenantContext()

  const { data, isLoading, refetch } = useCustom({
    url: '/admin/users',
    method: 'get',
    config: {
      query: {
        tenantId: selectedTenantId ?? '',
        page: page + 1,
        limit: 20,
      },
    },
    queryOptions: {
      enabled: !!selectedTenantId,
    },
  })

  const users = data?.data?.items ?? []
  const pageCount = Math.ceil((data?.data?.total ?? 0) / 20)

  useEffect(() => {
    const handler = () => refetch()
    window.addEventListener('user-updated', handler)
    return () => window.removeEventListener('user-updated', handler)
  }, [refetch])

  const columns = getColumns(refetch)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">
          <T zh="用户管理" en="Users" />
        </h1>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          <T zh="创建用户" en="Create User" />
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        <T
          zh="管理租户下的用户。创建用户时会自动生成 Chat API 密钥用于 Chat 界面认证。"
          en="Manage users within a tenant. A Chat API key is auto-generated on creation for chat-interface authentication."
        />
      </p>

      <DataTable
        columns={columns}
        data={users}
        pageCount={pageCount}
        pageIndex={page}
        pageSize={20}
        onPaginationChange={setPage}
        isLoading={isLoading}
      />

      <CreateUserModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false)
          refetch()
        }}
      />
    </div>
  )
}
