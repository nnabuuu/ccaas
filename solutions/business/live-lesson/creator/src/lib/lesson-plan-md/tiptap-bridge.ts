/**
 * Bridge between our `PlanDocument` AST and TipTap's ProseMirror JSON.
 *
 * Why the bridge: the editor needs ProseMirror's JSON shape, but the
 * storage layer is markdown. Round-trip flow:
 *
 *   on load:  markdown → parseLessonPlan → PlanDocument → toTiptapJson → ProseMirror state
 *   on save:  ProseMirror state → fromTiptapJson → PlanDocument → canonicalize → serialize → markdown
 *
 * Keeping the bridge in this lib (next to parse/serialize) means the
 * editor component stays focused on TipTap configuration; the
 * markdown↔editor mapping has one home.
 *
 * Type shape is intentionally minimal — we don't import TipTap types
 * to keep this lib free of editor-framework deps. The shape matches
 * ProseMirror's `JSONContent`.
 */

import type {
  BlockNode,
  HeadingBlock,
  InlineNode,
  ListBlock,
  ListItemBlock,
  PlanDocument,
  ReferenceChipInline,
} from './types';

export interface TiptapJson {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapJson[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
}

// ── PlanDocument → TipTap JSON ─────────────────────────────────────

export function toTiptapJson(doc: PlanDocument): TiptapJson {
  return {
    type: 'doc',
    content: doc.children.map(blockToTiptap),
  };
}

function blockToTiptap(node: BlockNode): TiptapJson {
  switch (node.type) {
    case 'heading':
      return {
        type: 'heading',
        attrs: { level: node.level },
        content: inlineChildren(node.children),
      };
    case 'paragraph':
      return {
        type: 'paragraph',
        content: inlineChildren(node.children),
      };
    case 'list':
      return listToTiptap(node);
    case 'blockquote':
      return {
        type: 'blockquote',
        content: node.children.map(blockToTiptap),
      };
    case 'code':
      return {
        type: 'codeBlock',
        attrs: { language: node.lang ?? null },
        content: node.value ? [{ type: 'text', text: node.value }] : undefined,
      };
    case 'divider':
      return { type: 'horizontalRule' };
    case 'image':
      // TipTap's image is a leaf atom (no content); we put it inside a
      // paragraph for compatibility with ProseMirror schemas that
      // don't allow loose top-level images.
      return {
        type: 'paragraph',
        content: [
          {
            type: 'image',
            attrs: {
              src: node.url,
              alt: node.alt || null,
              title: node.title,
            },
          },
        ],
      };
    case 'toggle':
      // TipTap doesn't ship a toggle natively. We serialize as a
      // blockquote with the summary as the first line — visually
      // similar enough for MVP, and the markdown roundtrip preserves
      // the exact `<details>` form regardless of the editor's
      // intermediate representation.
      return {
        type: 'blockquote',
        attrs: { 'data-toggle-summary': node.summary },
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: node.summary,
                marks: [{ type: 'bold' }],
              },
            ],
          },
          ...node.children.map(blockToTiptap),
        ],
      };
    case 'html':
      // HTML blocks (like the agent contract comment) preserved as
      // raw HTML nodes. TipTap renders them but most users edit
      // around them.
      return {
        type: 'htmlBlock',
        attrs: { html: node.value },
      };
  }
}

function listToTiptap(node: ListBlock): TiptapJson {
  return {
    type: node.ordered ? 'orderedList' : 'bulletList',
    content: node.items.map(
      (it: ListItemBlock): TiptapJson => ({
        type: 'listItem',
        content: it.children.map(blockToTiptap),
      }),
    ),
  };
}

type Mark = { type: string; attrs?: Record<string, unknown> };

function inlineChildren(children: InlineNode[]): TiptapJson[] {
  const out: TiptapJson[] = [];
  for (const c of children) {
    walkInline(c, [], out);
  }
  return out;
}

/**
 * Walk an inline node tree, flattening it to ProseMirror's leaf-text
 * + marks shape. Nested marks (e.g. bold inside italic + link)
 * stack correctly so users don't lose formatting on save.
 *
 * Outputs leaves (`text`, `hardBreak`, `referenceChip`) into `out`
 * with their accumulated `marks` array.
 */
function walkInline(
  node: InlineNode,
  marks: Mark[],
  out: TiptapJson[],
): void {
  switch (node.type) {
    case 'text':
      out.push(makeText(node.value, marks));
      return;
    case 'inline_code':
      out.push(makeText(node.value, [...marks, { type: 'code' }]));
      return;
    case 'emphasis':
      for (const c of node.children) {
        walkInline(c, [...marks, { type: 'italic' }], out);
      }
      return;
    case 'strong':
      for (const c of node.children) {
        walkInline(c, [...marks, { type: 'bold' }], out);
      }
      return;
    case 'link':
      for (const c of node.children) {
        walkInline(
          c,
          [
            ...marks,
            {
              type: 'link',
              attrs: { href: node.url, title: node.title },
            },
          ],
          out,
        );
      }
      return;
    case 'reference_chip':
      // Chips are atom nodes; they don't carry marks. We drop the
      // active mark stack at the boundary — this matches the
      // markdown semantics where a chip inside `**bold**` doesn't
      // get bold styling on its label.
      out.push(chipToTiptap(node));
      return;
    case 'linebreak':
      out.push({ type: 'hardBreak' });
      return;
  }
}

