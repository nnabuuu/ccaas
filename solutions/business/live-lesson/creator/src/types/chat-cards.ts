/**
 * Rich chat card payloads — mirror of `creator-mcp-server/src/schemas.ts`
 * Zod definitions. We deliberately don't import from that package
 * (cross-package types create build friction); these are hand-mirrored
 * + lock-tested against the chat-doc.md spec.
 *
 * Each card type includes the `kind` discriminator literal. The
 * frontend's `useAgentChat` and `ChatBubble` both switch on
 * `card.kind` to route to the right renderer.
 *
 * Adding a new card type:
 *   1. Add a Zod schema in `creator-mcp-server/src/schemas.ts`
 *   2. Add a new MCP tool that emits it (with toolEventTriggers
 *      registered in solution.json)
 *   3. Add the matching interface here + extend `CardPayload` union
 *   4. Extend `CARD_TOOL_NAMES` in `useAgentChat.ts`
 *   5. Add a React renderer + wire ChatBubble's switch
 */

// ── TodoCard (chat-doc §1) ─────────────────────────────────────────

export type TodoItemStatus = 'done' | 'active' | 'pending' | 'error'

export interface TodoItem {
  id: string
  label: string
  status: TodoItemStatus
  detail?: string
}

export interface TodoData {
  kind: 'todo'
  title: string
  summary?: string
  items: TodoItem[]
}

// ── QuestionsCard (chat-doc §2) ────────────────────────────────────

export interface RadioOption {
  value: string
  label: string
  detail?: string
}

export interface RadioQuestion {
  id: string
  label: string
  type: 'radio'
  desc?: string
  options: RadioOption[]
  defaultValue?: string
}

export interface TextQuestion {
  id: string
  label: string
  type: 'text'
  desc?: string
  placeholder?: string
}

export type QuestionDef = RadioQuestion | TextQuestion

export interface QuestionsData {
  kind: 'questions'
  title: string
  subtitle?: string
  items: QuestionDef[]
}

// ── VerifyCard (chat-doc §3) ───────────────────────────────────────

export type VerifyCheckStatus = 'pass' | 'warn' | 'fail'

export interface VerifyCheck {
  id: string
  label: string
  desc: string
  status: VerifyCheckStatus
  detail?: string
}

export interface VerifyData {
  kind: 'verify'
  title: string
  target: string
  schema: string
  status: 'running' | 'done'
  startedAt: string
  completedAt: string
  checks: VerifyCheck[]
}

// ── Discriminated union ────────────────────────────────────────────

export type CardKind = 'todo' | 'questions' | 'verify'
export type CardPayload = TodoData | QuestionsData | VerifyData

/**
 * Tool names that emit cards. Matches what
 * `creator-mcp-server/src/tools/{todo,questions,verify}.ts` register
 * + what `solution.json`'s toolEventTriggers reference. Frontend
 * uses this to skip generic toolEvent labels when reconstructing
 * card messages from history (the card itself replaces the label).
 */
export const CARD_TOOL_NAMES: ReadonlySet<string> = new Set([
  'emit_todo_card',
  'emit_questions_card',
  'emit_verify_card',
])

/**
 * Best-effort parse of a serialized card payload from a tool event's
 * toolOutput field. Returns null on any malformed shape — the caller
 * silently skips, so a corrupt persisted card just doesn't render
 * (rather than throwing in render).
 */
export function tryParseCardPayload(toolOutput: unknown): CardPayload | null {
  if (toolOutput == null) return null
  // toolOutput may already be an object (if backend deserialized it)
  // or a JSON string (if it was stored as TEXT). Handle both.
  let raw: unknown = toolOutput
  if (typeof toolOutput === 'string') {
    try {
      raw = JSON.parse(toolOutput)
    } catch {
      return null
    }
  }
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as { kind?: unknown }
  if (obj.kind === 'todo' || obj.kind === 'questions' || obj.kind === 'verify') {
    // Trust the kind discriminator; deeper validation lives on the
    // backend (Zod-validated when the tool was called). If the
    // backend ever stored a card with extra/missing fields, the
    // component renderer is defensive enough to no-op.
    return raw as CardPayload
  }
  return null
}
