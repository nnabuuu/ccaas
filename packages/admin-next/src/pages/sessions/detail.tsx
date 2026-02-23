import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCustom, useCustomMutation, HttpError } from '@refinedev/core'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/shared/stat-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { WorkspaceExplorer } from '@/components/workspace/workspace-explorer'
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
  Coins,
  ListOrdered,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration, formatTokens, formatCost } from '@/lib/format'
import { Badge } from '@/components/ui/badge'

interface SessionQueueStatus {
  total: number
  pending: number
  processing: number
}

interface TokenBreakdown {
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  reasoningTokens: number
  totalTokens: number
  estimatedCost: number
}

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

// Type-safe timeline events with discriminated union
interface MessageEventData {
  role: string
  content: string
  messageIndex?: number
}

interface ToolEventData {
  toolName: string
  phase: string
  success?: boolean
  durationMs?: number
  input?: unknown
  output?: unknown
}

interface ThinkingBlockData {
  status: string
  thinkingTokens?: number
  durationMs?: number
  content?: string
}

interface ProcessEventData {
  eventType: string
  pid?: number
  exitCode?: number
  signal?: string
  errorMessage?: string
}

interface ApiErrorData {
  errorType: string
  statusCode?: number
  errorMessage?: string
  errorCode?: string
  retryAttempt?: number
  wasRetried?: boolean
}

type TimelineEvent =
  | { id: string; type: 'message'; timestamp: string; data: MessageEventData }
  | { id: string; type: 'tool_event'; timestamp: string; data: ToolEventData }
  | { id: string; type: 'thinking_block'; timestamp: string; data: ThinkingBlockData }
  | { id: string; type: 'process_event'; timestamp: string; data: ProcessEventData }
  | { id: string; type: 'api_error'; timestamp: string; data: ApiErrorData }

const EVENT_ICONS = {
  message: MessageSquare,
  tool_event: Wrench,
  thinking_block: Brain,
  process_event: Activity,
  api_error: AlertTriangle,
} as const

