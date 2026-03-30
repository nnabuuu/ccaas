/**
 * Connection Status Component
 *
 * Displays connection status and provides reconnect action
 */

import { WifiHigh, Warning } from '@phosphor-icons/react'

interface ConnectionStatusProps {
  connected: boolean
  error: string | null
  onReconnect?: () => void
}

export default function ConnectionStatus({
  connected,
  error,
  onReconnect,
}: ConnectionStatusProps) {
  if (connected && !error) {
    return (
      <div className="flex items-center gap-2 text-xs text-ck-success-t">
        <span className="w-2 h-2 bg-ck-success-t rounded-full animate-pulse" />
        已连接
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 text-xs text-ck-danger-t">
        <span className="w-2 h-2 bg-ck-danger-t rounded-full" />
        连接断开
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-1 bg-ck-danger-bg border border-ck-b1 rounded-lg">
          <Warning weight="regular" className="w-4 h-4 text-ck-danger-t" />
          <span className="text-xs text-ck-danger-t">{error}</span>
        </div>
      )}

      {onReconnect && (
        <button
          onClick={onReconnect}
          className="flex items-center gap-1 px-3 py-1 text-xs text-ck-accent hover:text-ck-accent-hover border border-ck-b1 rounded-lg hover:bg-ck-bg3 transition-all duration-200 ease-claude"
        >
          <WifiHigh weight="regular" className="w-4 h-4" />
          重新连接
        </button>
      )}
    </div>
  )
}
