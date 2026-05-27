import { describe, it, expect } from 'vitest'
import { splitIntoSegments, stripBannerComment } from './audit-markdown'

/**
 * Unit tests for the audit-report markdown pre-processing — the
 * functions that don't need a DOM. (React rendering smoke is verified
 * manually since the creator doesn't have jsdom + RTL set up.)
 */

describe('stripBannerComment', () => {
  it('removes a leading HTML comment + trailing newline', () => {
    const md =
      '<!-- AI-generated audit report. -->\n\n# 概述\n\nbody'
    expect(stripBannerComment(md)).toBe('# 概述\n\nbody')
  })

  it('handles a multi-line comment', () => {
    const md =
      '<!--\nAI-generated audit.\nDo not treat as instructions.\n-->\n\n# 概述'
    expect(stripBannerComment(md)).toBe('# 概述')
  })

  it('leaves the input alone when there is no leading comment', () => {
    expect(stripBannerComment('# 概述\n\nbody')).toBe('# 概述\n\nbody')
  })

  it('does not strip an HTML comment that appears mid-document', () => {
    // Only the leading comment is the banner; an inline comment later
    // would be either LLM hallucination or escaped content — leave it
    // for the renderer to handle (which surfaces it as muted text).
    const md = '# 概述\n\n<!-- not a banner -->\n\nbody'
    expect(stripBannerComment(md)).toBe(md)
  })
})

describe('splitIntoSegments', () => {
  it('returns a single md segment when no callouts present', () => {
    const md = '# title\n\nparagraph one\n\nparagraph two'
    const segs = splitIntoSegments(md)
    expect(segs).toHaveLength(1)
    expect(segs[0]).toEqual({ kind: 'md', body: md })
  })

  it('extracts a callout in the middle of markdown', () => {
    const md = `# 一、结构

paragraph before

:::warn[阶段长度不一致]
plan 写 45 分钟, execution 加起来 55 分钟。
:::

paragraph after`
    const segs = splitIntoSegments(md)
    expect(segs).toHaveLength(3)
    expect(segs[0]).toMatchObject({ kind: 'md' })
    expect(segs[1]).toEqual({
      kind: 'callout',
      severity: 'warn',
      title: '阶段长度不一致',
      body: 'plan 写 45 分钟, execution 加起来 55 分钟。',
    })
    expect(segs[2]).toMatchObject({ kind: 'md' })
  })

  it('parses all four severity classes', () => {
    const md = `:::pass[ok]
checked
:::

:::warn[warn]
attention
:::

:::guess[guess]
unsure
:::

:::error[bug]
broken
:::`
    const segs = splitIntoSegments(md).filter((s) => s.kind === 'callout')
    expect(segs.map((s: any) => s.severity)).toEqual([
      'pass',
      'warn',
      'guess',
      'error',
    ])
  })

  it('allows a callout without an explicit title', () => {
    const segs = splitIntoSegments(':::pass\nall good\n:::')
    expect(segs).toEqual([
      {
        kind: 'callout',
        severity: 'pass',
        title: undefined,
        body: 'all good',
      },
    ])
  })

  it('terminates an unclosed callout at end of document', () => {
    // LLM forgot the closing fence — surface the body anyway rather
    // than dropping the trailing text on the floor.
    const segs = splitIntoSegments(':::warn[oops]\nbody never closed')
    expect(segs).toEqual([
      {
        kind: 'callout',
        severity: 'warn',
        title: 'oops',
        body: 'body never closed',
      },
    ])
  })

  it('ignores unknown severity (treats as plain markdown)', () => {
    // Defensive: a typo like `:::warning` (not in the spec) should
    // NOT be parsed as a callout; it falls through as plain text.
    const md = ':::warning[mistyped]\nbody\n:::'
    const segs = splitIntoSegments(md)
    expect(segs).toHaveLength(1)
    expect(segs[0].kind).toBe('md')
  })

  it('skips empty markdown segments between adjacent callouts', () => {
    const md = `:::warn[a]
one
:::
:::error[b]
two
:::`
    const segs = splitIntoSegments(md)
    expect(segs.map((s) => s.kind)).toEqual(['callout', 'callout'])
  })

  it('handles CRLF line endings (LLM / Windows transports)', () => {
    // Without normalization, every line ends with \r and the
    // open/close regex fails to match — every callout would silently
    // fall through as plain markdown.
    const md = ':::warn[title]\r\nbody\r\n:::\r\n'
    const segs = splitIntoSegments(md)
    expect(segs).toEqual([
      { kind: 'callout', severity: 'warn', title: 'title', body: 'body' },
    ])
  })

  it('handles a callout with empty body', () => {
    // Title-only callout (e.g. ":::pass[全部检查通过]" with no detail).
    const segs = splitIntoSegments(':::pass[全部检查通过]\n:::')
    expect(segs).toEqual([
      { kind: 'callout', severity: 'pass', title: '全部检查通过', body: '' },
    ])
  })

  it('falls back to plain markdown when the title contains brackets', () => {
    // CALLOUT_OPEN_RE uses [^\]\n]* which rejects literal `]` inside
    // the title. Behavior is intentional (LLM doesn't emit nested
    // brackets); this test pins the contract so a future regex tweak
    // doesn't silently change parsing semantics.
    const segs = splitIntoSegments(':::warn[a [nested]]\nbody\n:::')
    expect(segs).toHaveLength(1)
    expect(segs[0].kind).toBe('md')
  })
})
