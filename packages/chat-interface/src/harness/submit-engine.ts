import type { EngineSubmission } from '@/types/chat'

/**
 * Build a structured tool_result message from widget submission.
 *
 * Design intent: LLM receives structured JSON (not natural language),
 * so it doesn't need to re-parse user intent. This saves tokens and
 * ensures type safety (params already validated by Widget's schema).
 *
 * Phase 2: This will inject directly as tool_result in the message history.
 * Phase 1: We serialize this as a structured user message.
 */
export function buildSubmissionPayload(submission: EngineSubmission): string {
  return JSON.stringify({
    type: 'widget_submission',
    source: submission.sourceWidgetType,
    target_skill: submission.targetSkill,
    params: submission.params,
    context: submission.context,
  })
}

export interface SubmitToEngineOptions {
  submission: EngineSubmission
  sendMessage: (content: string) => Promise<void>
  toolUseId?: string
  injectToolResult?: (toolUseId: string, result: unknown) => Promise<void>
}

/**
 * Submit widget collected data.
 *
 * When `toolUseId` + `injectToolResult` are provided, submits as a tool_result
 * directly into the conversation (Phase 2 path). Otherwise falls back to
 * sending a structured user message (Phase 1 path).
 */
export async function submitToEngine(options: SubmitToEngineOptions): Promise<void> {
  const { submission, sendMessage, toolUseId, injectToolResult } = options

  if (toolUseId && injectToolResult) {
    await injectToolResult(toolUseId, {
      type: 'widget_submission',
      source: submission.sourceWidgetType,
      target_skill: submission.targetSkill,
      params: submission.params,
      context: submission.context,
    })
    return
  }

  const payload = buildSubmissionPayload(submission)
  await sendMessage(payload)
}
