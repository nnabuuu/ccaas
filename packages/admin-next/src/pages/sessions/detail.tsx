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
  Hash,
  FileOutput,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration, formatTokens, formatCost } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

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

interface OutputUpdateData {
  toolName: string
  data: unknown
  status: string
  progress?: number
}

interface TurnSummary {
  turnId: string
  turnNumber: number
  userMessageId: string
  assistantMessageId: string | null
  totalTokens: number
  durationMs: number
  createdAt: string
  completedAt: string | null
  toolCount: number
  hasThinking: boolean
  hasErrors: boolean
}

type TimelineEvent =
  | { id: string; type: 'message'; timestamp: string; messageId: string | null; turnNumber: number | null; data: MessageEventData }
  | { id: string; type: 'tool_event'; timestamp: string; messageId: string | null; turnNumber: number | null; data: ToolEventData }
  | { id: string; type: 'thinking_block'; timestamp: string; messageId: string | null; turnNumber: number | null; data: ThinkingBlockData }
  | { id: string; type: 'process_event'; timestamp: string; messageId: string | null; turnNumber: number | null; data: ProcessEventData }
  | { id: string; type: 'api_error'; timestamp: string; messageId: string | null; turnNumber: number | null; data: ApiErrorData }
  | { id: string; type: 'output_update'; timestamp: string; messageId: string | null; turnNumber: number | null; data: OutputUpdateData }

const EVENT_ICONS = {
  message: MessageSquare,
  tool_event: Wrench,
  thinking_block: Brain,
  process_event: Activity,
  api_error: AlertTriangle,
  output_update: FileOutput,
} as const

const EVENT_COLORS = {
  message: 'text-blue-500',
  tool_event: 'text-green-500',
  thinking_block: 'text-yellow-500',
  process_event: 'text-gray-500',
  api_error: 'text-red-500',
  output_update: 'text-purple-500',
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
      case 'output_update':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{event.data.toolName}</span>
              <Badge variant="outline" className="text-xs">{event.data.status}</Badge>
              {event.data.progress !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {Math.round(event.data.progress * 100)}%
                </span>
              )}
            </div>
            {(event.data.data && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Data</summary>
                <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto">
                  {JSON.stringify(event.data.data, null, 2)}
                </pre>
              </details>
            )) as React.ReactNode}
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
        {event.turnNumber !== null && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            T{event.turnNumber}
          </Badge>
        )}
      </div>
      <div className="flex-1">{renderEventContent()}</div>
    </div>
  )
}

