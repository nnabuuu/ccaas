import { describe, it, expect } from 'vitest'
import { parseNavWorkspace } from './parse-nav'

describe('parseNavWorkspace', () => {
  describe('valid workspace + anchor', () => {
    it('parses nav://execution/<stepId>', () => {
      expect(parseNavWorkspace('nav://execution/s-1700000001-3')).toEqual({
        key: 'execution',
        anchor: 's-1700000001-3',
      })
    })

    it('parses nav://plan/<reqId>', () => {
      expect(parseNavWorkspace('nav://plan/r-1.2.3')).toEqual({
        key: 'plan',
        anchor: 'r-1.2.3',
      })
    })

    it('parses nav://skills/<anchor> (anchor accepted even though skills has no DOM target today)', () => {
      // Skills tab currently has no scroll consumer, but the parser
      // should still return a structured result; the tab itself is
      // the right place to decide what to do with the anchor.
      expect(parseNavWorkspace('nav://skills/some-id')).toEqual({
        key: 'skills',
        anchor: 'some-id',
      })
    })
  })

  describe('bare workspace (no anchor)', () => {
    it('parses nav://execution as { key, anchor: undefined }', () => {
      expect(parseNavWorkspace('nav://execution')).toEqual({
        key: 'execution',
        anchor: undefined,
      })
    })

    it('parses nav://plan', () => {
      expect(parseNavWorkspace('nav://plan')).toEqual({
        key: 'plan',
        anchor: undefined,
      })
    })

    it('parses nav://skills', () => {
      expect(parseNavWorkspace('nav://skills')).toEqual({
        key: 'skills',
        anchor: undefined,
      })
    })

    it('normalizes trailing slash with empty anchor to undefined', () => {
      // `nav://execution/` — slash present but empty path. Treat as
      // "no anchor" rather than "empty-string anchor"; the empty
      // string would otherwise produce a `[data-step-id=""]`
      // selector that matches nothing.
      expect(parseNavWorkspace('nav://execution/')).toEqual({
        key: 'execution',
        anchor: undefined,
      })
    })
  })

  describe('strips query string and hash from the anchor', () => {
    it('drops ?query portion', () => {
      expect(parseNavWorkspace('nav://execution/s-abc?foo=bar')).toEqual({
        key: 'execution',
        anchor: 's-abc',
      })
    })

    it('drops #hash portion', () => {
      expect(parseNavWorkspace('nav://plan/r-1.2.3#section')).toEqual({
        key: 'plan',
        anchor: 'r-1.2.3',
      })
    })
  })

  describe('preserves slashes inside the anchor', () => {
    it('lets the tab handle multi-segment anchors verbatim', () => {
      // The regex captures everything between the second `/` and the
      // first `?` / `#` — so embedded `/` ends up in the anchor.
      // Today's tabs (querySelector by exact id) silently miss
      // weird shapes; future tabs could parse further if needed.
      expect(parseNavWorkspace('nav://execution/s-abc/extra')).toEqual({
        key: 'execution',
        anchor: 's-abc/extra',
      })
    })
  })

  describe('rejected forms', () => {
    it('returns null for unknown workspace targets', () => {
      // Whitelist matters: a typo like `settings` shouldn't silently
      // route to `plan`. nav:// also shouldn't be a generic deep-link
      // scheme for anything not in WorkspaceTabKey.
      expect(parseNavWorkspace('nav://settings')).toBeNull()
      expect(parseNavWorkspace('nav://other/path')).toBeNull()
      expect(parseNavWorkspace('nav://Plan')).toBeNull() // case-sensitive
    })

    it('returns null for non-nav schemes', () => {
      expect(parseNavWorkspace('https://example.com/execution')).toBeNull()
      expect(parseNavWorkspace('action://fix?target=step-1')).toBeNull()
      expect(parseNavWorkspace('ref://r-1.2.3')).toBeNull()
    })

    it('returns null for malformed / empty input', () => {
      expect(parseNavWorkspace('')).toBeNull()
      expect(parseNavWorkspace('nav://')).toBeNull()
      // `nav:/execution` — only one slash; not a valid URL prefix.
      expect(parseNavWorkspace('nav:/execution')).toBeNull()
    })
  })
})