function makeText(value: string, marks: Mark[]): TiptapJson {
  const out: TiptapJson = { type: 'text', text: value };
  if (marks.length) out.marks = marks;
  return out;
}

function chipToTiptap(node: ReferenceChipInline): TiptapJson {
  return {
    type: 'referenceChip',
    attrs: {
      refId: node.refId,
      text: node.text,
      title: node.title,
      stale: node.stale ?? false,
    },
  };
}

// ── TipTap JSON → PlanDocument ─────────────────────────────────────

export function fromTiptapJson(json: TiptapJson): PlanDocument {
  if (json.type !== 'doc') {
    throw new Error(`expected root type "doc", got "${json.type}"`);
  }
  return {
    type: 'document',
    children: (json.content ?? [])
      .map(tiptapToBlock)
      .filter((b): b is BlockNode => b !== null),
  };
}

function tiptapToBlock(node: TiptapJson): BlockNode | null {
  switch (node.type) {
    case 'heading':
      return tiptapToHeading(node);
    case 'paragraph':
      return tiptapToParagraph(node);
    case 'bulletList':
      return tiptapToList(node, false);
    case 'orderedList':
      return tiptapToList(node, true);
    case 'blockquote':
      return tiptapToBlockquote(node);
    case 'codeBlock':
      return {
        type: 'code',
        lang: ((node.attrs?.language as string | null | undefined) ?? null) || null,
        // TipTap may emit hardBreak children inside code blocks when
        // the user presses Enter; map those to literal newlines.
        // Filtering by type === 'text' alone would silently turn
        // multi-line code into single-line.
        value: (node.content ?? [])
          .map((c) => {
            if (c.type === 'text') return c.text ?? '';
            if (c.type === 'hardBreak') return '\n';
            return '';
          })
          .join(''),
      };
    case 'horizontalRule':
      return { type: 'divider' };
    case 'htmlBlock':
      return {
        type: 'html',
        value: (node.attrs?.html as string) ?? '',
      };
    default:
      // Unknown block types from a richer schema get dropped — we
      // surface this as a no-op rather than throwing because the
      // editor may temporarily produce shapes the markdown layer
      // doesn't model (mid-typing artifacts, etc.).
      return null;
  }
}

function tiptapToHeading(node: TiptapJson): HeadingBlock {
  const level = ((node.attrs?.level as number | undefined) ?? 1) as
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6;
  return {
    type: 'heading',
    level,
    children: (node.content ?? [])
      .map(tiptapToInline)
      .filter((n): n is InlineNode => n !== null),
  };
}

function tiptapToParagraph(node: TiptapJson): BlockNode | null {
  // A paragraph holding a single image inline becomes a block-level
  // image (reverses the wrap done in `blockToTiptap`).
  if (
    node.content?.length === 1 &&
    node.content[0].type === 'image'
  ) {
    const img = node.content[0];
    return {
      type: 'image',
      url: (img.attrs?.src as string) ?? '',
      alt: (img.attrs?.alt as string) ?? '',
      title: (img.attrs?.title as string | null) ?? null,
    };
  }
  return {
    type: 'paragraph',
    children: (node.content ?? [])
      .map(tiptapToInline)
      .filter((n): n is InlineNode => n !== null),
  };
}

function tiptapToList(node: TiptapJson, ordered: boolean): ListBlock {
  return {
    type: 'list',
    ordered,
    items: (node.content ?? []).map(
      (it): ListItemBlock => ({
        type: 'list_item',
        children: (it.content ?? [])
          .map(tiptapToBlock)
          .filter((b): b is BlockNode => b !== null),
      }),
    ),
  };
}

function tiptapToBlockquote(node: TiptapJson): BlockNode {
  return {
    type: 'blockquote',
    children: (node.content ?? [])
      .map(tiptapToBlock)
      .filter((b): b is BlockNode => b !== null),
  };
}

function tiptapToInline(node: TiptapJson): InlineNode | null {
  switch (node.type) {
    case 'text':
      return textToInline(node);
    case 'hardBreak':
      return { type: 'linebreak' };
    case 'image':
      // Loose inline images would be rare (the round-trip drops them);
      // skip rather than synthesize a block-level image inside an
      // inline run.
      return null;
    case 'referenceChip':
      return {
        type: 'reference_chip',
        refId: (node.attrs?.refId as string) ?? '',
        text: (node.attrs?.text as string) ?? '',
        title: (node.attrs?.title as string | null) ?? null,
        ...(node.attrs?.stale ? { stale: true } : {}),
      };
    default:
      return null;
  }
}

function textToInline(node: TiptapJson): InlineNode {
  const text: InlineNode = { type: 'text', value: node.text ?? '' };
  if (!node.marks?.length) return text;
  // Apply marks outside-in; we wrap the innermost text with each
  // mark in order so the markdown layer can re-serialize accurately.
  let cur: InlineNode = text;
  for (const mark of node.marks) {
    switch (mark.type) {
      case 'bold':
        cur = { type: 'strong', children: [cur] };
        break;
      case 'italic':
        cur = { type: 'emphasis', children: [cur] };
        break;
      case 'code':
        cur = { type: 'inline_code', value: (cur as { value: string }).value };
        break;
      case 'link':
        cur = {
          type: 'link',
          url: (mark.attrs?.href as string) ?? '',
          title: (mark.attrs?.title as string | null) ?? null,
          children: [cur],
        };
        break;
      // Unknown marks dropped silently.
    }
  }
  return cur;
}
