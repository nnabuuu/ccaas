/**
 * Block tree → markdown serializer for lesson plans.
 *
 * Built on `remark-stringify`. We convert our block tree back to
 * mdast then let remark format it. Normalization rules per
 * `docs/lesson-plan-format-design.md` §3:
 *  - bullet `-` (never `*` or `+`)
 *  - emphasis `*` for italic, `**` for strong
 *  - blank lines between blocks
 *  - trailing newline
 *
 * Roundtrip contract: `serialize(parse(md)) === normalize(md)`. We
 * test this with property tests against a corpus of representative
 * lesson plans.
 */

import { unified } from 'unified';
import remarkStringify from 'remark-stringify';
import type {
  Root as MdRoot,
  Content as MdContent,
  PhrasingContent,
  Heading as MdHeading,
  Paragraph as MdParagraph,
  List as MdList,
  ListItem as MdListItem,
  Blockquote as MdBlockquote,
  Code as MdCode,
  Link as MdLink,
  Emphasis as MdEmphasis,
  Strong as MdStrong,
} from 'mdast';

import type {
  BlockNode,
  HeadingBlock,
  InlineNode,
  ListBlock,
  ParagraphBlock,
  PlanDocument,
  ReferenceChipInline,
  ToggleBlock,
} from './types';

const REQ_SCHEME = 'req://';

const processor = unified().use(remarkStringify, {
  bullet: '-',
  emphasis: '*',
  strong: '*',
  // Use indented continuation rather than tightening lists — produces
  // diff-friendly output and matches the design's "list inside one
  // blank-line block" expectation.
  listItemIndent: 'one',
  // remark-stringify defaults to LF endings; explicit for clarity.
  rule: '-',
  fences: true,
  // Use single-quote string for link titles so embedded double quotes
  // in canonical L1 metadata don't need escaping. (e.g. a category
  // labeled `语言能力 "听说"` becomes `'语言能力 "听说"'` in markdown.)
  quote: "'",
});

/**
 * Sanitize chip text/title before emitting into markdown. Library L1
 * `text` and `titleMetadata` could in principle contain markdown
 * special chars (`[`, `]`, `*`, `\`, backticks, etc.) that would
 * either round-trip-break (escape inconsistencies) or worse, break
 * out of the link structurally.
 *
 * Strategy: strip the structural chars `[ ] ( ) \` to plain space.
 * Markdown-meaningful chars like `*` / `_` / backticks survive
 * because remark-stringify's text escaper handles them safely.
 *
 * This is a one-way cleaning step — we trust L1 to ship sensible
 * text and treat any structural chars as data corruption.
 */
function sanitizeChipText(value: string): string {
  return value.replace(/[\[\]()\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Title goes inside single quotes; only single-quote needs escaping. */
function sanitizeChipTitle(value: string | null): string | null {
  if (value == null) return null;
  return value.replace(/'/g, ' ').replace(/\s+/g, ' ').trim() || null;
}

export function serializeLessonPlan(doc: PlanDocument): string {
  const root: MdRoot = {
    type: 'root',
    children: doc.children
      .map(toMdast)
      .filter((n): n is MdContent => n !== null),
  };
  const out = processor.stringify(root);
  // remark-stringify's output already has a trailing newline; double
  // newlines between blocks come from the formatter. Belt-and-braces
  // single trailing \n.
  return out.endsWith('\n') ? out : out + '\n';
}

function toMdast(node: BlockNode): MdContent | null {
  switch (node.type) {
    case 'heading':
      return headingToMdast(node);
    case 'paragraph':
      return paragraphToMdast(node);
    case 'list':
      return listToMdast(node);
    case 'blockquote':
      return blockquoteToMdast(node);
    case 'code':
      return codeToMdast(node);
    case 'divider':
      return { type: 'thematicBreak' };
    case 'image':
      // Image as its own paragraph holding only an image inline. This
      // matches how remark-parse re-emits a block-level image.
      return {
        type: 'paragraph',
        children: [
          {
            type: 'image',
            url: node.url,
            alt: node.alt,
            title: node.title,
          },
        ],
      };
    case 'toggle':
      return toggleToMdast(node);
    case 'html':
      return { type: 'html', value: node.value };
    default:
      return null;
  }
}

function headingToMdast(node: HeadingBlock): MdHeading {
  return {
    type: 'heading',
    depth: node.level,
    children: inlineChildrenToMdast(node.children),
  };
}

function paragraphToMdast(node: ParagraphBlock): MdParagraph {
  return {
    type: 'paragraph',
    children: inlineChildrenToMdast(node.children),
  };
}

function listToMdast(node: ListBlock): MdList {
  return {
    type: 'list',
    ordered: node.ordered,
    spread: false,
    children: node.items.map(
      (it): MdListItem => ({
        type: 'listItem',
        spread: false,
        children: it.children
          .map(toMdast)
          .filter((n): n is MdContent => n !== null) as MdListItem['children'],
      }),
    ),
  };
}

function blockquoteToMdast(node: BlockNode & { type: 'blockquote' }): MdBlockquote {
  return {
    type: 'blockquote',
    children: node.children
      .map(toMdast)
      .filter((n): n is MdContent => n !== null) as MdBlockquote['children'],
  };
}

function codeToMdast(node: BlockNode & { type: 'code' }): MdCode {
  return {
    type: 'code',
    lang: node.lang,
    value: node.value,
  };
}

function toggleToMdast(node: ToggleBlock): MdContent {
  // <details>/<summary> as a raw HTML block. Body is re-serialized
  // through the same serializer (recursion) so nested toggles work.
  const bodyMd = serializeLessonPlan({
    type: 'document',
    children: node.children,
  }).trimEnd();
  const value = `<details><summary>${node.summary}</summary>\n\n${bodyMd}\n\n</details>`;
  return { type: 'html', value };
}

// ── Inline ─────────────────────────────────────────────────────────

function inlineChildrenToMdast(children: InlineNode[]): PhrasingContent[] {
  return children
    .map(inlineToMdast)
    .filter((n): n is PhrasingContent => n !== null);
}

function inlineToMdast(node: InlineNode): PhrasingContent | null {
  switch (node.type) {
    case 'text':
      return { type: 'text', value: node.value };
    case 'emphasis':
      return {
        type: 'emphasis',
        children: inlineChildrenToMdast(node.children),
      } as MdEmphasis;
    case 'strong':
      return {
        type: 'strong',
        children: inlineChildrenToMdast(node.children),
      } as MdStrong;
    case 'inline_code':
      return { type: 'inlineCode', value: node.value };
    case 'link':
      return {
        type: 'link',
        url: node.url,
        title: node.title,
        children: inlineChildrenToMdast(node.children),
      } as MdLink;
    case 'reference_chip':
      return referenceChipToMdast(node);
    case 'linebreak':
      return { type: 'break' };
    default:
      return null;
  }
}

function referenceChipToMdast(node: ReferenceChipInline): MdLink {
  // Serialize as a standard markdown link with `req://` URL. The
  // text inside becomes the link label; the title attribute carries
  // the denormalized metadata so agents can `cat` it without a
  // library lookup (see design §1).
  //
  // Sanitize text + title to defend against L1 entries that contain
  // markdown special chars (`[`, `]`, `\`, single quotes inside
  // single-quoted titles). Without this, the chip would either
  // round-trip-break or — worse — break out of the link structurally.
  return {
    type: 'link',
    url: `${REQ_SCHEME}${node.refId}`,
    title: sanitizeChipTitle(node.title),
    children: [{ type: 'text', value: sanitizeChipText(node.text) }],
  };
}
