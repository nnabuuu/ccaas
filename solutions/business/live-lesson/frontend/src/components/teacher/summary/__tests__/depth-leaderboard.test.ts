import { describe, it, expect } from 'vitest'
import {
  getAvatarStyle,
  getRankColor,
  AVATAR_STYLES,
  DEFAULT_AVATAR_STYLE,
  RANK_COLORS,
} from '../depth-leaderboard-helpers'
import { computeDepthRanking } from '../summary-helpers'

// ── getAvatarStyle ──

describe('getAvatarStyle', () => {
  it('returns gold style for rank 1', () => {
    const style = getAvatarStyle(1)
    expect(style.bg).toContain('#d4a534')
    expect(style.border).toBe('var(--gold-border)')
  })

  it('returns silver style for rank 2', () => {
    const style = getAvatarStyle(2)
    expect(style.bg).toContain('#9ca3af')
    expect(style.border).toBe('var(--silver-border)')
  })

  it('returns bronze style for rank 3', () => {
    const style = getAvatarStyle(3)
    expect(style.bg).toContain('#92400e')
    expect(style.border).toBe('var(--bronze-border)')
  })

  it('returns custom styles for ranks 4 and 5', () => {
    expect(getAvatarStyle(4)).toBe(AVATAR_STYLES[4])
    expect(getAvatarStyle(5)).toBe(AVATAR_STYLES[5])
  })

  it('returns default style for rank > 5', () => {
    expect(getAvatarStyle(6)).toBe(DEFAULT_AVATAR_STYLE)
    expect(getAvatarStyle(99)).toBe(DEFAULT_AVATAR_STYLE)
  })

  it('returns default style for rank 0', () => {
    expect(getAvatarStyle(0)).toBe(DEFAULT_AVATAR_STYLE)
  })
})

// ── getRankColor ──

describe('getRankColor', () => {
  it('returns gold for rank 1', () => {
    expect(getRankColor(1)).toBe('var(--gold)')
  })

  it('returns silver for rank 2', () => {
    expect(getRankColor(2)).toBe('var(--silver)')
  })

  it('returns bronze for rank 3', () => {
    expect(getRankColor(3)).toBe('var(--bronze)')
  })

  it('returns custom colors for ranks 4 and 5', () => {
    expect(getRankColor(4)).toBe(RANK_COLORS[4])
    expect(getRankColor(5)).toBe(RANK_COLORS[5])
  })

  it('returns fallback for out-of-range ranks', () => {
    expect(getRankColor(0)).toBe('var(--t3)')
    expect(getRankColor(6)).toBe('var(--t3)')
    expect(getRankColor(-1)).toBe('var(--t3)')
  })
})

// ── computeDepthRanking (deprecated, still exported) ──

