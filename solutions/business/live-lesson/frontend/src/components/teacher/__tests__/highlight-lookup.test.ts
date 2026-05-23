/**
 * Highlight-lookup + miscellaneous teacher-helpers tests.
 *
 * Covers the gaps left by the existing teacher-helpers.test.ts (which targets
 * clusterQuestions / computeHealthCards / etc.):
 *   - buildHighlightLookup
 *   - isHighlightMatch
 *   - findHighlightGist
 *   - countHighlights
 *   - groupStudentsByStatus
 *
 * These all operate on plain data — no React, no DOM.
 */
import { describe, it, expect } from 'vitest'
import {
  buildHighlightLookup,
  isHighlightMatch,
  findHighlightGist,
  countHighlights,
  groupStudentsByStatus,
  HIGHLIGHT_MATCH_TOLERANCE_MS,
} from '../teacher-helpers'

describe('buildHighlightLookup', () => {
  it('groups timestamps by studentName', () => {
    const lookup = buildHighlightLookup([
      { studentName: 'Alice', detectedAt: 100 },
      { studentName: 'Alice', detectedAt: 200 },
      { studentName: 'Bob', detectedAt: 300 },
    ])
    expect(lookup.get('Alice')).toEqual([100, 200])
    expect(lookup.get('Bob')).toEqual([300])
    expect(lookup.size).toBe(2)
  })

  it('returns an empty map when given no highlights', () => {
    expect(buildHighlightLookup([]).size).toBe(0)
  })
})

describe('isHighlightMatch', () => {
  const lookup = buildHighlightLookup([
    { studentName: 'Alice', detectedAt: 1_000_000 },
  ])

  it('returns true within the tolerance window', () => {
    expect(isHighlightMatch(lookup, 'Alice', 1_000_000)).toBe(true)
    expect(isHighlightMatch(lookup, 'Alice', 1_000_000 + HIGHLIGHT_MATCH_TOLERANCE_MS - 1)).toBe(true)
  })

  it('returns false outside the tolerance window', () => {
    expect(isHighlightMatch(lookup, 'Alice', 1_000_000 + HIGHLIGHT_MATCH_TOLERANCE_MS + 1)).toBe(false)
  })

  it('returns false for an unknown student', () => {
    expect(isHighlightMatch(lookup, 'NotInLookup', 1_000_000)).toBe(false)
  })
})

describe('findHighlightGist', () => {
  const highlights = [
    { studentName: 'Alice', detectedAt: 1_000_000, gist: 'A1 gist' },
    { studentName: 'Alice', detectedAt: 2_000_000, gist: 'A2 gist' },
  ]
  const lookup = buildHighlightLookup(highlights)

  it('returns the gist of the matching highlight within tolerance', () => {
    expect(findHighlightGist(lookup, highlights, 'Alice', 1_000_000)).toBe('A1 gist')
    expect(findHighlightGist(lookup, highlights, 'Alice', 2_000_000 + 100)).toBe('A2 gist')
  })

  it('returns undefined when student is unknown', () => {
    expect(findHighlightGist(lookup, highlights, 'Bob', 1_000_000)).toBeUndefined()
  })

  it('returns undefined when timestamp is outside tolerance', () => {
    expect(findHighlightGist(lookup, highlights, 'Alice', 5_000_000)).toBeUndefined()
  })
})

describe('countHighlights', () => {
  it('returns 0 when clusterStats is undefined', () => {
    expect(countHighlights(undefined)).toBe(0)
  })

  it('counts only observations with isHighlight=true', () => {
    const stats = {
      1: {
        definitions: [],
        clusters: [
          {
            clusterId: 'c1',
            observationCount: 0, uniqueStudents: 0, activeCount: 0, resolvedCount: 0,
            observations: [
              { studentId: 'a', studentName: 'A', clusterId: 'c1', status: 'active' as const, evidenceSpans: [], isHighlight: true },
              { studentId: 'b', studentName: 'B', clusterId: 'c1', status: 'active' as const, evidenceSpans: [], isHighlight: false },
              { studentId: 'c', studentName: 'C', clusterId: 'c1', status: 'active' as const, evidenceSpans: [], isHighlight: true },
            ],
          },
        ],
        targetPointDefs: [], targetPointStats: [],
      },
      2: {
        definitions: [],
        clusters: [
          {
            clusterId: 'c2',
            observationCount: 0, uniqueStudents: 0, activeCount: 0, resolvedCount: 0,
            observations: [
              { studentId: 'd', studentName: 'D', clusterId: 'c2', status: 'active' as const, evidenceSpans: [], isHighlight: true },
            ],
          },
        ],
        targetPointDefs: [], targetPointStats: [],
      },
    }
    expect(countHighlights(stats)).toBe(3)
  })
})

describe('groupStudentsByStatus', () => {
  it('groups students into done/prog/stuck/reading buckets', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mk = (name: string, task: number, phase: string, startedAt: string, submissions: Record<number, unknown> = {}): any => ({
      id: name.toLowerCase(),
      name,
      currentTask: task,
      currentPhase: phase,
      stepStartedAt: startedAt,
      submissions,
    })

    // 'done' requires submissions[currentTask].score set; 'stuck' requires elapsed > STUCK_THRESHOLD_MS
    // (regardless of phase); 'reading' is phase=listen with no stuck elapse; otherwise 'prog'.
    const now = Date.now()
    const recent = new Date(now).toISOString()
    const longAgo = new Date(now - 10 * 60_000).toISOString() // 10 min ago > stuck threshold

    const out = groupStudentsByStatus([
      mk('Done', 4, 'takeaway', recent, { 4: { score: 100 } }),
      mk('Reading', 0, 'listen', recent),
      mk('Working', 2, 'practice', recent),
      mk('Stuck', 2, 'practice', longAgo),
    ])
    expect(out.done.map(s => s.name)).toContain('Done')
    expect(out.reading.map(s => s.name)).toContain('Reading')
    expect(out.prog.map(s => s.name)).toContain('Working')
    expect(out.stuck.map(s => s.name)).toContain('Stuck')
  })

  it('returns 4 empty arrays for an empty input', () => {
    const out = groupStudentsByStatus([])
    expect(out).toEqual({ done: [], prog: [], stuck: [], reading: [] })
  })
})
