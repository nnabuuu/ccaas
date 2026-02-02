import { Badge } from '@/components/ui/badge'

type StatusType = 'idle' | 'processing' | 'error' | 'closed' | 'completed' | 'active' | 'suspended' | 'pending' | 'deleted' | 'draft' | 'published' | 'archived' | 'running' | 'failed' | 'success'

const statusConfig: Record<StatusType, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' }> = {
  idle: { label: 'Idle', variant: 'secondary' },
  processing: { label: 'Processing', variant: 'default' },
  error: { label: 'Error', variant: 'destructive' },
  closed: { label: 'Closed', variant: 'outline' },
  completed: { label: 'Completed', variant: 'success' },
  active: { label: 'Active', variant: 'success' },
  suspended: { label: 'Suspended', variant: 'warning' },
  pending: { label: 'Pending', variant: 'warning' },
  deleted: { label: 'Deleted', variant: 'destructive' },
  draft: { label: 'Draft', variant: 'secondary' },
  published: { label: 'Published', variant: 'success' },
  archived: { label: 'Archived', variant: 'outline' },
  running: { label: 'Running', variant: 'default' },
  failed: { label: 'Failed', variant: 'destructive' },
  success: { label: 'Success', variant: 'success' },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status as StatusType] ?? { label: status, variant: 'outline' as const }
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  )
}
