/**
 * Tests for the PlanDocument ↔ TipTap JSON bridge.
 *
 * The bridge is on the critical save path (editor → AST →
 * canonicalize → markdown). Roundtrip stability of plain content
 * matters; chip-shape fidelity matters most.
 */

import { describe, it, expect } from 'vitest';
import { fromTiptapJson, toTiptapJson } from './tiptap-bridge';
import { parseLessonPlan } from './parse';
import { serializeLessonPlan } from './serialize';
import type { PlanDocument } from './types';

function roundtripViaTiptap(md: string): string {
  const doc = parseLessonPlan(md);
  const tiptap = toTiptapJson(doc);
  const backDoc = fromTiptapJson(tiptap);
  return serializeLessonPlan(backDoc);
}

describe('toTiptapJson', () => {
  it('wraps the root in a doc node', () => {
    const out = toTiptapJson({ type: 'document', children: [] });
    expect(out.type).toBe('doc');
    expect(out.content).toEqual([]);
  });

  it('converts headings preserving level', () => {
    const out = toTiptapJson({
      type: 'document',
      children: [
        {
          type: 'heading',
          level: 3,
          children: [{ type: 'text', value: 'x' }],
        },
      ],
    });
    expect(out.content?.[0]).toMatchObject({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'x' }],
    });
  });

  it('converts bullet lists to bulletList + listItem', () => {
    const doc = parseLessonPlan('- a\n- b\n');
    const json = toTiptapJson(doc);
    expect(json.content?.[0].type).toBe('bulletList');
    expect(json.content?.[0].content).toHaveLength(2);
    expect(json.content?.[0].content?.[0].type).toBe('listItem');
  });

  it('converts ordered lists', () => {
    const doc = parseLessonPlan('1. a\n2. b\n');
    expect(toTiptapJson(doc).content?.[0].type).toBe('orderedList');
  });

  it('converts reference_chip to referenceChip node with attrs', () => {
    const doc = parseLessonPlan(
      '[推断生词](req://r-1.2.3 "课标 2.1.3 · 语言能力")\n',
    );
    const json = toTiptapJson(doc);
    const chip = (json.content?.[0].content?.[0] ?? {}) as any;
    expect(chip.type).toBe('referenceChip');
    expect(chip.attrs).toMatchObject({
      refId: 'r-1.2.3',
      text: '推断生词',
      title: '课标 2.1.3 · 语言能力',
      stale: false,
    });
  });

  it('wraps bold text with a bold mark', () => {
    const doc = parseLessonPlan('**bold**\n');
    const json = toTiptapJson(doc);
    const inline = (json.content?.[0].content?.[0] ?? {}) as any;
    expect(inline.type).toBe('text');
    expect(inline.marks).toEqual([{ type: 'bold' }]);
  });

  describe('nested marks (fix for bridge data loss)', () => {
    it('preserves bold-inside-italic as stacked marks', () => {
      const json = toTiptapJson({
        type: 'document',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'emphasis',
                children: [
                  {
                    type: 'strong',
                    children: [{ type: 'text', value: 'both' }],
                  },
                ],
              },
            ],
          },
        ],
      });
      const inline = (json.content?.[0].content?.[0] ?? {}) as any;
      expect(inline.type).toBe('text');
      expect(inline.text).toBe('both');
      // Outer-to-inner: italic applied first, bold inside, so the
      // stack order is [italic, bold]. Either order is valid for
      // ProseMirror; we just confirm both are present.
      const markTypes = (inline.marks ?? []).map((m: any) => m.type);
      expect(new Set(markTypes)).toEqual(new Set(['italic', 'bold']));
    });

    it('preserves link-wrapping-bold-text as stacked marks', () => {
      const json = toTiptapJson({
        type: 'document',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                url: 'https://x.com',
                title: null,
                children: [
                  {
                    type: 'strong',
                    children: [{ type: 'text', value: 'bold link' }],
                  },
                ],
              },
            ],
          },
        ],
      });
      const inline = (json.content?.[0].content?.[0] ?? {}) as any;
      const markTypes = (inline.marks ?? []).map((m: any) => m.type);
      expect(new Set(markTypes)).toEqual(new Set(['link', 'bold']));
    });

    it('chip inside a bold span drops the active mark stack', () => {
      // Chips are atom nodes; bold around a chip text doesn't propagate
      // to the chip's label rendering. This documents the semantics.
      const json = toTiptapJson({
        type: 'document',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'strong',
                children: [
                  {
                    type: 'reference_chip',
                    refId: 'r-1',
                    text: 'x',
                    title: null,
                  },
                ],
              },
            ],
          },
        ],
      });
      const inline = (json.content?.[0].content?.[0] ?? {}) as any;
      expect(inline.type).toBe('referenceChip');
      // No mark stack on the chip node itself.
      expect(inline.marks).toBeUndefined();
    });
  });

  it('wraps inline image inside a paragraph', () => {
    const out = toTiptapJson({
      type: 'document',
      children: [
        { type: 'image', url: 'x.png', alt: 'a', title: null },
      ],
    });
    expect(out.content?.[0].type).toBe('paragraph');
    expect(out.content?.[0].content?.[0].type).toBe('image');
  });
});

