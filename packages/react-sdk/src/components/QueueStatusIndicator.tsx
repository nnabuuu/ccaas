import React from 'react'
import type { ProcessingStatus, QueueDepth } from '../hooks/useQueueStatus'

export interface QueueStatusIndicatorProps {
  /** Current processing status */
  processingStatus: ProcessingStatus

  /** Queue depth statistics */
  queueDepth: QueueDepth

  /** Custom className for styling */
  className?: string

  /** Show detailed information (default: false) */
  showDetails?: boolean
}

/**
 * QueueStatusIndicator - Display message queue status
 *
 * Shows current queue processing status with visual indicators.
 *
 * **Status Types**:
 * - `idle` - No messages processing
 * - `processing` - Currently processing a message
 * - `retrying` - Message failed, will retry
 * - `completed` - Message completed successfully
 * - `failed` - Message permanently failed
 *
 * @example
 * ```tsx
 * function Chat() {
 *   const queue = useQueueStatus({ ... })
 *
 *   return (
 *     <div>
 *       <QueueStatusIndicator
 *         processingStatus={queue.processingStatus}
 *         queueDepth={queue.queueDepth}
 *         showDetails
 *       />
 *     </div>
 *   )
 * }
 * ```
 */
export function QueueStatusIndicator({
  processingStatus,
  queueDepth,
  className = '',
  showDetails = false,
}: QueueStatusIndicatorProps) {
  const { status, position, retryCount, maxRetries, error, durationMs } = processingStatus

  // Don't show anything if idle and queue empty
  if (status === 'idle' && queueDepth.total === 0) {
    return null
  }

  // Status colors and icons
  const statusConfig = {
    idle: {
      color: 'bg-gray-100 text-gray-700 border-gray-300',
      icon: '⏸️',
      label: '等待中',
    },
    processing: {
      color: 'bg-blue-100 text-blue-700 border-blue-300',
      icon: '⚙️',
      label: '处理中',
    },
    retrying: {
      color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      icon: '🔄',
      label: '重试中',
    },
    completed: {
      color: 'bg-green-100 text-green-700 border-green-300',
      icon: '✅',
      label: '已完成',
    },
    failed: {
      color: 'bg-red-100 text-red-700 border-red-300',
      icon: '❌',
      label: '失败',
    },
  }

  const config = statusConfig[status]

  return (
    <div
      className={`queue-status-indicator flex items-center gap-2 px-3 py-2 rounded-lg border ${config.color} ${className}`}
      role="status"
      aria-live="polite"
    >
      {/* Icon */}
      <span className="text-lg" aria-hidden="true">
        {config.icon}
      </span>

      {/* Status text */}
      <div className="flex-1">
        <div className="font-medium text-sm">
          {config.label}
          {status === 'processing' && position && position > 1 && (
            <span className="ml-1 text-xs opacity-75">
              (第 {position} 条)
            </span>
          )}
        </div>

        {/* Details */}
        {showDetails && (
          <div className="text-xs opacity-75 mt-0.5">
            {/* Queue depth */}
            {queueDepth.total > 0 && (
              <span>
                队列: {queueDepth.pending} 待处理 / {queueDepth.processing} 处理中
              </span>
            )}

            {/* Retry info */}
            {status === 'retrying' && retryCount !== undefined && maxRetries !== undefined && (
              <span className="ml-2">
                重试 {retryCount}/{maxRetries}
              </span>
            )}

            {/* Duration */}
            {status === 'completed' && durationMs !== undefined && (
              <span className="ml-2">
                耗时 {(durationMs / 1000).toFixed(1)}秒
              </span>
            )}

            {/* Error */}
            {status === 'failed' && error && (
              <div className="text-red-600 mt-1 max-w-md truncate" title={error}>
                错误: {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Spinner for processing/retrying */}
      {(status === 'processing' || status === 'retrying') && (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
    </div>
  )
}
