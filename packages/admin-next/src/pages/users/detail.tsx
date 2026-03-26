import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCustom } from '@refinedev/core'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Pencil } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { EditUserModal } from './edit-user-modal'
import { EditRoleModal } from './edit-role-modal'
import { T } from '@/components/shared/t'
import { useTenantContext } from '@/hooks/use-tenant-context'

interface UserDetail {
  id: string
  name: string
  email: string
  status: string
  createdAt: string
  updatedAt: string
  tenants: {
    id: string
    tenantId: string
    tenantName?: string
    role: string
    canCreateSkills: boolean
    isActive: boolean
    joinedAt: string
  }[]
}

function roleBadgeClass(role: string) {
  if (role === 'admin') return 'bg-red-100 text-red-800 hover:bg-red-100 border-red-200'
  if (role === 'developer') return 'bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200'
  return ''
}

export function UserDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { selectedTenantId } = useTenantContext()
  const [showEditUser, setShowEditUser] = useState(false)
  const [showEditRole, setShowEditRole] = useState(false)

  const { data, isLoading, refetch } = useCustom<UserDetail>({
    url: `/admin/users/${id}`,
    method: 'get',
    queryOptions: { enabled: !!id },
  })

  const user = data?.data as UserDetail | undefined

  if (!id) {
    return <div className="text-center text-muted-foreground py-12">Invalid user ID</div>
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>
  }

  if (!user) {
    return <div className="text-center text-muted-foreground py-12">User not found</div>
  }

  // Find the tenant association for the current tenant context
  const currentTenant = user.tenants?.find(
    (t) => t.tenantId === selectedTenantId && t.isActive,
  ) || user.tenants?.[0]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/users')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
            <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
              {user.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base"><T zh="用户信息" en="User Info" /></CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowEditUser(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            <T zh="编辑" en="Edit" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground"><T zh="名称" en="Name" /></span>
            <span>{user.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground"><T zh="邮箱" en="Email" /></span>
            <span className="font-mono">{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground"><T zh="状态" en="Status" /></span>
            <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
              {user.status}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground"><T zh="创建时间" en="Created" /></span>
            <span>{formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground"><T zh="更新时间" en="Updated" /></span>
            <span>{formatDistanceToNow(new Date(user.updatedAt), { addSuffix: true })}</span>
          </div>
        </CardContent>
      </Card>

      {currentTenant && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base"><T zh="租户角色" en="Tenant Role" /></CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowEditRole(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              <T zh="编辑" en="Edit" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {currentTenant.tenantName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground"><T zh="租户" en="Tenant" /></span>
                <span>{currentTenant.tenantName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground"><T zh="角色" en="Role" /></span>
              <Badge
                className={roleBadgeClass(currentTenant.role)}
                variant={currentTenant.role === 'viewer' ? 'secondary' : 'default'}
              >
                {currentTenant.role}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground"><T zh="可创建技能" en="Can Create Skills" /></span>
              <Badge variant={currentTenant.canCreateSkills ? 'default' : 'secondary'}>
                {currentTenant.canCreateSkills ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground"><T zh="加入时间" en="Joined" /></span>
              <span>{formatDistanceToNow(new Date(currentTenant.joinedAt), { addSuffix: true })}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <EditUserModal
        open={showEditUser}
        onClose={() => setShowEditUser(false)}
        onSuccess={() => refetch()}
        user={user}
      />

      {currentTenant && (
        <EditRoleModal
          open={showEditRole}
          onClose={() => setShowEditRole(false)}
          onSuccess={() => refetch()}
          data={{
            userId: user.id,
            role: currentTenant.role,
            canCreateSkills: currentTenant.canCreateSkills,
          }}
        />
      )}
    </div>
  )
}
