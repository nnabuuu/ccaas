import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StatusBadge } from '@/components/shared/status-badge'
import { AlertCircle, Clock, Coins, RotateCcw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { formatDuration, formatTokens } from '@/lib/format'

interface Execution {
  id: string
  status: string
  startedAt: string
  completedAt?: string
  errorMessage?: string
  resultData?: Record<string, unknown>
  tokenUsage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  attempts?: number
}

interface ExecutionDetailModalProps {
  execution: Execution | null
  onClose: () => void
}

/**
 * ExecutionDetailModal - Display detailed execution information
 *
 * Shows status, metrics (duration, tokens, attempts), and result/error logs
 */
export function ExecutionDetailModal({ execution, onClose }: ExecutionDetailModalProps) {
  if (!execution) {
    return null
  }

  const duration = execution.completedAt
    ? new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()
    : null

  const totalTokens = execution.tokenUsage?.totalTokens || 0
  const attempts = execution.attempts || 1

  return (
    <Dialog open={!!execution} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Execution Details</DialogTitle>
          <p className="text-sm text-muted-foreground font-mono">{execution.id}</p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <StatusBadge status={execution.status} />
                <span className="text-sm text-muted-foreground">
                  Started {formatDistanceToNow(new Date(execution.startedAt), { addSuffix: true })}
                </span>
              </div>

              {/* Error Alert */}
              {execution.status === 'failed' && execution.errorMessage && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="ml-2">
                    <p className="font-semibold">Error:</p>
                    <pre className="mt-2 text-xs whitespace-pre-wrap font-mono">
                      {execution.errorMessage}
                    </pre>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Metrics Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {/* Duration */}
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="text-lg font-semibold">
                    {duration ? formatDuration(duration) : 'Running...'}
                  </p>
                </div>

                {/* Tokens */}
                {totalTokens > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Total Tokens</p>
                    <p className="text-lg font-semibold flex items-center gap-1">
                      <Coins className="h-4 w-4 text-muted-foreground" />
                      {formatTokens(totalTokens)}
                    </p>
                    {execution.tokenUsage && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTokens(execution.tokenUsage.inputTokens)} in /{' '}
                        {formatTokens(execution.tokenUsage.outputTokens)} out
                      </p>
                    )}
                  </div>
                )}

                {/* Attempts */}
                <div>
                  <p className="text-sm text-muted-foreground">Attempts</p>
                  <p className="text-lg font-semibold flex items-center gap-1">
                    <RotateCcw className="h-4 w-4 text-muted-foreground" />
                    {attempts}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Result Card */}
          {execution.resultData && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Result</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto font-mono">
                  {JSON.stringify(execution.resultData, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Timing Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Timing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Started:</span>
                <span className="font-mono">{new Date(execution.startedAt).toLocaleString()}</span>
              </div>
              {execution.completedAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Completed:</span>
                  <span className="font-mono">
                    {new Date(execution.completedAt).toLocaleString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