describe('fromTiptapJson', () => {
  it('rejects a non-doc root', () => {
    expect(() =>
      fromTiptapJson({ type: 'paragraph', content: [] }),
    ).toThrow();
  });

  it('reverses headings preserving level', () => {
    const out = fromTiptapJson({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'hi' }],
        },
      ],
    });
    expect(out.children[0]).toMatchObject({ type: 'heading', level: 2 });
  });

  it('reverses bulletList back into a list block', () => {
    const out = fromTiptapJson({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'x' }],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(out.children[0]).toMatchObject({
      type: 'list',
      ordered: false,
    });
  });

  it('reverses referenceChip → reference_chip', () => {
    const out = fromTiptapJson({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'referenceChip',
              attrs: { refId: 'r-1.2.3', text: 'x', title: 't', stale: false },
            },
          ],
        },
      ],
    });
    const chip = (out.children[0] as any).children[0];
    expect(chip).toMatchObject({
      type: 'reference_chip',
      refId: 'r-1.2.3',
      text: 'x',
      title: 't',
    });
  });

  it('reverses text-with-bold-mark to strong inline', () => {
    const out = fromTiptapJson({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'bold',
              marks: [{ type: 'bold' }],
            },
          ],
        },
      ],
    });
    const inline = (out.children[0] as any).children[0];
    expect(inline.type).toBe('strong');
  });

  it('paragraph holding only an image becomes a block image', () => {
    const out = fromTiptapJson({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'image', attrs: { src: 'x.png', alt: 'a' } },
          ],
        },
      ],
    });
    expect(out.children[0]).toMatchObject({
      type: 'image',
      url: 'x.png',
      alt: 'a',
    });
  });

  it('preserves multi-line codeBlock via hardBreak children', () => {
    // TipTap may emit hardBreak nodes when the user presses Enter
    // inside a code block; the bridge must turn those into literal
    // newlines, not drop them.
    const out = fromTiptapJson({
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: 'ts' },
          content: [
            { type: 'text', text: 'const x = 1;' },
            { type: 'hardBreak' },
            { type: 'text', text: 'const y = 2;' },
          ],
        },
      ],
    });
    const code = out.children[0] as any;
    expect(code.type).toBe('code');
    expect(code.value).toBe('const x = 1;\nconst y = 2;');
  });

  it('drops unknown block types silently (mid-typing artifacts)', () => {
    const out = fromTiptapJson({
      type: 'doc',
      content: [
        { type: 'mystery', content: [] },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'real' }],
        },
      ],
    });
    expect(out.children).toHaveLength(1);
    expect(out.children[0].type).toBe('paragraph');
  });
});

describe('roundtrip md → tiptap → md (via parse + serialize)', () => {
  const fixtures = [
    { name: 'heading', md: '# title\n' },
    { name: 'paragraph', md: 'just text\n' },
    { name: 'bullet list', md: '- a\n- b\n' },
    { name: 'ordered list', md: '1. a\n2. b\n' },
    { name: 'blockquote', md: '> quoted\n' },
    {
      name: 'reference chip',
      md: '[推断生词](req://r-1.2.3 "课标 2.1.3 · 语言能力")\n',
    },
    {
      name: 'mixed prose + chip',
      md: 'see [推断生词](req://r-1.2.3 "课标 2.1.3 · 语言能力") here\n',
    },
    {
      name: 'list of chips',
      md:
        '- [a](req://r-1 "A · cat-a")\n' +
        '- [b](req://r-2 "B · cat-b")\n',
    },
  ];

  for (const { name, md } of fixtures) {
    it(`survives via TipTap for: ${name}`, () => {
      const once = roundtripViaTiptap(md);
      const twice = roundtripViaTiptap(once);
      // Idempotent: second roundtrip equals first.
      expect(twice).toBe(once);
      // chips preserved when input has any
      if (md.includes('req://')) {
        expect(once).toContain('req://');
      }
    });
  }
});
