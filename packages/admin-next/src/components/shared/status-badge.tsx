import { Badge } from '@/components/ui/badge'
import { T } from '@/components/shared/t'

type StatusType = 'idle' | 'processing' | 'error' | 'closed' | 'completed' | 'active' | 'suspended' | 'pending' | 'deleted' | 'draft' | 'published' | 'archived' | 'running' | 'failed' | 'success'

const statusConfig: Record<StatusType, { zh: string; en: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' }> = {
  idle: { zh: '空闲', en: 'Idle', variant: 'secondary' },
  processing: { zh: '处理中', en: 'Processing', variant: 'default' },
  error: { zh: '错误', en: 'Error', variant: 'destructive' },
  closed: { zh: '已关闭', en: 'Closed', variant: 'outline' },
  completed: { zh: '已完成', en: 'Completed', variant: 'success' },
  active: { zh: '活跃', en: 'Active', variant: 'success' },
  suspended: { zh: '已暂停', en: 'Suspended', variant: 'warning' },
  pending: { zh: '待处理', en: 'Pending', variant: 'warning' },
  deleted: { zh: '已删除', en: 'Deleted', variant: 'destructive' },
  draft: { zh: '草稿', en: 'Draft', variant: 'secondary' },
  published: { zh: '已发布', en: 'Published', variant: 'success' },
  archived: { zh: '已归档', en: 'Archived', variant: 'outline' },
  running: { zh: '运行中', en: 'Running', variant: 'default' },
  failed: { zh: '失败', en: 'Failed', variant: 'destructive' },
  success: { zh: '成功', en: 'Success', variant: 'success' },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status as StatusType]
  if (!config) {
    return <Badge variant="outline" className={className}>{status}</Badge>
  }
  return (
    <Badge variant={config.variant} className={className}>
      <T zh={config.zh} en={config.en} />
    </Badge>
  )
}
