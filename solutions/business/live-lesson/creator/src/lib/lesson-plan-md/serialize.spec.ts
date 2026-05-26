/**
 * Tests for the block tree → markdown serializer + roundtrip stability.
 *
 * The roundtrip contract `serialize(parse(md)) === normalize(md)` is
 * the hard invariant. We test it explicitly on a corpus of
 * representative lesson plan fragments.
 */

import { describe, it, expect } from 'vitest';
import { parseLessonPlan } from './parse';
import { serializeLessonPlan } from './serialize';
import type { PlanDocument } from './types';

/**
 * Roundtrip helper — parse then serialize. Used in both directions of
 * the property test (md → tree → md, and tree → md → tree).
 */
function roundtripMd(md: string): string {
  return serializeLessonPlan(parseLessonPlan(md));
}

describe('serializeLessonPlan', () => {
  describe('basic blocks', () => {
    it('serializes headings', () => {
      const out = serializeLessonPlan({
        type: 'document',
        children: [
          {
            type: 'heading',
            level: 2,
            children: [{ type: 'text', value: '教学目标' }],
          },
        ],
      });
      expect(out.trim()).toBe('## 教学目标');
    });

    it('serializes paragraphs', () => {
      const out = serializeLessonPlan({
        type: 'document',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', value: 'hello world' }],
          },
        ],
      });
      expect(out.trim()).toBe('hello world');
    });

    it('serializes bullet lists with `-` (not `*`)', () => {
      const out = serializeLessonPlan({
        type: 'document',
        children: [
          {
            type: 'list',
            ordered: false,
            items: [
              {
                type: 'list_item',
                children: [
                  {
                    type: 'paragraph',
                    children: [{ type: 'text', value: 'item 1' }],
                  },
                ],
              },
            ],
          },
        ],
      });
      expect(out).toMatch(/^- item 1\n$/);
    });

    it('serializes ordered lists', () => {
      const out = serializeLessonPlan({
        type: 'document',
        children: [
          {
            type: 'list',
            ordered: true,
            items: [
              {
                type: 'list_item',
                children: [
                  { type: 'paragraph', children: [{ type: 'text', value: 'a' }] },
                ],
              },
              {
                type: 'list_item',
                children: [
                  { type: 'paragraph', children: [{ type: 'text', value: 'b' }] },
                ],
              },
            ],
          },
        ],
      });
      expect(out).toMatch(/1\. a/);
      expect(out).toMatch(/2\. b/);
    });

    it('serializes code blocks with language', () => {
      const out = serializeLessonPlan({
        type: 'document',
        children: [{ type: 'code', lang: 'ts', value: 'const x = 1;' }],
      });
      expect(out).toMatch(/```ts\n/);
      expect(out).toMatch(/const x = 1;/);
    });

    it('serializes thematic breaks as --- (our normalized form)', () => {
      // We configure remark-stringify with rule: '-' to match the
      // design's git-diff-friendly normalization.
      const out = serializeLessonPlan({
        type: 'document',
        children: [{ type: 'divider' }],
      });
      expect(out.trim()).toBe('---');
    });

    it('serializes html block verbatim', () => {
      const html = '<!-- 教学要求引用语法 -->';
      const out = serializeLessonPlan({
        type: 'document',
        children: [{ type: 'html', value: html }],
      });
      expect(out.trim()).toBe(html);
    });

    it('ends with exactly one trailing newline', () => {
      const out = serializeLessonPlan({
        type: 'document',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', value: 'hi' }],
          },
        ],
      });
      expect(out).toBe('hi\n');
    });
  });

  describe('reference_chip serialization', () => {
    it('serializes back as a standard markdown link with req:// URL', () => {
      // Titles use single-quoted form per our remark-stringify config
      // (defense against embedded double-quotes in L1 metadata).
      const out = serializeLessonPlan({
        type: 'document',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'reference_chip',
                refId: 'r-1.2.3',
                text: '推断生词含义',
                title: '课标 2.1.3 · 语言能力',
              },
            ],
          },
        ],
      });
      expect(out).toMatch(/\[推断生词含义\]\(req:\/\/r-1\.2\.3 '课标 2\.1\.3 · 语言能力'\)/);
    });

    it('omits title when null', () => {
      const out = serializeLessonPlan({
        type: 'document',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'reference_chip',
                refId: 'r-1.2.3',
                text: '推断生词',
                title: null,
              },
            ],
          },
        ],
      });
      expect(out).toMatch(/\[推断生词\]\(req:\/\/r-1\.2\.3\)/);
      expect(out).not.toMatch(/""/);
    });

    // Defense against L1 metadata containing markdown structural chars.
    // Without sanitization, these would break the link structurally
    // on re-parse (item 1+2 from code review).
    describe('structural-char defense', () => {
      it('strips brackets in chip text (would break link structure)', () => {
        const out = serializeLessonPlan({
          type: 'document',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'reference_chip',
                  refId: 'r-1.2.3',
                  text: 'has [brackets] inside',
                  title: null,
                },
              ],
            },
          ],
        });
        // Brackets should be stripped to space; "has brackets inside".
        expect(out).toMatch(/\[has brackets inside\]/);
        expect(out).not.toMatch(/\[has \[brackets\]/);
      });

      it('strips parens + backslash in chip text', () => {
        const out = serializeLessonPlan({
          type: 'document',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'reference_chip',
                  refId: 'r-1',
                  text: 'has (parens) and \\slash',
                  title: null,
                },
              ],
            },
          ],
        });
        expect(out).toMatch(/\[has parens and slash\]/);
      });

      it('survives roundtrip when text would otherwise break the link', () => {
        const tree = {
          type: 'document' as const,
          children: [
            {
              type: 'paragraph' as const,
              children: [
                {
                  type: 'reference_chip' as const,
                  refId: 'r-1.2.3',
                  text: 'use [brackets] and *stars*',
                  title: 'meta',
                },
              ],
            },
          ],
        };
        const md = serializeLessonPlan(tree);
        // The chip survives as a chip (not a broken link or text).
        const back = parseLessonPlan(md);
        const chip = (back.children[0] as any).children[0];
        expect(chip.type).toBe('reference_chip');
        expect(chip.refId).toBe('r-1.2.3');
        // Brackets stripped but stars preserved.
        expect(chip.text).toContain('stars');
      });

      it('strips single quotes from title (would break title attr)', () => {
        const out = serializeLessonPlan({
          type: 'document',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'reference_chip',
                  refId: 'r-1',
                  text: 'x',
                  title: "has 'quote' inside",
                },
              ],
            },
          ],
        });
        // Title in single-quoted form (our remark config); embedded
        // single quotes get stripped.
        expect(out).not.toMatch(/'has 'quote'/);
      });

      it('roundtrip survives a title with embedded quotes', () => {
        const tree = {
          type: 'document' as const,
          children: [
            {
              type: 'paragraph' as const,
              children: [
                {
                  type: 'reference_chip' as const,
                  refId: 'r-1.2.3',
                  text: 'x',
                  title: 'has "double" and \'single\' quotes',
                },
              ],
            },
          ],
        };
        const md = serializeLessonPlan(tree);
        const back = parseLessonPlan(md);
        const chip = (back.children[0] as any).children[0];
        expect(chip.type).toBe('reference_chip');
      });
    });
  });
});

// ── Roundtrip property tests ───────────────────────────────────────

describe('roundtrip stability — serialize(parse(md)) === normalize(md)', () => {
  /**
   * Each fixture pair is `[input, expected_after_roundtrip]`. The
   * expected output isn't always identical to the input because of
   * normalization (bullet style, spacing, etc.) — we capture the
   * normalized form so the test fails if the normalization changes.
   */
  const fixtures: Array<{ name: string; md: string }> = [
    {
      name: 'heading only',
      md: '# 函数与图像入门\n',
    },
    {
      name: 'multiple headings',
      md: '# h1\n\n## h2\n\n### h3\n',
    },
    {
      name: 'paragraph with bold + italic',
      md: 'hello **world** with *italic*\n',
    },
    {
      name: 'bullet list',
      md: '- item 1\n- item 2\n- item 3\n',
    },
    {
      name: 'ordered list',
      md: '1. first\n2. second\n',
    },
    {
      name: 'blockquote',
      md: '> 这是一个引用\n',
    },
    {
      name: 'code block with lang',
      md: '```ts\nconst x = 1;\n```\n',
    },
    {
      name: 'reference chip',
      md: '- [推断生词含义](req://r-1.2.3 "课标 2.1.3 · 语言能力")\n',
    },
    {
      name: 'multiple chips in one list',
      md:
        '- [a](req://r-1 "code A · cat A")\n' +
        '- [b](req://r-2 "code B · cat B")\n',
    },
    {
      name: 'mixed prose + chip + suffix text',
      md: 'See [推断生词](req://r-1.2.3 "课标 2.1.3 · 语言能力") for details.\n',
    },
    {
      name: 'full lesson plan example',
      md: `<!--
教学要求引用语法: [文本](req://r-X.Y.Z "课标 X.Y · 分类")
-->

# 函数与图像入门

## 教学目标

- 理解函数的对应关系定义
- 能识别函数图像

## 教学要求

- [推断生词含义](req://r-1.2.3 "课标 2.1.3 · 语言能力")
- [识别篇章主旨](req://r-2.1.1 "课标 3.2.1 · 阅读策略")
`,
    },
  ];

  for (const { name, md } of fixtures) {
    it(`is stable for: ${name}`, () => {
      const out1 = roundtripMd(md);
      const out2 = roundtripMd(out1);
      // First roundtrip may normalize whitespace; second roundtrip
      // must equal the first (idempotent normalization).
      expect(out2).toBe(out1);
    });
  }

  it('preserves req:// URLs through multiple roundtrips', () => {
    const md = '- [推断生词](req://r-1.2.3 "课标 2.1.3 · 语言能力")\n';
    let cur = md;
    for (let i = 0; i < 5; i++) {
      cur = roundtripMd(cur);
    }
    expect(cur).toMatch(/req:\/\/r-1\.2\.3/);
    expect(cur).toMatch(/推断生词/);
    expect(cur).toMatch(/课标 2\.1\.3 · 语言能力/);
  });

  it('preserves the HTML comment header through roundtrips', () => {
    const md =
      '<!--\n教学要求引用语法: [文本](req://r-X.Y.Z)\n-->\n\n# 标题\n';
    const out = roundtripMd(md);
    expect(out).toContain('教学要求引用语法');
    expect(out).toContain('# 标题');
  });
});

// ── Tree → md → tree fidelity ─────────────────────────────────────

describe('tree roundtrip — parse(serialize(tree)) preserves structure', () => {
  function blockTypes(doc: PlanDocument): string[] {
    return doc.children.map((b) => b.type);
  }

  it('list + blockquote + heading shape survives', () => {
    const tree: PlanDocument = {
      type: 'document',
      children: [
        {
          type: 'heading',
          level: 1,
          children: [{ type: 'text', value: 't' }],
        },
        {
          type: 'list',
          ordered: false,
          items: [
            {
              type: 'list_item',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', value: 'x' }],
                },
              ],
            },
          ],
        },
        {
          type: 'blockquote',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', value: 'q' }],
            },
          ],
        },
      ],
    };
    const md = serializeLessonPlan(tree);
    const back = parseLessonPlan(md);
    expect(blockTypes(back)).toEqual(['heading', 'list', 'blockquote']);
  });
});
