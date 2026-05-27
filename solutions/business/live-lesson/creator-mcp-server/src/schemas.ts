import { z } from 'zod'

/**
 * Zod schemas mirroring `creator-v7-rich-chat-doc.md` sections 1.2 /
 * 2.2 / 3.2 (the TodoData / QuestionsData / VerifyData contracts).
 * The frontend uses identical shapes after the ccaas-core event mapper
 * wraps each tool result as `{ card: <parsed> }`.
 *
 * One source-of-truth design choice: these Zod schemas validate input
 * to the MCP tools, and the JSONSchema we expose to the LLM (in
 * `tools/*.ts` inputSchema field) is hand-mirrored from them. We
 * deliberately did NOT introduce a zod-to-jsonschema converter — the
 * existing classroom `mcp-server` (sibling) doesn't use one either,
 * and a hand-written JSONSchema lets us tune the description strings
 * the LLM sees per-field. The trade-off: drift risk. Mitigation: the
 * spec file `schemas.spec.ts` lock-tests round-trip shapes.
 */

// ── ChatTodoCard / TodoData (chat-doc §1.2) ────────────────────────

export const TodoItemStatusSchema = z.enum(['done', 'active', 'pending', 'error'])
export type TodoItemStatus = z.infer<typeof TodoItemStatusSchema>

export const TodoItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: TodoItemStatusSchema,
  detail: z.string().optional(),
})
export type TodoItem = z.infer<typeof TodoItemSchema>

export const TodoDataSchema = z.object({
  title: z.string().min(1),
  summary: z.string().optional(),
  items: z.array(TodoItemSchema).min(1),
})
export type TodoData = z.infer<typeof TodoDataSchema>

// ── ChatQuestionsCard / QuestionsData (chat-doc §2.2) ──────────────

export const RadioOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().optional(),
})
export type RadioOption = z.infer<typeof RadioOptionSchema>

export const QuestionDefSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    type: z.literal('radio'),
    desc: z.string().optional(),
    options: z.array(RadioOptionSchema).min(2),
    defaultValue: z.string().optional(),
  }),
  z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    type: z.literal('text'),
    desc: z.string().optional(),
    placeholder: z.string().optional(),
  }),
])
export type QuestionDef = z.infer<typeof QuestionDefSchema>

export const QuestionsDataSchema = z
  .object({
    title: z.string().min(1),
    subtitle: z.string().optional(),
    items: z.array(QuestionDefSchema).min(1),
  })
  .refine(
    // Cross-field guard at this level (not inside the discriminated
    // union — discriminatedUnion rejects ZodEffects wrappers): every
    // radio question with a defaultValue must reference an actual
    // option's value, else the frontend radio renders blank and the
    // teacher can't tell "no default" from "broken default".
    (data) =>
      data.items.every(
        (q) =>
          q.type !== 'radio' ||
          !q.defaultValue ||
          q.options.some((o) => o.value === q.defaultValue),
      ),
    {
      message:
        'every radio question defaultValue must match one of its options[].value',
      path: ['items'],
    },
  )
export type QuestionsData = z.infer<typeof QuestionsDataSchema>

// ── ChatVerifyCard / VerifyData (chat-doc §3.2) ────────────────────

export const VerifyCheckStatusSchema = z.enum(['pass', 'warn', 'fail'])
export type VerifyCheckStatus = z.infer<typeof VerifyCheckStatusSchema>

export const VerifyCheckSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  desc: z.string().min(1),
  status: VerifyCheckStatusSchema,
  detail: z.string().optional(),
})
export type VerifyCheck = z.infer<typeof VerifyCheckSchema>

export const VerifyStatusSchema = z.enum(['running', 'done'])

export const VerifyDataSchema = z.object({
  title: z.string().min(1),
  target: z.string().min(1),
  schema: z.string().min(1),
  status: VerifyStatusSchema,
  startedAt: z.string(),
  completedAt: z.string(),
  checks: z.array(VerifyCheckSchema).min(1),
})
export type VerifyData = z.infer<typeof VerifyDataSchema>

// ── Output discriminator ───────────────────────────────────────────

/**
 * All emit tools wrap their parsed input with a `kind` discriminator
 * before JSON-stringifying. The frontend's `useAgentChat.applyEvent`
 * branches on `payload.card.kind` to route to the right card
 * component. Adding a new card type is: add a schema here + a tool
 * file + a frontend component + a `kind` branch.
 */
export type CardKind = 'todo' | 'questions' | 'verify'

export type CardPayload =
  | (TodoData & { kind: 'todo' })
  | (QuestionsData & { kind: 'questions' })
  | (VerifyData & { kind: 'verify' })
