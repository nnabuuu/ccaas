import { useState } from 'react'
import { useCustom } from '@refinedev/core'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Copy, Check } from 'lucide-react'
import { CreateApiKeyModal } from '@/components/api-keys/create-modal'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

interface TenantApiKeysTabProps {
  tenantId: string | undefined
}

interface ApiKeyItem {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  status: string
  lastUsedAt: string | null
  usageCount: number
  createdAt: string
}

export function TenantApiKeysTab({ tenantId }: TenantApiKeysTabProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null)

  const { data, isLoading, refetch } = useCustom({
    url: '/admin/api-keys',
    method: 'get',
    config: {
      query: {
        tenantId,
        page: 1,
        limit: 50,
      },
    },
    queryOptions: {
      enabled: !!tenantId,
    },
  })

  const apiKeys = (data?.data?.items ?? []) as ApiKeyItem[]

  const handleCopyKey = async (keyPrefix: string, keyId: string) => {
    await navigator.clipboard.writeText(keyPrefix)
    setCopiedKeyId(keyId)
    setTimeout(() => setCopiedKeyId(null), 2000)
    toast.success('Key prefix copied to clipboard')
  }

  if (!tenantId) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-muted-foreground">
          Tenant ID not available
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">API Keys</CardTitle>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create API Key
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : apiKeys.length > 0 ? (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-start justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{key.name}</span>
                      <Badge
                        variant={key.status === 'active' ? 'default' : 'secondary'}
                        className="capitalize"
                      >
                        {key.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <code className="font-mono text-xs bg-muted px-2 py-1 rounded">
                        {key.keyPrefix}...
                      </code>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleCopyKey(key.keyPrefix, key.id)}
                      >
                        {copiedKeyId === key.id ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {key.scopes.map((scope) => (
                        <Badge key={scope} variant="outline" className="text-xs">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Usage: {key.usageCount.toLocaleString()} requests</p>
                      <p>
                        Last used:{' '}
                        {key.lastUsedAt
                          ? formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })
                          : 'Never'}
                      </p>
                      <p>
                        Created:{' '}
                        {formatDistanceToNow(new Date(key.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No API keys found. Create one to get started.
            </div>
          )}
        </CardContent>
      </Card>

      <CreateApiKeyModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false)
          refetch()
        }}
      />
    </>
  )
}
