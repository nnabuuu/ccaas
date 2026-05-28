/**
 * Reserved field names stripped from agent-supplied tool arguments
 * before validation.
 *
 * The ToolCallerProxy invariant: identity is **ambient** (bound at
 * session creation, carried in ExecutionContext) and never readable
 * from agent-supplied `args`. A prompt-injected agent that writes any
 * of these keys into `args` has them silently dropped + audit-logged
 * before the tool handler sees anything. Identity reaches the handler
 * only via the platform-asserted ExecutionContext.
 *
 * **Invariant (CONTRACT — enforced by reserved-fields.spec.ts)**:
 * every `ExecutionContext` field name MUST appear in this list.
 * Otherwise the field is observable as a platform-asserted value AND
 * as an agent-writable one, and prompt injection can leak the
 * agent's preferred value through to a handler that doesn't realize
 * the field is meant to be authoritative.
 *
 * Adding a new ExecutionContext field?
 *   1. Add it to ExecutionContext (types.ts)
 *   2. Add the same name here (top-level + the snapshot in
 *      reserved-fields.spec.ts will go red until you do)
 *   3. Add a context-injection spec covering it in
 *      tool-caller-proxy.service.spec.ts
 */
export const RESERVED_ARG_FIELDS = Object.freeze([
  // Bound at session creation, not agent-writable:
  'userId',
  'tenantId',
  'sessionId',
  'permissions',
  'context',
  'role',
  'solutionId',
  'actingUserId',
  'actingRole',
  'apiKeyId',
  'effectiveScope',
] as const);

export type ReservedArgField = (typeof RESERVED_ARG_FIELDS)[number];

const RESERVED_SET = new Set<string>(RESERVED_ARG_FIELDS);

export function isReservedField(name: string): name is ReservedArgField {
  return RESERVED_SET.has(name);
}

/**
 * Remove reserved fields from a plain object. Returns the cleaned
 * object plus the names that were stripped (for audit logging).
 *
 * Does NOT mutate the input. Top-level only — nested objects retain
 * their keys (the schema validator catches structural issues).
 */
export function sanitizeArgs(
  args: Record<string, unknown> | undefined,
): { cleaned: Record<string, unknown>; stripped: ReservedArgField[] } {
  if (!args || typeof args !== 'object') {
    return { cleaned: {}, stripped: [] };
  }
  const cleaned: Record<string, unknown> = {};
  const stripped: ReservedArgField[] = [];
  for (const [k, v] of Object.entries(args)) {
    if (isReservedField(k)) {
      stripped.push(k);
      continue;
    }
    cleaned[k] = v;
  }
  return { cleaned, stripped };
}
