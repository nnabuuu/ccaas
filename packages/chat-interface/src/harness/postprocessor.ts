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

// ===== Tool-as-Widget conversion =====

/** Widget tool names that the frontend intercepts and renders as UI components */
const WIDGET_TOOLS = new Set(['show_info_card', 'suggest_actions'])

export function isWidgetTool(name: string | undefined): boolean {
  return !!name && WIDGET_TOOLS.has(name)
}

/** SDK content block shape (from @kedge-agentic/react-sdk) */
interface SdkBlock {
  type: string
  text?: string
  tool?: {
    toolName: string
    toolInput?: unknown
    phase: string
  }
}

interface SdkProcessResult {
  contentBlocks: ContentBlock[]
  nextActions?: NextAction[]
}

/**
 * Build chat ContentBlocks from react-sdk contentBlocks (TextBlock + ToolBlock).
 * Converts widget tool calls (show_info_card, suggest_actions) to renderable blocks.
 */
export function buildContentBlocksFromSdkBlocks(
  sdkBlocks: SdkBlock[],
  isStreaming: boolean,
): SdkProcessResult {
  const contentBlocks: ContentBlock[] = []
  let nextActions: NextAction[] | undefined

  // Find last text block index for streaming handling
  let lastTextIndex = -1
  if (isStreaming) {
    for (let i = sdkBlocks.length - 1; i >= 0; i--) {
      if (sdkBlocks[i].type === 'text') { lastTextIndex = i; break }
    }
  }

  for (let i = 0; i < sdkBlocks.length; i++) {
    const block = sdkBlocks[i]

    if (block.type === 'text' && block.text) {
      // Parse each text segment for Phase 1 ```widget/```file blocks (backward compat)
      const isLastTextStreaming = isStreaming && i === lastTextIndex
      const parsed = parseAssistantContent(block.text, isLastTextStreaming)
      contentBlocks.push(...parsed)
    } else if (block.type === 'tool' && block.tool) {
      const { toolName, toolInput, phase } = block.tool

      // Only process completed tool calls
      if (phase !== 'end') continue

      if (toolName === 'show_info_card' && toolInput) {
        const spec = convertInfoCardToSpec(toolInput as Record<string, unknown>)
        contentBlocks.push({ type: 'widget', spec })
      } else if (toolName === 'suggest_actions' && toolInput) {
        nextActions = extractActionsFromToolInput(toolInput as Record<string, unknown>)
      }
      // Other tools: skip (already shown via status/thinking indicators)
    }
  }

  return { contentBlocks, nextActions }
}

/** Section type → registered widget component name */
const SECTION_TYPE_MAP: Record<string, string> = {
  outline: 'MiniOutline',
  bar_list: 'BarList',
  metrics: 'MetricDashboard',
  actions: 'ActionRow',
  text: 'TextSection',
}

/**
 * Convert show_info_card tool input (sections-based) to JsonRenderSpec
 * so it can be rendered by the existing WidgetRenderer pipeline.
 */
export function convertInfoCardToSpec(input: Record<string, unknown>): JsonRenderSpec {
  const sections = (input.sections ?? []) as Array<Record<string, unknown>>
  const elements: Record<string, { type: string; props: Record<string, unknown>; children?: string[] }> = {}
  const childIds: string[] = []

  sections.forEach((section, i) => {
    const sectionType = section.type as string
    const componentType = SECTION_TYPE_MAP[sectionType]
    if (!componentType) return // Skip unknown section types

    const id = `s${i}`
    childIds.push(id)
    // Strip `type` from props — the rest are component props
    const { type: _, ...props } = section

    // Normalize color_thresholds from percentages (0-100) to decimals (0-1) for BarList
    if (sectionType === 'bar_list' && props.color_thresholds) {
      const ct = props.color_thresholds as { danger: number; warning: number }
      if (ct.danger > 1 || ct.warning > 1) {
        props.color_thresholds = { danger: ct.danger / 100, warning: ct.warning / 100 }
      }
    }

    elements[id] = { type: componentType, props }
  })

  elements.card = {
    type: 'InfoCard',
    props: {
      title: input.title as string,
      ...(input.badge ? { badge: input.badge as string } : {}),
    },
    children: childIds,
  }

  return { root: 'card', elements }
}

/**
 * Extract NextAction[] from suggest_actions tool input.
 */
export function extractActionsFromToolInput(input: Record<string, unknown>): NextAction[] | undefined {
  const actions = input.actions as Array<{ label: string; prompt: string; skill_hint?: string }> | undefined
  if (!actions || !Array.isArray(actions)) return undefined
  return actions
    .filter(a => typeof a.label === 'string' && typeof a.prompt === 'string')
    .map(a => ({
      label: a.label,
      prompt: a.prompt,
      skillHint: a.skill_hint,
    }))
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
  // Match both ```widget and ```file fenced blocks
  const fencedRegex = /```(widget|file)\s*\n([\s\S]*?)```/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = fencedRegex.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index).trim()
    if (before) {
      blocks.push({ type: 'text', content: before })
    }

    const blockType = match[1] // 'widget' or 'file'
    const blockBody = match[2]

    try {
      const parsed = JSON.parse(blockBody)
      if (blockType === 'widget') {
        blocks.push({ type: 'widget', spec: parsed as JsonRenderSpec })
      } else {
        // file block → FileBlock
        blocks.push({
          type: 'file',
          fileName: (parsed.fileName as string) ?? 'file',
          fileType: (parsed.fileType as string) ?? 'application/octet-stream',
          downloadUrl: (parsed.downloadUrl as string) ?? '',
          description: parsed.description as string | undefined,
        } satisfies FileBlock)
      }
    } catch {
      // JSON parse failed — treat as text
      blocks.push({ type: 'text', content: match[0] })
    }

    lastIndex = match.index + match[0].length
  }

  const remaining = text.slice(lastIndex).trim()
  if (remaining) {
    if (isStreaming && (remaining.includes('```widget') || remaining.includes('```file'))) {
      // During streaming, hide incomplete fenced blocks
      const widgetStart = remaining.indexOf('```widget')
      const fileStart = remaining.indexOf('```file')
      const starts = [widgetStart, fileStart].filter(s => s >= 0)
      const firstStart = starts.length > 0 ? Math.min(...starts) : -1
      if (firstStart >= 0) {
        const beforeBlock = remaining.slice(0, firstStart).trim()
        if (beforeBlock) {
          blocks.push({ type: 'text', content: beforeBlock })
        }
      }
      // Don't render the partial block — wait for completion
    } else {
      blocks.push({ type: 'text', content: remaining })
    }
  }

  if (blocks.length === 0 && text.trim()) {
    blocks.push({ type: 'text', content: text })
  }

  return blocks
}