const EVENT_COLORS = {
  message: 'text-blue-500',
  tool_event: 'text-green-500',
  thinking_block: 'text-yellow-500',
  process_event: 'text-gray-500',
  api_error: 'text-red-500',
} as const

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
            {(event.data.input && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Input
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto">
                  {JSON.stringify(event.data.input, null, 2)}
                </pre>
              </details>
            )) as React.ReactNode}
            {(event.data.output && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Output
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto">
                  {JSON.stringify(event.data.output, null, 2)}
                </pre>
              </details>
            )) as React.ReactNode}
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
  const [activeTab, setActiveTab] = useState<'timeline' | 'files'>('timeline')
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

  // Fetch token breakdown
  const { data: tokenData } = useCustom<TokenBreakdown>({
    url: `/admin/sessions/${sessionId}/tokens`,
    method: 'get',
  })

  // Fetch queue status
  const { data: queueData } = useCustom<SessionQueueStatus>({
    url: `/api/v1/sessions/${sessionId}/queue`,
    method: 'get',
  })

  // Kill session mutation
  const { mutate: killSession, isLoading: isKilling } = useCustomMutation()

  const session = sessionData?.data
  const timeline = timelineData?.data
  const tokenBreakdown = tokenData?.data
  const queueStatus = queueData?.data
  const events = timeline?.events || []
  const totalEvents = timeline?.totalEvents || 0

  // Copy session ID with error handling
  const handleCopySessionId = useCallback(async () => {
    if (!sessionId) return
    try {
      await navigator.clipboard.writeText(sessionId)
      // TODO: Replace with toast notification
    } catch (error) {
      console.warn('Failed to copy session ID:', error)
    }
  }, [sessionId])

  const handleKillSession = async () => {
    // TODO: Replace confirm() with shadcn AlertDialog
    if (!sessionId || !confirm('Are you sure you want to terminate this session?')) return

    killSession(
      {
        url: `/admin/sessions/${sessionId}/kill`,
        method: 'post',
        values: {},
      },
      {
        onSuccess: () => {
          // TODO: Replace alert() with toast notification
          alert('Session terminated successfully')
          window.location.reload()
        },
        onError: (error: HttpError) => {
          // TODO: Replace alert() with toast notification
          alert(`Failed to terminate session: ${error.message}`)
        },
      }
    )
  }

  const handleExportLogs = () => {
    // TODO: Implement log export
    alert('Export logs functionality coming soon')
  }

  const handleLoadMore = () => {
    setTimelineOffset((prev) => prev + timelineLimit)
  }

  const handleJumpToStart = () => {
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopySessionId}
                  aria-label="Copy session ID"
                >
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
              {session.hasActiveProcess ? (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-3 w-3" /> Active
                </span>
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <XCircle className="h-3 w-3" /> Inactive
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Metrics - Using shared StatCard component */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Messages"
          value={session.messageCount}
          icon={MessageSquare}
          description="Total message count"
        />
        <StatCard
          title="Duration"
          value={formatDuration(
            new Date(session.lastActivity).getTime() - new Date(session.createdAt).getTime()
          )}
          icon={Clock}
          description="Total session duration"
        />
        <StatCard
          title="Timeline Events"
          value={totalEvents}
          icon={Activity}
          description="Total events recorded"
        />
        <StatCard
          title="Errors"
          value={events.filter((e) => e.type === 'api_error').length}
          icon={AlertTriangle}
          description="API errors encountered"
        />
      </div>

      {/* Token Usage Breakdown */}
      {tokenBreakdown && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Token Usage & Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Tokens</p>
                <p className="text-2xl font-bold">{formatTokens(tokenBreakdown.totalTokens)}</p>
                <p className="text-xs text-muted-foreground">
                  {tokenBreakdown.totalTokens.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Estimated Cost</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCost(tokenBreakdown.estimatedCost)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Input Tokens</p>
                <p className="text-xl font-semibold">{formatTokens(tokenBreakdown.inputTokens)}</p>
                <p className="text-xs text-muted-foreground">
                  {tokenBreakdown.inputTokens.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Output Tokens</p>
                <p className="text-xl font-semibold">
                  {formatTokens(tokenBreakdown.outputTokens)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tokenBreakdown.outputTokens.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Cached Input</p>
                <p className="text-xl font-semibold">
                  {formatTokens(tokenBreakdown.cachedInputTokens)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tokenBreakdown.cachedInputTokens.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Cache Read</p>
                <p className="text-xl font-semibold">
                  {formatTokens(tokenBreakdown.cacheReadTokens)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tokenBreakdown.cacheReadTokens.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Cache Creation</p>
                <p className="text-xl font-semibold">
                  {formatTokens(tokenBreakdown.cacheCreationTokens)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tokenBreakdown.cacheCreationTokens.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Reasoning Tokens</p>
                <p className="text-xl font-semibold">
                  {formatTokens(tokenBreakdown.reasoningTokens)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tokenBreakdown.reasoningTokens.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue Status */}
      {queueStatus && queueStatus.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListOrdered className="h-5 w-5" />
              Queue Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Pending:</span>
                <Badge variant="secondary">{queueStatus.pending}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Processing:</span>
                <Badge variant={queueStatus.processing > 0 ? 'default' : 'secondary'}>
                  {queueStatus.processing}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Total:</span>
                <Badge variant="outline">{queueStatus.total}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Timeline & Files Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'timeline' | 'files')}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="files">Workspace Files</TabsTrigger>
        </TabsList>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
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
                    <Button variant="outline" onClick={handleJumpToStart} className="w-full">
                      Jump to Start
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
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files">
          <Card>
            <CardContent className="p-0 h-[600px]">
              {sessionId && <WorkspaceExplorer sessionId={sessionId} />}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
