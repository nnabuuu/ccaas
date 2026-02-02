import { useParams, useNavigate } from 'react-router-dom'
import { useCustom } from '@refinedev/core'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import { ArrowLeft, RotateCcw, XCircle } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { formatDistanceToNow } from 'date-fns'

interface SessionDetail {
  sessionId: string
  tenantId: string | null
  clientId: string
  status: string
  messageCount: number
  createdAt: string
  lastActivity: string
  hasActiveProcess: boolean
  workspaceDir: string
}

interface TimelineEvent {
  type: string
  timestamp: string
  data?: Record<string, unknown>
}

export function SessionDetailPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  const { data: sessionData, isLoading } = useCustom<SessionDetail>({
    url: `/admin/sessions/${sessionId}`,
    method: 'get',
  })

  const { data: timelineData } = useCustom({
    url: `/admin/sessions/${sessionId}/timeline`,
    method: 'get',
  })

  const session = sessionData?.data as SessionDetail | undefined
  const timeline = ((timelineData?.data as { events?: TimelineEvent[] })?.events ?? []) as TimelineEvent[]

  const handleKill = async () => {
    await apiClient.post(`/admin/sessions/${sessionId}/kill`)
    navigate('/sessions')
  }

  const handleRestart = async () => {
    await apiClient.post(`/admin/sessions/${sessionId}/restart`)
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>
  }

  if (!session) {
    return <div className="text-center text-muted-foreground py-12">Session not found</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/sessions')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight font-mono">{session.sessionId}</h1>
          <p className="text-sm text-muted-foreground">
            Created {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRestart}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Restart
          </Button>
          <Button variant="destructive" size="sm" onClick={handleKill}>
            <XCircle className="mr-2 h-4 w-4" />
            Kill
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={session.status} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{session.messageCount}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Last Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-sm">
              {formatDistanceToNow(new Date(session.lastActivity), { addSuffix: true })}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.length > 0 ? (
            <div className="space-y-4">
              {timeline.map((event, i) => (
                <div key={i} className="flex items-start gap-4 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{event.type}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {event.data && (
                      <pre className="text-xs text-muted-foreground bg-muted rounded p-2 overflow-auto max-h-32">
                        {JSON.stringify(event.data, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No timeline events</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
