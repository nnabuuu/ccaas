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
  completionType?: string,
): 'chat' | 'done' {
  if (isRevisit) return 'done'
  if (goalReached) return 'done'
  if (completionType === 'fallback_rounds' || completionType === 'fallback_time') return 'done'
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
  completionType?: string
  maxTimeSeconds: number
  now?: number
}): FallbackResult {
  // Already completed discuss (goal reached or MC submitted) — no need to show fallback again
  if (opts.completionType) return { phase: 'chat', reason: '' }
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
  messages: Array<{ role: string; text: string; images?: string[]; imageDescription?: string; [k: string]: unknown }>,
): Array<{ role: 'ai' | 'student'; text: string; images?: string[] }> {
  const filtered = messages.filter(m => m.role !== 'notification')
  const lastIdx = filtered.length - 1
  return filtered.map((m, i) => {
    // 最后一条消息保留原始 images（当前发送的）
    if (i === lastIdx && m.images?.length) {
      return { role: m.role as 'ai' | 'student', text: m.text, images: m.images }
    }
    // 历史消息：有 imageDescription → 用 placeholder 替代 images
    if (m.images?.length && m.imageDescription) {
      const prefix = `[用户图片：${m.imageDescription}]`
      const text = m.text ? `${prefix}\n${m.text}` : prefix
      return { role: m.role as 'ai' | 'student', text }
    }
    // 历史消息：有 images 但无 imageDescription（extraction 失败）→ 剥离 images，加通用 placeholder
    if (m.images?.length) {
      const prefix = '[用户发送了图片]'
      const text = m.text ? `${prefix}\n${m.text}` : prefix
      return { role: m.role as 'ai' | 'student', text }
    }
    return { role: m.role as 'ai' | 'student', text: m.text }
  })
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
