import { useParams, useNavigate } from 'react-router-dom'
import { useCustom } from '@refinedev/core'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import { ArrowLeft, Pencil, Play } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { formatDistanceToNow } from 'date-fns'

interface TaskDetail {
  id: string
  name: string
  description?: string
  cronExpression: string
  status: string
  config?: Record<string, unknown>
  lastRunAt?: string
  nextRunAt?: string
  createdAt: string
  updatedAt: string
}

interface Execution {
  id: string
  status: string
  startedAt: string
  completedAt?: string
  result?: Record<string, unknown>
}

export function SchedulerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: taskData, isLoading } = useCustom<TaskDetail>({
    url: `/scheduler/tasks/${id}`,
    method: 'get',
  })

  const { data: execData } = useCustom({
    url: `/scheduler/tasks/${id}/executions`,
    method: 'get',
  })

  const task = taskData?.data as TaskDetail | undefined
  const executions = ((execData?.data as { executions?: Execution[] })?.executions ?? execData?.data ?? []) as Execution[]

  const handleTrigger = async () => {
    await apiClient.post(`/scheduler/tasks/${id}/trigger`)
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>
  }

  if (!task) {
    return <div className="text-center text-muted-foreground py-12">Task not found</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/scheduler')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{task.name}</h1>
            <StatusBadge status={task.status} />
          </div>
          {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleTrigger}>
            <Play className="mr-2 h-4 w-4" />
            Run Now
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/scheduler/${id}/edit`)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <code className="text-sm bg-muted px-2 py-1 rounded">{task.cronExpression}</code>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Last Run</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-sm">
              {task.lastRunAt ? formatDistanceToNow(new Date(task.lastRunAt), { addSuffix: true }) : 'Never'}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Next Run</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-sm">
              {task.nextRunAt ? formatDistanceToNow(new Date(task.nextRunAt), { addSuffix: true }) : 'N/A'}
            </span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Executions</CardTitle>
        </CardHeader>
        <CardContent>
          {executions.length > 0 ? (
            <div className="space-y-3">
              {executions.map((exec) => (
                <div key={exec.id} className="flex items-center justify-between text-sm border-b pb-3 last:border-0">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={exec.status} />
                    <span className="font-mono text-xs text-muted-foreground">{exec.id.slice(0, 8)}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(exec.startedAt), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No executions yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
