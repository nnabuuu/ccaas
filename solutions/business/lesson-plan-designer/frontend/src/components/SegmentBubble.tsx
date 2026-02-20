import { DisplaySegment, InlineToolCard } from '@kedge-agentic/react-sdk'

interface SegmentBubbleProps {
  segment: DisplaySegment
  /** Whether this is the last segment in the message (for streaming cursor) */
  isLast: boolean
}

/**
 * Renders a single display segment from a split message.
 *
 * **Rendering logic**:
 * - `type: 'text'` → Message bubble (same style as existing MessageBubble)
 * - `type: 'tool'` or `'tool-group'` → InlineToolCard(s), indented, no bubble
 * - Streaming cursor only shown on last segment when `isLast && segment.isStreaming`
 */
export function SegmentBubble({ segment, isLast }: SegmentBubbleProps) {
  // Tool segments: render inline tool cards without bubble
  if (segment.type === 'tool' || segment.type === 'tool-group') {
    return (
      <div className="ml-4">
        {segment.blocks.map((block, i) =>
          block.type === 'tool' ? (
            <InlineToolCard key={block.tool.toolId || i} tool={block.tool} />
          ) : null
        )}
      </div>
    )
  }

  // Text segment: render as bubble
  const textBlocks = segment.blocks.filter(b => b.type === 'text')
  const showStreamingCursor = isLast && segment.isStreaming

  return (
    <div className="message-assistant">
      <div className="text-sm leading-relaxed">
        {textBlocks.map((block, i) => (
          <span key={i} className="whitespace-pre-wrap">
            {block.text}
          </span>
        ))}
        {showStreamingCursor && (
          <span className="inline-block ml-1 w-0.5 h-4 bg-primary-500 animate-pulse" />
        )}
      </div>
    </div>
  )
}
