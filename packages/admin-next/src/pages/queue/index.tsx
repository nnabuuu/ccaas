import { useCustom } from '@refinedev/core'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '@/components/shared/stat-card'
import { RefreshCw, ListOrdered, Clock, CheckCircle, XCircle, Ban } from 'lucide-react'

interface QueueStats {
  pending: number
  processing: number
  workerCapacity: number
}

export function QueueMonitorPage() {
  const { data, isLoading, refetch } = useCustom<QueueStats>({
    url: '/queue/stats',
    method: 'get',
  })

  const stats = data?.data

  const utilization =
    stats && stats.workerCapacity > 0
      ? Math.round((stats.processing / stats.workerCapacity) * 100)
      : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Queue Monitor</h1>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isLoading && !stats ? (
        <p className="text-muted-foreground">Loading queue stats...</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              title="Pending"
              value={stats?.pending ?? 0}
              icon={Clock}
              description="Messages waiting to be processed"
            />
            <StatCard
              title="Processing"
              value={stats?.processing ?? 0}
              icon={ListOrdered}
              description="Messages currently being processed"
            />
            <StatCard
              title="Worker Capacity"
              value={stats?.workerCapacity ?? 0}
              icon={CheckCircle}
              description="Maximum concurrent workers"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListOrdered className="h-5 w-5" />
                Worker Utilization
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      utilization >= 90
                        ? 'bg-destructive'
                        : utilization >= 60
                        ? 'bg-yellow-500'
                        : 'bg-primary'
                    }`}
                    style={{ width: `${utilization}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">{utilization}%</span>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="default">{stats?.processing ?? 0}</Badge>
                  <span className="text-muted-foreground">active</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{stats?.workerCapacity ?? 0}</Badge>
                  <span className="text-muted-foreground">capacity</span>
                </div>
                {stats && stats.pending > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{stats.pending}</Badge>
                    <span className="text-muted-foreground">queued</span>
                  </div>
                )}
              </div>
              {stats && stats.pending === 0 && stats.processing === 0 && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Queue is idle — no messages pending or processing.
                </p>
              )}
              {stats && stats.pending > stats.workerCapacity && (
                <p className="text-sm text-yellow-600 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Queue backlog detected: {stats.pending} messages pending with{' '}
                  {stats.workerCapacity} workers.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="h-5 w-5" />
                About the Queue
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                The message queue ensures FIFO delivery per session. Each session processes one
                message at a time to prevent race conditions.
              </p>
              <p>
                Messages are retried up to 2 times with exponential backoff (1s, 2s) before being
                marked as permanently failed.
              </p>
              <p>
                To inspect a specific session&apos;s queue, open the Session Detail page — it shows
                the live pending/processing count for that session.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
