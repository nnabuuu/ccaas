import { useSessionContext } from '../../context/SessionContext'

export function StatusBar() {
  const { connection, status } = useSessionContext()

  return (
    <footer className="h-8 border-t border-border bg-surface-secondary flex items-center px-4 gap-4 text-xs text-ink-muted shrink-0">
      <span className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${connection.connected ? 'bg-success' : 'bg-error'}`} />
        {connection.connected ? '已连接' : '未连接'}
      </span>

      {status.tokenUsage && (
        <span>
          Tokens: {status.tokenUsage.inputTokens.toLocaleString()} in / {status.tokenUsage.outputTokens.toLocaleString()} out
        </span>
      )}

      {status.isProcessing && (
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          处理中...
        </span>
      )}
    </footer>
  )
}
