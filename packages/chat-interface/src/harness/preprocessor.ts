/**
 * Preprocessor utilities for chat-interface harness.
 *
 * System prompt assembly is primarily a server-side responsibility
 * (see ADR-0012). These helpers build the frontend-only portion
 * that gets passed via the `appendSystemPrompt` API field.
 */

/** Convert key-value context to plain text for prompt injection */
export function sessionContextToPrompt(context: Record<string, unknown>): string {
  return Object.entries(context)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
}

/**
 * Build the frontend-only portion to append to the server-assembled system prompt.
 * Only includes widget catalog (server doesn't know frontend widgets) and
 * minimal static context. Domain data should be provided via MCP, not here.
 */
export function buildAppendPrompt(options: {
  widgetCatalog?: string
  staticContext?: Record<string, unknown>
}): string | undefined {
  const parts: string[] = []
  if (options.widgetCatalog) parts.push(`## Available Widgets\n${options.widgetCatalog}`)
  if (options.staticContext) {
    const ctx = sessionContextToPrompt(options.staticContext)
    if (ctx) parts.push(`## Context\n${ctx}`)
  }
  return parts.length > 0 ? parts.join('\n\n') : undefined
}
