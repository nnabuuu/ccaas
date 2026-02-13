import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCustom, useCustomMutation } from '@refinedev/core'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatDistanceToNow, format } from 'date-fns'
import {
  ArrowLeft,
  Download,
  RefreshCw,
  StopCircle,
  Copy,
  MessageSquare,
  Wrench,
  Brain,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
  id: string
  type: 'message' | 'tool_event' | 'thinking_block' | 'process_event' | 'api_error'
  timestamp: string
  data: any
}

const EVENT_ICONS = {
  message: MessageSquare,
  tool_event: Wrench,
  thinking_block: Brain,
  process_event: Activity,
  api_error: AlertTriangle,
}

const EVENT_COLORS = {
  message: 'text-blue-500',
  tool_event: 'text-green-500',
  thinking_block: 'text-yellow-500',
  process_event: 'text-gray-500',
  api_error: 'text-red-500',
}

function TimelineEventCard({ event }: { event: TimelineEvent }) {
  const Icon = EVENT_ICONS[event.type] || Activity
  const colorClass = EVENT_COLORS[event.type] || 'text-gray-500'

  const renderEventContent = () => {
    switch (event.type) {
      case 'message':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold capitalize">{event.data.role}:</span>
              {event.data.messageIndex !== undefined && (
                <span className="text-xs text-muted-foreground">
                  (Message #{event.data.messageIndex})
                </span>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap">{event.data.content}</p>
          </div>
        )
      case 'tool_event':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{event.data.toolName}</span>
              <span className="text-xs text-muted-foreground">({event.data.phase})</span>
              {event.data.success !== undefined && (
                <span>
                  {event.data.success ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </span>
              )}
              {event.data.durationMs && (
                <span className="text-xs text-muted-foreground">
                  {event.data.durationMs}ms
                </span>
              )}
            </div>
            {event.data.input && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Input
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto">
                  {JSON.stringify(event.data.input, null, 2)}
                </pre>
              </details>
            )}
            {event.data.output && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Output
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto">
                  {JSON.stringify(event.data.output, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )
      case 'thinking_block':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Thinking</span>
              <span className="text-xs text-muted-foreground">({event.data.status})</span>
              {event.data.thinkingTokens && (
                <span className="text-xs text-muted-foreground">
                  {event.data.thinkingTokens} tokens
                </span>
              )}
              {event.data.durationMs && (
                <span className="text-xs text-muted-foreground">
                  {event.data.durationMs}ms
                </span>
              )}
            </div>
            {event.data.content && (
              <p className="text-sm text-muted-foreground italic">{event.data.content}</p>
            )}
          </div>
        )
      case 'process_event':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold capitalize">{event.data.eventType}</span>
              {event.data.pid && (
                <span className="text-xs text-muted-foreground">PID {event.data.pid}</span>
              )}
            </div>
            {event.data.exitCode !== undefined && (
              <p className="text-sm">Exit Code: {event.data.exitCode}</p>
            )}
            {event.data.signal && <p className="text-sm">Signal: {event.data.signal}</p>}
            {event.data.errorMessage && (
              <p className="text-sm text-destructive">{event.data.errorMessage}</p>
            )}
          </div>
        )
      case 'api_error':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{event.data.errorType}</span>
              {event.data.statusCode && (
                <span className="text-xs text-muted-foreground">
                  HTTP {event.data.statusCode}
                </span>
              )}
            </div>
            {event.data.errorMessage && (
              <p className="text-sm text-destructive">{event.data.errorMessage}</p>
            )}
            {event.data.errorCode && (
              <p className="text-xs text-muted-foreground">Code: {event.data.errorCode}</p>
            )}
            {event.data.retryAttempt !== undefined && (
              <p className="text-xs text-muted-foreground">
                Retry Attempt: {event.data.retryAttempt}
                {event.data.wasRetried && ' (retried)'}
              </p>
            )}
          </div>
        )
      default:
        return <pre className="text-xs">{JSON.stringify(event.data, null, 2)}</pre>
    }
  }

  return (
    <div className="flex gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex flex-col items-center gap-2 min-w-[100px]">
        <Icon className={cn('h-5 w-5', colorClass)} />
        <span className="text-xs text-muted-foreground">
          {format(new Date(event.timestamp), 'HH:mm:ss')}
        </span>
      </div>
      <div className="flex-1">{renderEventContent()}</div>
    </div>
  )
}

export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [timelineOffset, setTimelineOffset] = useState(0)
  const timelineLimit = 50

  // Fetch session detail
  const { data: sessionData, isLoading: sessionLoading } = useCustom<SessionDetail>({
    url: `/admin/sessions/${sessionId}`,
    method: 'get',
  })

  // Fetch timeline
  const {
    data: timelineData,
    isLoading: timelineLoading,
    refetch: refetchTimeline,
  } = useCustom<{
    sessionId: string
    events: TimelineEvent[]
    totalEvents: number
  }>({
    url: `/admin/sessions/${sessionId}/timeline`,
    method: 'get',
    config: {
      query: {
        limit: timelineLimit,
        offset: timelineOffset,
      },
    },
  })

  // Kill session mutation
  const { mutate: killSession, isLoading: isKilling } = useCustomMutation()

  const session = sessionData?.data
  const timeline = timelineData?.data
  const events = timeline?.events || []
  const totalEvents = timeline?.totalEvents || 0

  const handleKillSession = async () => {
    if (!sessionId || !confirm('Are you sure you want to terminate this session?')) return

    killSession(
      {
        url: `/admin/sessions/${sessionId}/kill`,
        method: 'post',
        values: {},
      },
      {
        onSuccess: () => {
          alert('Session terminated successfully')
          window.location.reload()
        },
        onError: (error: any) => {
          alert(`Failed to terminate session: ${error.message}`)
        },
      }
    )
  }

  const handleExportLogs = () => {
    // TODO: Implement log export
    alert('Export logs functionality coming soon')
  }

  const handleCopySessionId = () => {
    if (sessionId) {
      navigator.clipboard.writeText(sessionId)
      alert('Session ID copied to clipboard')
    }
  }

  const handleLoadMore = () => {
    setTimelineOffset((prev) => prev + timelineLimit)
  }

  const handleLoadEarlier = () => {
    setTimelineOffset(0)
  }

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading session...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Session not found</p>
        <Button onClick={() => navigate('/sessions')}>Back to Sessions</Button>
      </div>
    )
  }

  // Calculate duration
  const durationMs =
    new Date(session.lastActivity).getTime() - new Date(session.createdAt).getTime()
  const durationMinutes = Math.floor(durationMs / 60000)
  const durationSeconds = Math.floor((durationMs % 60000) / 1000)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/sessions')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Sessions
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Session Details</h1>
      </div>

      {/* Session Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Session Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Session ID</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm">{session.sessionId.slice(0, 16)}...</p>
                <Button variant="ghost" size="sm" onClick={handleCopySessionId}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tenant</p>
              <p className="font-medium">
                {session.tenantId ? session.tenantId.slice(0, 12) + '...' : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Client ID</p>
              <p className="font-medium">{session.clientId}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <StatusBadge status={session.status} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="text-sm">
                {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Activity</p>
              <p className="text-sm">
                {formatDistanceToNow(new Date(session.lastActivity), { addSuffix: true })}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Workspace</p>
              <p className="font-mono text-xs">{session.workspaceDir}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Process</p>
              <p className="text-sm">
                {session.hasActiveProcess ? '✅ Active' : '❌ Inactive'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{session.messageCount}</div>
            <p className="text-xs text-muted-foreground">Total message count</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{`${durationMinutes}m ${durationSeconds}s`}</div>
            <p className="text-xs text-muted-foreground">Total session duration</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Timeline Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEvents}</div>
            <p className="text-xs text-muted-foreground">Total events recorded</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {events.filter((e) => e.type === 'api_error').length}
            </div>
            <p className="text-xs text-muted-foreground">API errors encountered</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button variant="outline" onClick={handleExportLogs}>
            <Download className="h-4 w-4 mr-2" />
            Export Logs
          </Button>
          {session.hasActiveProcess && (
            <Button variant="destructive" onClick={handleKillSession} disabled={isKilling}>
              <StopCircle className="h-4 w-4 mr-2" />
              {isKilling ? 'Terminating...' : 'Terminate Process'}
            </Button>
          )}
          <Button variant="outline" onClick={() => refetchTimeline()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Timeline
          </Button>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {timelineLoading && events.length === 0 ? (
            <p className="text-center text-muted-foreground">Loading events...</p>
          ) : events.length === 0 ? (
            <p className="text-center text-muted-foreground">No events recorded</p>
          ) : (
            <>
              {timelineOffset > 0 && (
                <Button variant="outline" onClick={handleLoadEarlier} className="w-full">
                  Load Earlier Events
                </Button>
              )}
              <div className="space-y-2">
                {events.map((event) => (
                  <TimelineEventCard key={event.id} event={event} />
                ))}
              </div>
              {timelineOffset + events.length < totalEvents && (
                <Button variant="outline" onClick={handleLoadMore} className="w-full">
                  Load More Events ({totalEvents - timelineOffset - events.length} remaining)
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
