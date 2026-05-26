/**
 * Tests for the markdown → block tree parser.
 *
 * Focus is on the typed shapes coming out (especially `reference_chip`
 * detection), not exhaustive markdown coverage — remark itself has
 * thousands of conformance tests for that.
 */

import { describe, it, expect } from 'vitest';
import { parseLessonPlan } from './parse';

describe('parseLessonPlan', () => {
  it('parses a heading', () => {
    const doc = parseLessonPlan('# 函数与图像入门\n');
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0]).toEqual({
      type: 'heading',
      level: 1,
      children: [{ type: 'text', value: '函数与图像入门' }],
    });
  });

  it('parses headings at every level', () => {
    const doc = parseLessonPlan('# h1\n\n## h2\n\n### h3\n\n#### h4\n\n##### h5\n\n###### h6\n');
    const levels = doc.children
      .filter((b) => b.type === 'heading')
      .map((b: any) => b.level);
    expect(levels).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('parses a paragraph with bold + italic + inline code', () => {
    const doc = parseLessonPlan('hello **world** *italic* `code`\n');
    const p = doc.children[0] as any;
    expect(p.type).toBe('paragraph');
    const types = p.children.map((c: any) => c.type);
    expect(types).toEqual(['text', 'strong', 'text', 'emphasis', 'text', 'inline_code']);
  });

  it('parses bullet lists', () => {
    const doc = parseLessonPlan('- item 1\n- item 2\n');
    const list = doc.children[0] as any;
    expect(list.type).toBe('list');
    expect(list.ordered).toBe(false);
    expect(list.items).toHaveLength(2);
  });

  it('parses ordered lists', () => {
    const doc = parseLessonPlan('1. a\n2. b\n');
    const list = doc.children[0] as any;
    expect(list.ordered).toBe(true);
  });

  it('parses blockquotes', () => {
    const doc = parseLessonPlan('> 这是引用\n');
    const bq = doc.children[0] as any;
    expect(bq.type).toBe('blockquote');
    expect(bq.children[0].type).toBe('paragraph');
  });

  it('parses fenced code blocks', () => {
    const doc = parseLessonPlan('```ts\nconst x = 1;\n```\n');
    const code = doc.children[0] as any;
    expect(code.type).toBe('code');
    expect(code.lang).toBe('ts');
    expect(code.value).toBe('const x = 1;');
  });

  it('parses thematic breaks as dividers', () => {
    const doc = parseLessonPlan('---\n');
    expect(doc.children[0]).toEqual({ type: 'divider' });
  });

  it('preserves raw HTML blocks (e.g. the contract comment header)', () => {
    const md = '<!-- 教学要求引用语法: [文本](req://r-X.Y.Z) -->\n\n# title\n';
    const doc = parseLessonPlan(md);
    expect(doc.children[0]).toMatchObject({
      type: 'html',
      value: expect.stringContaining('教学要求引用语法'),
    });
  });

  describe('reference chip detection', () => {
    it('parses [text](req://id) as a reference_chip inline', () => {
      const doc = parseLessonPlan(
        '- [推断生词含义](req://r-1.2.3 "课标 2.1.3 · 语言能力")\n',
      );
      const list = doc.children[0] as any;
      const item = list.items[0];
      const paragraph = item.children[0];
      const chip = paragraph.children[0];
      expect(chip).toEqual({
        type: 'reference_chip',
        refId: 'r-1.2.3',
        text: '推断生词含义',
        title: '课标 2.1.3 · 语言能力',
      });
    });

    it('handles a chip with no title attribute', () => {
      const doc = parseLessonPlan('[推断生词](req://r-1.2.3)\n');
      const p = doc.children[0] as any;
      const chip = p.children[0];
      expect(chip).toMatchObject({
        type: 'reference_chip',
        refId: 'r-1.2.3',
        text: '推断生词',
        title: null,
      });
    });

    it('non-req URLs stay as normal links', () => {
      const doc = parseLessonPlan('[google](https://google.com)\n');
      const p = doc.children[0] as any;
      const link = p.children[0];
      expect(link.type).toBe('link');
      expect(link.url).toBe('https://google.com');
    });

    it('parses multiple chips in the same paragraph', () => {
      const doc = parseLessonPlan('see [a](req://r-1) and [b](req://r-2)\n');
      const p = doc.children[0] as any;
      const chips = p.children.filter((c: any) => c.type === 'reference_chip');
      expect(chips).toHaveLength(2);
      expect(chips.map((c: any) => c.refId)).toEqual(['r-1', 'r-2']);
    });

    it('falls back to plain link when refId contains structural chars', () => {
      // Even though remark-parse may not actually produce a link with
      // `)` in the URL (since `)` typically terminates the link), we
      // explicitly verify that pathological refIds we accept must
      // match our grammar — protects against future remark behavior
      // changes or upstream parsers that might be more permissive.
      const doc = parseLessonPlan('[bad](req://has<bracket>id)\n');
      const p = doc.children[0] as any;
      const node = p.children[0];
      // Either it's a plain link (refId rejected) or text — anything
      // but a reference_chip is acceptable.
      expect(node.type).not.toBe('reference_chip');
    });

    it('accepts standard refId shapes (r-X.Y.Z, m-A.B.C, namespaced)', () => {
      const cases = ['r-1.2.3', 'm-1.1.1', 'r-foo.bar', 'r-id_with_underscore'];
      for (const id of cases) {
        const doc = parseLessonPlan(`[x](req://${id})\n`);
        const p = doc.children[0] as any;
        const chip = p.children[0];
        expect(chip.type).toBe('reference_chip');
        expect(chip.refId).toBe(id);
      }
    });
  });

  describe('<details>/<summary> toggles (inline form only in v1)', () => {
    it('parses an inline-form toggle as a typed toggle block', () => {
      // V1 supports single-line <details><summary>x</summary>body</details>.
      // Multi-line forms with blank lines get split by remark into
      // multiple HTML nodes; v1 preserves those as raw `html` blocks.
      const md = '<details><summary>点击展开</summary>隐藏的内容</details>\n';
      const doc = parseLessonPlan(md);
      const toggle = doc.children[0] as any;
      expect(toggle.type).toBe('toggle');
      expect(toggle.summary).toBe('点击展开');
      expect(toggle.children[0].type).toBe('paragraph');
    });

    it('multi-line toggles preserved as raw HTML (non-lossy fallback)', () => {
      const md = '<details><summary>展开</summary>\n\n内容\n\n</details>\n';
      const doc = parseLessonPlan(md);
      // First block is just the opening `<details><summary>...` html;
      // the rest of the markdown is preserved as siblings. We don't
      // assert exact structure — only that nothing is lost.
      const types = doc.children.map((b) => b.type);
      expect(types).toContain('html');
    });
  });

  describe('empty + edge inputs', () => {
    it('parses empty string as empty document', () => {
      const doc = parseLessonPlan('');
      expect(doc.children).toEqual([]);
    });

    it('parses whitespace-only as empty document', () => {
      const doc = parseLessonPlan('   \n\n   ');
      expect(doc.children).toEqual([]);
    });
  });
});
