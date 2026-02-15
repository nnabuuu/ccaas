import { useMemo } from 'react'
import type {
  Message,
  DisplaySegment,
  SplitMessage,
  ContentBlock,
  SegmentType,
  OutputUpdate,
  UseMessageSplitterOptions,
  UseMessageSplitterReturn,
} from '../types'

/**
 * Splits messages into display segments for improved UX.
 *
 * **Splitting algorithm**:
 * - User/system messages → Not split (single text segment)
 * - Assistant messages → Split at tool boundaries
 *   - Adjacent text blocks → Merge into one 'text' segment
 *   - Adjacent tool blocks → Merge into one 'tool-group' segment
 *   - Single tool block → 'tool' segment
 *
 * **Output updates aggregation**:
 * - Collects all outputUpdates from assistant messages
 * - Deduplicates by field (same field → keeps latest by timestamp)
 *
 * **Performance**:
 * - Uses useMemo to cache results
 * - Only re-computes when messages array changes
 *
 * @example
 * ```tsx
 * const { splitMessages, outputUpdates } = useMessageSplitter({ messages })
 *
 * return (
 *   <>
 *     {splitMessages.map(splitMsg => (
 *       <AssistantMessageGroup key={splitMsg.messageId} splitMessage={splitMsg} />
 *     ))}
 *     <SyncCardPanel outputUpdates={outputUpdates} />
 *   </>
 * )
 * ```
 */
export function useMessageSplitter(options: UseMessageSplitterOptions): UseMessageSplitterReturn {
  const { messages, enabled = true } = options

  const splitMessages = useMemo(() => {
    if (!enabled) {
      // When disabled, wrap each message in a single text segment
      return messages.map(msg => createUnsplitMessage(msg))
    }

    return messages.map(msg => {
      // Only split assistant messages
      if (msg.role !== 'assistant') {
        return createUnsplitMessage(msg)
      }

      const blocks = msg.contentBlocks || []
      if (blocks.length === 0) {
        // Fallback: no contentBlocks but has content → single text segment
        return createFallbackTextMessage(msg)
      }

      const segments = splitIntoSegments(msg.id, blocks, msg.isStreaming || false)

      return {
        messageId: msg.id,
        role: msg.role,
        segments,
        tokenUsage: msg.tokenUsage,
        timestamp: msg.timestamp,
        original: msg,
      } satisfies SplitMessage
    })
  }, [messages, enabled])

  const outputUpdates = useMemo(() => {
    // Collect all output updates from assistant messages
    const allUpdates = messages
      .filter(msg => msg.role === 'assistant' && msg.outputUpdates)
      .flatMap(msg => msg.outputUpdates || [])

    // Deduplicate: same field → keep latest by timestamp
    const latestByField = new Map<string, OutputUpdate>()
    for (const update of allUpdates) {
      const existing = latestByField.get(update.field)
      if (!existing || (update.timestamp || 0) > (existing.timestamp || 0)) {
        latestByField.set(update.field, update)
      }
    }

    return Array.from(latestByField.values())
  }, [messages])

  return { splitMessages, outputUpdates }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a single-segment SplitMessage for non-assistant or disabled mode
 */
function createUnsplitMessage(msg: Message): SplitMessage {
  const blocks = msg.contentBlocks || []
  const segment: DisplaySegment = {
    id: `${msg.id}-seg-0`,
    type: 'text',
    blocks: blocks.length > 0 ? blocks : [{ type: 'text', text: msg.content }],
    isStreaming: msg.isStreaming || false,
  }

  return {
    messageId: msg.id,
    role: msg.role,
    segments: [segment],
    tokenUsage: msg.tokenUsage,
    timestamp: msg.timestamp,
    original: msg,
  }
}

/**
 * Fallback for messages with no contentBlocks but has content
 */
function createFallbackTextMessage(msg: Message): SplitMessage {
  const segment: DisplaySegment = {
    id: `${msg.id}-seg-0`,
    type: 'text',
    blocks: [{ type: 'text', text: msg.content }],
    isStreaming: msg.isStreaming || false,
  }

  return {
    messageId: msg.id,
    role: msg.role,
    segments: [segment],
    tokenUsage: msg.tokenUsage,
    timestamp: msg.timestamp,
    original: msg,
  }
}

/**
 * Split content blocks into segments.
 *
 * **Algorithm**:
 * - Consecutive blocks of the same base type (text or tool) are merged
 * - Single tool block → 'tool' segment
 * - Multiple consecutive tool blocks → 'tool-group' segment
 * - Text blocks → 'text' segment
 */
function splitIntoSegments(
  messageId: string,
  blocks: ContentBlock[],
  isStreaming: boolean
): DisplaySegment[] {
  if (blocks.length === 0) return []

  const segments: DisplaySegment[] = []
  let currentSegmentBlocks: ContentBlock[] = []
  let currentType: 'text' | 'tool' | null = null

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const blockType = block.type // 'text' or 'tool'

    if (currentType === null) {
      // Start first segment
      currentType = blockType
      currentSegmentBlocks = [block]
    } else if (blockType === currentType) {
      // Same type → continue accumulating
      currentSegmentBlocks.push(block)
    } else {
      // Type changed → finalize current segment
      segments.push(createSegment(
        messageId,
        segments.length,
        currentType,
        currentSegmentBlocks,
        false // Not the last segment yet
      ))

      // Start new segment
      currentType = blockType
      currentSegmentBlocks = [block]
    }
  }

  // Finalize last segment
  if (currentSegmentBlocks.length > 0 && currentType !== null) {
    segments.push(createSegment(
      messageId,
      segments.length,
      currentType,
      currentSegmentBlocks,
      isStreaming // Last segment inherits streaming state
    ))
  }

  return segments
}

/**
 * Create a DisplaySegment from accumulated blocks
 */
function createSegment(
  messageId: string,
  index: number,
  type: 'text' | 'tool',
  blocks: ContentBlock[],
  isStreaming: boolean
): DisplaySegment {
  let segmentType: SegmentType
  if (type === 'text') {
    segmentType = 'text'
  } else {
    // Tool blocks: single → 'tool', multiple → 'tool-group'
    segmentType = blocks.length === 1 ? 'tool' : 'tool-group'
  }

  return {
    id: `${messageId}-seg-${index}`,
    type: segmentType,
    blocks,
    isStreaming,
  }
}