describe('computeDepthRanking', () => {
  it('counts highlights per student', () => {
    const state = {
      coaching: {
        highlights: [
          { studentId: 's1', studentName: 'Alice', taskNum: 1, message: '', gist: '', evidenceSpan: '', detectedAt: 0 },
          { studentId: 's1', studentName: 'Alice', taskNum: 2, message: '', gist: '', evidenceSpan: '', detectedAt: 0 },
          { studentId: 's2', studentName: 'Bob', taskNum: 1, message: '', gist: '', evidenceSpan: '', detectedAt: 0 },
        ],
        llmInsights: null,
      },
    }
    const result = computeDepthRanking(state)
    const alice = result.find(s => s.studentId === 's1')
    const bob = result.find(s => s.studentId === 's2')
    expect(alice?.highlightCount).toBe(2)
    expect(bob?.highlightCount).toBe(1)
  })

  it('counts target point hits per student', () => {
    const state = {
      clusterStats: {
        1: {
          clusters: [],
          definitions: [],
          targetPointDefs: [],
          targetPointStats: [
            { targetPointId: 'tp1', uniqueStudents: 1, students: [{ studentId: 's1', studentName: 'Alice' }] },
            { targetPointId: 'tp2', uniqueStudents: 2, students: [{ studentId: 's1', studentName: 'Alice' }, { studentId: 's2', studentName: 'Bob' }] },
          ],
        },
      },
    }
    const result = computeDepthRanking(state)
    const alice = result.find(s => s.studentId === 's1')
    const bob = result.find(s => s.studentId === 's2')
    expect(alice?.targetPointHits).toBe(2)
    expect(bob?.targetPointHits).toBe(1)
  })

  it('sorts by highlightCount desc, then targetPointHits desc', () => {
    const state = {
      coaching: {
        highlights: [
          { studentId: 's1', studentName: 'Alice', taskNum: 1, message: '', gist: '', evidenceSpan: '', detectedAt: 0 },
          { studentId: 's2', studentName: 'Bob', taskNum: 1, message: '', gist: '', evidenceSpan: '', detectedAt: 0 },
          { studentId: 's2', studentName: 'Bob', taskNum: 2, message: '', gist: '', evidenceSpan: '', detectedAt: 0 },
        ],
        llmInsights: null,
      },
      clusterStats: {
        1: {
          clusters: [],
          definitions: [],
          targetPointDefs: [],
          targetPointStats: [
            { targetPointId: 'tp1', uniqueStudents: 1, students: [{ studentId: 's1', studentName: 'Alice' }] },
          ],
        },
      },
    }
    const result = computeDepthRanking(state)
    expect(result[0].studentId).toBe('s2') // 2 highlights > 1
    expect(result[1].studentId).toBe('s1')
  })

  it('limits to top 5', () => {
    const highlights = Array.from({ length: 8 }, (_, i) => ({
      studentId: `s${i}`, studentName: `Student${i}`, taskNum: 1,
      message: '', gist: '', evidenceSpan: '', detectedAt: 0,
    }))
    const state = { coaching: { highlights, llmInsights: null } }
    const result = computeDepthRanking(state)
    expect(result).toHaveLength(5)
  })

  it('returns empty for no coaching data', () => {
    expect(computeDepthRanking({})).toEqual([])
    expect(computeDepthRanking({ coaching: undefined })).toEqual([])
  })

  it('merges highlights and TP hits for same student', () => {
    const state = {
      coaching: {
        highlights: [
          { studentId: 's1', studentName: 'Alice', taskNum: 1, message: '', gist: '', evidenceSpan: '', detectedAt: 0 },
        ],
        llmInsights: null,
      },
      clusterStats: {
        1: {
          clusters: [],
          definitions: [],
          targetPointDefs: [],
          targetPointStats: [
            { targetPointId: 'tp1', uniqueStudents: 1, students: [{ studentId: 's1', studentName: 'Alice' }] },
          ],
        },
      },
    }
    const result = computeDepthRanking(state)
    expect(result).toHaveLength(1)
    expect(result[0].highlightCount).toBe(1)
    expect(result[0].targetPointHits).toBe(1)
  })

  it('includes students with only TP hits (no highlights)', () => {
    const state = {
      clusterStats: {
        1: {
          clusters: [],
          definitions: [],
          targetPointDefs: [],
          targetPointStats: [
            { targetPointId: 'tp1', uniqueStudents: 1, students: [{ studentId: 's1', studentName: 'Alice' }] },
          ],
        },
      },
    }
    const result = computeDepthRanking(state)
    expect(result).toHaveLength(1)
    expect(result[0].highlightCount).toBe(0)
    expect(result[0].targetPointHits).toBe(1)
  })

  it('aggregates TP hits across multiple steps', () => {
    const state = {
      clusterStats: {
        1: {
          clusters: [], definitions: [], targetPointDefs: [],
          targetPointStats: [
            { targetPointId: 'tp1', uniqueStudents: 1, students: [{ studentId: 's1', studentName: 'Alice' }] },
          ],
        },
        2: {
          clusters: [], definitions: [], targetPointDefs: [],
          targetPointStats: [
            { targetPointId: 'tp2', uniqueStudents: 1, students: [{ studentId: 's1', studentName: 'Alice' }] },
            { targetPointId: 'tp3', uniqueStudents: 1, students: [{ studentId: 's1', studentName: 'Alice' }] },
          ],
        },
      },
    }
    const result = computeDepthRanking(state)
    expect(result[0].targetPointHits).toBe(3)
  })
})
