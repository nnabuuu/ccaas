import { useState, useEffect } from 'react'
import { useCustom } from '@refinedev/core'
import { DataTable } from '@/components/shared/data-table'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { CreateApiKeyModal } from '@/components/api-keys/create-modal'
import { columns } from '@/components/api-keys/columns'
import { useTenantContext } from '@/hooks/use-tenant-context'
import { T } from '@/components/shared/t'

export function ApiKeysListPage() {
  const [page, setPage] = useState(0)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const { selectedTenantId } = useTenantContext()

  const { data, isLoading, refetch } = useCustom({
    url: '/admin/api-keys',
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

  const apiKeys = data?.data?.items ?? []
  const pageCount = Math.ceil((data?.data?.total ?? 0) / 20)

  useEffect(() => {
    const handler = () => refetch()
    window.addEventListener('api-key-updated', handler)
    return () => window.removeEventListener('api-key-updated', handler)
  }, [refetch])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create API Key
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        <T
          zh="API 密钥控制平台访问权限。Admin 密钥拥有完整平台访问。Builder 密钥可自助管理租户并创建子密钥。Tenant 密钥用于 SDK/前端集成。"
          en="API keys control access to the platform. Admin keys have full platform access. Builder keys can self-manage tenants and create child keys. Tenant keys are for SDK/frontend integration."
        />
      </p>

      <DataTable
        columns={columns}
        data={apiKeys}
        pageCount={pageCount}
        pageIndex={page}
        pageSize={20}
        onPaginationChange={setPage}
        isLoading={isLoading}
      />

      <CreateApiKeyModal
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
