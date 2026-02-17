/**
 * Connection Status Component
 *
 * Displays connection status and provides reconnect action
 */

import { WifiIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

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
      <div className="flex items-center gap-2 text-xs text-green-600">
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        已连接
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 text-xs text-red-600">
        <span className="w-2 h-2 bg-red-500 rounded-full" />
        连接断开
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-1 bg-red-50 border border-red-200 rounded-lg">
          <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
          <span className="text-xs text-red-700">{error}</span>
        </div>
      )}

      {onReconnect && (
        <button
          onClick={onReconnect}
          className="flex items-center gap-1 px-3 py-1 text-xs text-blue-600 hover:text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
        >
          <WifiIcon className="w-4 h-4" />
          重新连接
        </button>
      )}
    </div>
  )
}
