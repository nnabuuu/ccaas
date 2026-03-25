import type { ContentBlock, TextBlock, WidgetBlock, FileBlock, NextAction } from '@/types/chat'
import type { JsonRenderSpec } from '@/types/widget'

// ===== LLM Content Block (Anthropic API format) =====

interface LlmContentBlock {
  type: 'text' | 'tool_use'
  text?: string
  name?: string
  input?: Record<string, unknown>
}

/**
 * Parse LLM raw output (Anthropic content blocks) into ContentBlocks.
 *
 * Routing rules:
 * - text block → TextBlock (Markdown)
 * - tool_use name=render_widget → WidgetBlock (json-render spec)
 * - tool_use name=generate_file → FileBlock
 * - tool_use name=suggest_actions → extracted separately via extractNextActions
 * - tool_use name=other → PendingMcpCall (Phase 2)
 *
 * Phase 1: Not directly used — backend processes tool_use server-side.
 * Kept for Phase 2 when client-side tool routing is needed.
 */
export function parseLlmResponse(
  blocks: LlmContentBlock[],
): { content: ContentBlock[]; pendingMcpCalls: PendingMcpCall[] } {
  const content: ContentBlock[] = []
  const pendingMcpCalls: PendingMcpCall[] = []

  for (const block of blocks) {
    if (block.type === 'text' && block.text) {
      content.push({ type: 'text', content: block.text } satisfies TextBlock)
    }

    if (block.type === 'tool_use' && block.name && block.input) {
      switch (block.name) {
        case 'render_widget': {
          const spec = block.input as unknown as JsonRenderSpec
          content.push({ type: 'widget', spec } satisfies WidgetBlock)
          break
        }
        case 'generate_file': {
          content.push({
            type: 'file',
            fileName: (block.input.fileName as string) ?? 'output',
            fileType: (block.input.fileType as string) ?? 'application/octet-stream',
            downloadUrl: (block.input.downloadUrl as string) ?? '',
            description: block.input.description as string | undefined,
          } satisfies FileBlock)
          break
        }
        default: {
          pendingMcpCalls.push({
            toolName: block.name,
            params: block.input,
          })
        }
      }
    }
  }

  return { content, pendingMcpCalls }
}

export interface PendingMcpCall {
  toolName: string
  params: Record<string, unknown>
}

/**
 * Extract next_actions from LLM output.
 * LLM declares follow-up actions via tool_use name=suggest_actions.
 */
export function extractNextActions(
  blocks: LlmContentBlock[],
): NextAction[] | undefined {
  for (const block of blocks) {
    if (block.type === 'tool_use' && block.name === 'suggest_actions' && block.input) {
      const actions = block.input.actions as Array<{
        label: string
        prompt: string
        skill_hint?: string
      }>
      return actions?.map(a => ({
        label: a.label,
        prompt: a.prompt,
        skillHint: a.skill_hint,
      }))
    }
  }
  return undefined
}

// ===== Phase 1: Text-based widget extraction =====

/**
 * Parse assistant message text to extract content blocks.
 *
 * Phase 1 approach: LLM outputs widget specs as ```widget JSON fenced blocks
 * in the text response. This function splits the text into text blocks and
 * widget blocks.
 *
 * @param text - The assistant message content string
 * @param isStreaming - Whether the message is still being streamed.
 *   When true, incomplete ```widget blocks are hidden to prevent
 *   partial JSON from being shown to the user.
 */
export function parseAssistantContent(text: string, isStreaming = false): ContentBlock[] {
  const blocks: ContentBlock[] = []
  const widgetRegex = /```widget\s*\n([\s\S]*?)```/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = widgetRegex.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index).trim()
    if (before) {
      blocks.push({ type: 'text', content: before })
    }

    try {
      const spec = JSON.parse(match[1]) as JsonRenderSpec
      blocks.push({ type: 'widget', spec })
    } catch {
      // JSON parse failed — treat as text
      blocks.push({ type: 'text', content: match[0] })
    }

    lastIndex = match.index + match[0].length
  }

  const remaining = text.slice(lastIndex).trim()
  if (remaining) {
    if (isStreaming && remaining.includes('```widget')) {
      // During streaming, hide incomplete widget blocks
      const widgetStart = remaining.indexOf('```widget')
      const beforeWidget = remaining.slice(0, widgetStart).trim()
      if (beforeWidget) {
        blocks.push({ type: 'text', content: beforeWidget })
      }
      // Don't render the partial widget — wait for completion
    } else {
      blocks.push({ type: 'text', content: remaining })
    }
  }

  if (blocks.length === 0 && text.trim()) {
    blocks.push({ type: 'text', content: text })
  }

  return blocks
}
