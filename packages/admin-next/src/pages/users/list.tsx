import { useState, useEffect, useMemo } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import { useCustom } from '@refinedev/core'
import { useNavigate } from 'react-router-dom'
import { DataTable } from '@/components/shared/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, MoreVertical, Ban, Trash2, Search } from 'lucide-react'
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

function getColumns(refetch: () => void, navigate: (path: string) => void): ColumnDef<TenantUser>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <button
          className="text-sm font-medium text-primary hover:underline text-left"
          onClick={() => navigate(`/users/${row.original.id}`)}
        >
          {row.original.name}
        </button>
      ),
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
  const [searchInput, setSearchInput] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const { selectedTenantId } = useTenantContext()
  const navigate = useNavigate()

  const debouncedSearch = useDebounce(searchInput, 300)

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [debouncedSearch, roleFilter, statusFilter])

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {
      tenantId: selectedTenantId ?? '',
      page: String(page + 1),
      limit: '20',
    }
    if (debouncedSearch) params.search = debouncedSearch
    if (roleFilter !== 'all') params.role = roleFilter
    if (statusFilter !== 'all') params.status = statusFilter
    return params
  }, [selectedTenantId, page, debouncedSearch, roleFilter, statusFilter])

  const { data, isLoading, refetch } = useCustom({
    url: '/admin/users',
    method: 'get',
    config: { query: queryParams },
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

  const columns = getColumns(refetch, navigate)

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

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all"><T zh="全部角色" en="All Roles" /></SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="developer">Developer</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all"><T zh="全部状态" en="All Status" /></SelectItem>
            <SelectItem value="active"><T zh="活跃" en="Active" /></SelectItem>
            <SelectItem value="suspended"><T zh="已暂停" en="Suspended" /></SelectItem>
          </SelectContent>
        </Select>
      </div>

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
