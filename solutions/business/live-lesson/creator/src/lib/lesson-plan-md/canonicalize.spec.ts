/**
 * Tests for the canonicalizer + helpers.
 *
 * Canonicalize is the load-time + save-time step that refreshes
 * `reference_chip.text` and `reference_chip.title` against the L1
 * library so the markdown file on disk always carries an up-to-date
 * denormalized snapshot.
 */

import { describe, it, expect } from 'vitest';
import {
  canonicalizeLessonPlan,
  collectReqIds,
  makeLookup,
  type LibraryLookup,
} from './canonicalize';
import { parseLessonPlan } from './parse';
import { serializeLessonPlan } from './serialize';
import type { PlanDocument } from './types';

const LIBRARY: Record<string, { text: string; titleMetadata: string }> = {
  'r-1.2.3': {
    text: '在课文中推断生词含义',
    titleMetadata: '课标 2.1.3 · 语言能力',
  },
  'r-2.1.1': {
    text: '识别篇章主旨结构',
    titleMetadata: '课标 3.2.1 · 阅读策略',
  },
};

const lookup: LibraryLookup = (id) => LIBRARY[id];

describe('canonicalizeLessonPlan', () => {
  it('refreshes chip text + title from the library', () => {
    // Document has stale text — library has the canonical version.
    const doc = parseLessonPlan(
      '- [old text](req://r-1.2.3 "old metadata")\n',
    );
    const out = canonicalizeLessonPlan(doc, lookup);
    const chip = ((out.children[0] as any).items[0].children[0] as any).children[0];
    expect(chip).toEqual({
      type: 'reference_chip',
      refId: 'r-1.2.3',
      text: '在课文中推断生词含义',
      title: '课标 2.1.3 · 语言能力',
    });
    // No stale flag — successful lookup.
    expect(chip.stale).toBeUndefined();
  });

  it('marks stale chips when L1 has dropped the id', () => {
    const doc = parseLessonPlan('[stale](req://r-deleted "old")\n');
    const out = canonicalizeLessonPlan(doc, lookup);
    const chip = (out.children[0] as any).children[0];
    expect(chip.stale).toBe(true);
    // Preserves prior text/title so the user can see what was lost.
    expect(chip.text).toBe('stale');
  });

  it('clears stale flag on a re-canonicalize that succeeds', () => {
    // Start with a stale chip.
    const stale = parseLessonPlan('[old](req://r-1.2.3 "old")\n');
    const onceStale = canonicalizeLessonPlan(stale, () => undefined);
    expect(
      (onceStale.children[0] as any).children[0].stale,
    ).toBe(true);

    // Re-canonicalize with a working lookup — stale flag must go.
    const refreshed = canonicalizeLessonPlan(onceStale, lookup);
    const chip = (refreshed.children[0] as any).children[0];
    expect(chip.stale).toBeUndefined();
    expect(chip.text).toBe('在课文中推断生词含义');
  });

  it('does not mutate the input document', () => {
    const doc = parseLessonPlan('[x](req://r-1.2.3 "y")\n');
    const snapshot = JSON.stringify(doc);
    canonicalizeLessonPlan(doc, lookup);
    expect(JSON.stringify(doc)).toBe(snapshot);
  });

  it('walks nested blocks (lists, blockquotes, toggles)', () => {
    const md = [
      '> [推断](req://r-1.2.3 "old")',
      '',
      '- nested [识别](req://r-2.1.1 "old")',
      '',
      '<details><summary>展开</summary>',
      '',
      '[嵌套](req://r-1.2.3 "old")',
      '',
      '</details>',
      '',
    ].join('\n');
    const doc = parseLessonPlan(md);
    const out = canonicalizeLessonPlan(doc, lookup);

    // All three chips should be canonicalized.
    const ids = collectReqIds(out);
    expect(new Set(ids)).toEqual(new Set(['r-1.2.3', 'r-2.1.1']));

    const serialized = serializeLessonPlan(out);
    expect(serialized).toContain('在课文中推断生词含义');
    expect(serialized).toContain('识别篇章主旨结构');
  });

  it('leaves non-chip inline content alone', () => {
    const md = '**bold** *italic* `code` [normal](https://example.com)\n';
    const doc = parseLessonPlan(md);
    const before = JSON.stringify(doc);
    const out = canonicalizeLessonPlan(doc, lookup);
    expect(JSON.stringify(out)).toBe(before);
  });
});

describe('collectReqIds', () => {
  it('returns unique ids in document order', () => {
    const doc = parseLessonPlan(
      [
        '- [a](req://r-1.2.3)',
        '- [b](req://r-2.1.1)',
        '- [c](req://r-1.2.3)', // duplicate
      ].join('\n') + '\n',
    );
    expect(collectReqIds(doc)).toEqual(['r-1.2.3', 'r-2.1.1']);
  });

  it('returns empty when no chips', () => {
    const doc = parseLessonPlan('# just a heading\n\nplain text\n');
    expect(collectReqIds(doc)).toEqual([]);
  });

  it('collects across nested structures', () => {
    const doc = parseLessonPlan(
      '> [in-quote](req://r-1.2.3)\n\n- [in-list](req://r-2.1.1)\n',
    );
    expect(new Set(collectReqIds(doc))).toEqual(
      new Set(['r-1.2.3', 'r-2.1.1']),
    );
  });
});

describe('makeLookup', () => {
  it('builds a function that returns library entries', () => {
    const fn = makeLookup([
      {
        id: 'r-1.2.3',
        text: '推断生词',
        code: '课标 2.1.3',
        categoryLabel: '语言能力',
      },
    ]);
    expect(fn('r-1.2.3')).toEqual({
      text: '推断生词',
      titleMetadata: '课标 2.1.3 · 语言能力',
    });
    expect(fn('r-other')).toBeUndefined();
  });
});

describe('full canonicalize → serialize pipeline', () => {
  it('canonicalize then serialize produces stable output with refreshed text', () => {
    const doc = parseLessonPlan(
      '## 教学要求\n\n- [stale label](req://r-1.2.3 "stale metadata")\n',
    );
    const refreshed = canonicalizeLessonPlan(doc, lookup);
    const md = serializeLessonPlan(refreshed);
    expect(md).toContain('在课文中推断生词含义');
    expect(md).toContain('课标 2.1.3 · 语言能力');
    expect(md).not.toContain('stale label');
    expect(md).not.toContain('stale metadata');
  });
});
