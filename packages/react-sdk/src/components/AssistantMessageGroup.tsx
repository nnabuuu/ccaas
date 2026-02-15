import type { SplitMessage, OutputUpdate, TokenUsage } from '../types'
import { DefaultSyncButton } from './DefaultSyncButton'

export interface AssistantMessageGroupProps {
  splitMessage: SplitMessage
  tokenUsage?: TokenUsage
  timestamp?: Date

  // SyncButton related props
  outputUpdates?: OutputUpdate[]
  onSync?: (field: string) => void
  onDiscard?: (field: string) => void

  // Customization functions
  renderSyncButton?: (update: OutputUpdate, onSync: () => void, onDiscard: () => void) => React.ReactNode
  renderTokenUsage?: (usage: TokenUsage) => React.ReactNode
  renderSegment?: (segment: SplitMessage['segments'][0], isLast: boolean) => React.ReactNode
}

/**
 * AssistantMessageGroup - Renders a split assistant message as a group of segments
 *
 * **Features**:
 * - ✅ Avatar displayed once at the top
 * - ✅ Each segment rendered via custom or default renderer
 * - ✅ Output Updates (SyncButtons) displayed after segments (message round binding)
 * - ✅ Token usage and timestamp displayed at the bottom
 * - ✅ Fully customizable via render props
 *
 * **Layout**:
 * ```
 * [Avatar] Segment 1 (text bubble)
 *          Segment 2 (tool cards, indented)
 *          Segment 3 (text bubble)
 *          ---
 *          SyncButtons (if outputUpdates provided)
 *          ---
 *          Token Usage Footer (if tokenUsage provided)
 *          Timestamp (if timestamp provided)
 * ```
 *
 * **Message Round Binding**:
 * SyncButtons are bound to the specific message round (not global aggregation).
 * Each assistant message displays its own output updates.
 *
 * @example
 * ```tsx
 * import { AssistantMessageGroup } from '@ccaas/react-sdk'
 *
 * // Basic usage (no SyncButtons)
 * <AssistantMessageGroup splitMessage={msg} />
 *
 * // With SyncButtons (message round binding)
 * <AssistantMessageGroup
 *   splitMessage={msg}
 *   outputUpdates={msg.original.outputUpdates}
 *   onSync={(field) => handleSync(field)}
 *   onDiscard={(field) => handleDiscard(field)}
 * />
 *
 * // With custom SyncButton renderer
 * <AssistantMessageGroup
 *   splitMessage={msg}
 *   outputUpdates={msg.original.outputUpdates}
 *   onSync={handleSync}
 *   onDiscard={handleDiscard}
 *   renderSyncButton={(update, onSync, onDiscard) => (
 *     <CustomSyncButton ... />
 *   )}
 * />
 * ```
 */
export function AssistantMessageGroup({
  splitMessage,
  tokenUsage,
  timestamp,
  outputUpdates,
  onSync,
  onDiscard,
  renderSyncButton,
  renderTokenUsage,
  renderSegment,
}: AssistantMessageGroupProps) {
  const { segments } = splitMessage

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        <div className="flex items-start gap-2">
          {/* Avatar */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>

          <div className="flex-1">
            {/* Segments */}
            <div className="space-y-1">
              {segments.map((segment, index) =>
                renderSegment ? (
                  <div key={segment.id}>
                    {renderSegment(segment, index === segments.length - 1)}
                  </div>
                ) : (
                  <DefaultSegmentRenderer key={segment.id} segment={segment} />
                )
              )}
            </div>

            {/* Output Updates (Sync Buttons) - Message Round Binding */}
            {outputUpdates && outputUpdates.length > 0 && (
              <div className="mt-2 space-y-2">
                {outputUpdates.map((update) =>
                  renderSyncButton ? (
                    <div key={update.field}>
                      {renderSyncButton(update, () => onSync?.(update.field), () => onDiscard?.(update.field))}
                    </div>
                  ) : (
                    <DefaultSyncButton
                      key={update.field}
                      update={update}
                      onSync={() => onSync?.(update.field)}
                      onDiscard={() => onDiscard?.(update.field)}
                    />
                  )
                )}
              </div>
            )}

            {/* Token Usage */}
            {tokenUsage && (
              <div className="mt-1.5">
                {renderTokenUsage ? (
                  renderTokenUsage(tokenUsage)
                ) : (
                  <DefaultTokenUsageRenderer usage={tokenUsage} />
                )}
              </div>
            )}

            {/* Timestamp */}
            {timestamp && (
              <div className="mt-1 text-xs text-gray-400">
                {timestamp.toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Default Renderers
// ============================================================================

function DefaultSegmentRenderer({ segment }: { segment: SplitMessage['segments'][0] }) {
  if (segment.type === 'text') {
    return (
      <div className="px-4 py-2 bg-gray-100 rounded-md text-sm leading-relaxed whitespace-pre-wrap">
        {segment.blocks.map((block, i) => (
          <span key={i}>{block.type === 'text' ? block.text : ''}</span>
        ))}
      </div>
    )
  }

  // Tool/tool-group segments (indented, no bubble)
  return (
    <div className="ml-4 text-xs text-gray-500">
      {segment.blocks.map((block, i) => (
        <div key={i}>
          {block.type === 'tool' ? `[Tool: ${block.tool.toolName}]` : ''}
        </div>
      ))}
    </div>
  )
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function DefaultTokenUsageRenderer({ usage }: { usage: TokenUsage }) {
  const cacheTokens = usage.cacheReadTokens ?? 0
  return (
    <div className="pt-1.5 border-t border-gray-200/60 flex items-center gap-3 text-[11px] text-gray-400">
      <span>{'\u2193'}{formatTokens(usage.inputTokens)} {'\u2191'}{formatTokens(usage.outputTokens)}</span>
      {cacheTokens > 0 && (
        <span>{'\u26A1'}{formatTokens(cacheTokens)} cached</span>
      )}
    </div>
  )
}