export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'timeline' | 'turns' | 'files'>('timeline')
  const [timelineOffset, setTimelineOffset] = useState(0)
  const timelineLimit = 50
  const [filterTurnNumber, setFilterTurnNumber] = useState<number | undefined>(undefined)
  const [isExporting, setIsExporting] = useState(false)
  const [showKillDialog, setShowKillDialog] = useState(false)

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
        ...(filterTurnNumber !== undefined ? { turnNumber: filterTurnNumber } : {}),
      },
    },
  })

  // Fetch turns
  const { data: turnsData } = useCustom<TurnSummary[]>({
    url: `/admin/sessions/${sessionId}/turns`,
    method: 'get',
  })
  const turns = turnsData?.data || []

  // Fetch token breakdown
  const { data: tokenData } = useCustom<TokenBreakdown>({
    url: `/admin/sessions/${sessionId}/tokens`,
    method: 'get',
  })

  // Fetch queue status
  const { data: queueData } = useCustom<SessionQueueStatus>({
    url: `/sessions/${sessionId}/queue`,
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
      toast.success('Session ID copied')
    } catch (error) {
      console.warn('Failed to copy session ID:', error)
    }
  }, [sessionId])

  const handleKillSession = () => {
    setShowKillDialog(true)
  }

  const confirmKillSession = () => {
    if (!sessionId) return
    killSession(
      {
        url: `/admin/sessions/${sessionId}/kill`,
        method: 'post',
        values: {},
      },
      {
        onSuccess: () => {
          toast.success('Session terminated successfully')
          window.location.reload()
        },
        onError: (error: HttpError) => {
          toast.error(`Failed to terminate session: ${error.message}`)
        },
      }
    )
  }

  const handleExportLogs = async () => {
    if (!sessionId) return
    setIsExporting(true)
    try {
      const { data } = await apiClient.get(`/admin/sessions/${sessionId}/timeline`, {
        params: { limit: 1000, offset: 0 },
      })
      const exportData = {
        exportedAt: new Date().toISOString(),
        session,
        timeline: data,
      }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `session-${sessionId}-logs.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to export logs')
    } finally {
      setIsExporting(false)
    }
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
          <Button variant="outline" onClick={handleExportLogs} disabled={isExporting}>
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export Logs'}
          </Button>
          {session.hasActiveProcess && (
            <Button variant="destructive" onClick={handleKillSession} disabled={isKilling}>
              <StopCircle className="h-4 w-4 mr-2" />
              {isKilling ? 'Terminating...' : 'Terminate Process'}
            </Button>
          )}
          <AlertDialog open={showKillDialog} onOpenChange={setShowKillDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Terminate Session</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to terminate this session? The running process will be stopped immediately.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmKillSession} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Terminate
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" onClick={() => refetchTimeline()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Timeline
          </Button>
        </CardContent>
      </Card>

      {/* Timeline, Turns & Files Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'timeline' | 'turns' | 'files')}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="turns">
            Turns{turns.length > 0 && ` (${turns.length})`}
          </TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Timeline</CardTitle>
                {turns.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <select
                      className="text-sm border rounded px-2 py-1 bg-background"
                      value={filterTurnNumber ?? ''}
                      onChange={(e) => {
                        const val = e.target.value
                        setFilterTurnNumber(val === '' ? undefined : Number(val))
                        setTimelineOffset(0)
                      }}
                    >
                      <option value="">All turns</option>
                      {turns.map((t) => (
                        <option key={t.turnNumber} value={t.turnNumber}>
                          Turn {t.turnNumber}
                        </option>
                      ))}
                    </select>
                    {filterTurnNumber !== undefined && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setFilterTurnNumber(undefined); setTimelineOffset(0) }}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {timelineLoading && events.length === 0 ? (
                <p className="text-center text-muted-foreground">Loading events...</p>
              ) : events.length === 0 ? (
                <p className="text-center text-muted-foreground">
                  {filterTurnNumber !== undefined ? `No events for turn ${filterTurnNumber}` : 'No events recorded'}
                </p>
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

        {/* Turns Tab */}
        <TabsContent value="turns">
          <Card>
            <CardHeader>
              <CardTitle>Turns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {turns.length === 0 ? (
                <p className="text-center text-muted-foreground">No turns recorded</p>
              ) : (
                turns.map((turn) => (
                  <div
                    key={turn.turnId}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => {
                      setFilterTurnNumber(turn.turnNumber)
                      setTimelineOffset(0)
                      setActiveTab('timeline')
                    }}
                  >
                    <Badge variant="secondary" className="text-sm font-mono min-w-[48px] justify-center">
                      T{turn.turnNumber}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">
                          {format(new Date(turn.createdAt), 'HH:mm:ss')}
                        </span>
                        {turn.completedAt ? (
                          <span className="text-muted-foreground">
                            — {formatDuration(turn.durationMs)}
                          </span>
                        ) : (
                          <Badge variant="outline" className="text-xs">In progress</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {turn.toolCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Wrench className="h-3 w-3" /> {turn.toolCount}
                        </span>
                      )}
                      {turn.hasThinking && (
                        <Brain className="h-3 w-3 text-yellow-500" />
                      )}
                      {turn.hasErrors && (
                        <AlertTriangle className="h-3 w-3 text-red-500" />
                      )}
                      <span>{formatTokens(turn.totalTokens)}</span>
                    </div>
                  </div>
                ))
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
