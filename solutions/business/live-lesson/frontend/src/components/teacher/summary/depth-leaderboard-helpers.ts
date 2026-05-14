export const AVATAR_STYLES: Record<number, { bg: string; border: string }> = {
  1: { bg: 'linear-gradient(135deg, #d4a534, #c48a1e)', border: 'var(--gold-border)' },
  2: { bg: 'linear-gradient(135deg, #9ca3af, #6b7280)', border: 'var(--silver-border)' },
  3: { bg: 'linear-gradient(135deg, #d97706, #92400e)', border: 'var(--bronze-border)' },
  4: { bg: 'linear-gradient(135deg, #8b9dc3, #5b7ba5)', border: '#7a8fb5' },
  5: { bg: 'linear-gradient(135deg, #a3b18a, #6b8e5a)', border: '#7d9e6a' },
}

export const DEFAULT_AVATAR_STYLE = { bg: 'var(--surface2)', border: 'var(--border)' }

export const RANK_COLORS: Record<number, string> = {
  1: 'var(--gold)', 2: 'var(--silver)', 3: 'var(--bronze)',
  4: '#7a8fb5', 5: '#7d9e6a',
}

export function getAvatarStyle(rank: number) {
  return AVATAR_STYLES[rank] || DEFAULT_AVATAR_STYLE
}

export function getRankColor(rank: number) {
  return RANK_COLORS[rank] || 'var(--t3)'
}
