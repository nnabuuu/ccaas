import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Copy, Ban, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  status: 'active' | 'revoked'
  rateLimitRpm: number
  rateLimitRpd: number
  lastUsedAt: string | null
  usageCount: number
  createdAt: string
}

async function handleRevoke(keyId: string) {
  if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
    return
  }

  try {
    await apiClient.post(`/admin/api-keys/${keyId}/revoke`)
    toast.success('API key revoked successfully')
    window.dispatchEvent(new CustomEvent('api-key-updated'))
  } catch (err) {
    const message = err instanceof Error && 'response' in err
      ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to revoke API key')
      : 'Failed to revoke API key'
    toast.error(message)
  }
}

async function handleDelete(keyId: string) {
  if (!confirm('Are you sure you want to delete this API key? This action is permanent.')) {
    return
  }

  try {
    await apiClient.delete(`/admin/api-keys/${keyId}`)
    toast.success('API key deleted successfully')
    window.dispatchEvent(new CustomEvent('api-key-updated'))
  } catch (err) {
    const message = err instanceof Error && 'response' in err
      ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to delete API key')
      : 'Failed to delete API key'
    toast.error(message)
  }
}

export const columns: ColumnDef<ApiKey>[] = [
  {
    accessorKey: 'keyPrefix',
    header: 'Key',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
          {row.original.keyPrefix}***
        </code>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => {
            navigator.clipboard.writeText(row.original.keyPrefix)
            toast.success('Key prefix copied to clipboard')
          }}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
    ),
  },
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'scopes',
    header: 'Scopes',
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.scopes.slice(0, 3).map((scope) => (
          <Badge key={scope} variant="outline" className="text-xs">
            {scope}
          </Badge>
        ))}
        {row.original.scopes.length > 3 && (
          <Badge variant="outline" className="text-xs">
            +{row.original.scopes.length - 3}
          </Badge>
        )}
      </div>
    ),
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
    accessorKey: 'usageCount',
    header: 'Usage',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.usageCount.toLocaleString()} calls
      </span>
    ),
  },
  {
    accessorKey: 'lastUsedAt',
    header: 'Last Used',
    cell: ({ row }) =>
      row.original.lastUsedAt ? (
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(row.original.lastUsedAt), { addSuffix: true })}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">Never</span>
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
            <DropdownMenuItem onClick={() => handleRevoke(row.original.id)}>
              <Ban className="mr-2 h-4 w-4" />
              Revoke
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => handleDelete(row.original.id)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]
