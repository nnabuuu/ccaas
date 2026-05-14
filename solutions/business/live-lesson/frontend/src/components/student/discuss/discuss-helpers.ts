/* ── discuss-helpers.ts ── Pure functions extracted from DiscussPhase */

// ── formatTime ──

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

// ── computeUrgency ──

export function computeUrgency(
  round: number,
  maxRounds: number,
  elapsed: number,
  maxTime: number,
): { urgency: number; color: string } {
  const urgency = Math.max(round / maxRounds, elapsed / maxTime)
  const color = urgency < 0.5 ? 'var(--green)' : urgency < 0.8 ? 'var(--amber)' : 'var(--red)'
  return { urgency, color }
}

// ── determineInitialPhase ──

export function determineInitialPhase(
  isRevisit: boolean,
  goalReached: boolean,
): 'chat' | 'done' {
  if (isRevisit) return 'done'
  if (goalReached) return 'done'
  return 'chat'
}

// ── detectFallbackOnRestore ──

export type FallbackResult =
  | { phase: 'fallback'; reason: 'rounds' | 'time' }
  | { phase: 'chat'; reason: '' }

export function detectFallbackOnRestore(opts: {
  studentMsgCount: number
  maxRounds: number
  startedAt?: string
  goalReached?: boolean
  maxTimeSeconds: number
  now?: number
}): FallbackResult {
  if (opts.studentMsgCount >= opts.maxRounds) {
    return { phase: 'fallback', reason: 'rounds' }
  }
  if (opts.startedAt && !opts.goalReached) {
    const now = opts.now ?? Date.now()
    const elapsedSec = Math.floor((now - new Date(opts.startedAt).getTime()) / 1000)
    if (elapsedSec >= opts.maxTimeSeconds) {
      return { phase: 'fallback', reason: 'time' }
    }
  }
  return { phase: 'chat', reason: '' }
}

// ── deriveCompletionType ──

export function deriveCompletionType(
  goalReached: boolean,
  fallbackReason: 'rounds' | 'time' | '',
): 'goal_reached' | 'fallback_rounds' | 'fallback_time' {
  if (goalReached) return 'goal_reached'
  return fallbackReason === 'rounds' ? 'fallback_rounds' : 'fallback_time'
}

// ── filterMessagesForApi ──

export function filterMessagesForApi(
  messages: Array<{ role: string; text: string; [k: string]: unknown }>,
): Array<{ role: 'ai' | 'student'; text: string }> {
  return messages
    .filter(m => m.role !== 'notification')
    .map(m => ({ role: m.role as 'ai' | 'student', text: m.text }))
}

// ── findNewHits ──

export function findNewHits<T extends { id: string; hit: boolean }>(
  prevHitIds: Set<string>,
  currentClusters: T[],
): T[] {
  return currentClusters.filter(c => c.hit && !prevHitIds.has(c.id))
}

// ── mcOptionClass ──

export function mcOptionClass(
  index: number,
  selected: number | null,
  submitted: boolean,
  correctIndex: number,
): string {
  let cls = 'sd-mc-option'
  const isRight = index === correctIndex
  if (submitted && isRight) cls += ' correct'
  else if (submitted && selected === index && !isRight) cls += ' wrong'
  else if (selected === index) cls += ' selected'
  return cls
}
