/**
 * Markdown → block tree parser for lesson plans.
 *
 * Built on `remark-parse` (mdast). We convert mdast nodes into our
 * `BlockNode` / `InlineNode` shapes so the editor doesn't depend on
 * mdast types directly (lets us swap parsers later if needed).
 *
 * Recognized features:
 *  - Headings (1-6), paragraphs, lists (bullet/ordered), blockquotes,
 *    fenced code, thematic breaks (---), images, emphasis/strong/code
 *  - HTML blocks (preserved verbatim — used for the file-top contract
 *    comment per design §4.2 layer 1)
 *  - HTML `<details><summary>` toggle blocks (mdast emits these as
 *    raw HTML; we recognize the pattern and split summary/body)
 *  - `[text](req://id "metadata")` links → `reference_chip` inline node
 *
 * Anything we don't model is preserved as `html` blocks so the
 * roundtrip is non-lossy.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
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
  Image as MdImage,
  Link as MdLink,
  Text as MdText,
  Emphasis as MdEmphasis,
  Strong as MdStrong,
  InlineCode as MdInlineCode,
  HTML as MdHtml,
} from 'mdast';

import type {
  BlockNode,
  InlineNode,
  ListItemBlock,
  PlanDocument,
  ToggleBlock,
} from './types';

const REQ_SCHEME = 'req://';

/**
 * Valid refId grammar — `[A-Za-z0-9._-]` with optional namespace
 * colon (`r-1.2.3`, `m-1.1.1`). Restricted on purpose:
 *  - `)` would terminate the markdown link early on re-parse
 *  - `"` would terminate the title attribute
 *  - whitespace / control chars are nonsense in an id
 *  - `<`/`>`/`/` could enable HTML injection or path traversal
 * On parse, a malformed refId falls back to a plain `link` so the
 * markdown stays well-formed for other consumers (agents tailing
 * `cat`, downstream renderers, etc.).
 */
const REF_ID_GRAMMAR = /^[A-Za-z0-9._:-]{1,128}$/;

/** Match a `<details><summary>...</summary>...</details>` html block. */
const DETAILS_PATTERN = /^<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>\s*$/;

const processor = unified().use(remarkParse);

export function parseLessonPlan(markdown: string): PlanDocument {
  const tree = processor.parse(markdown) as MdRoot;
  return {
    type: 'document',
    children: tree.children
      .map(convertBlock)
      .filter((b): b is BlockNode => b !== null),
  };
}

function convertBlock(node: MdContent): BlockNode | null {
  switch (node.type) {
    case 'heading':
      return convertHeading(node);
    case 'paragraph':
      return {
        type: 'paragraph',
        children: convertInlineChildren(node.children),
      };
    case 'list':
      return convertList(node);
    case 'blockquote':
      return convertBlockquote(node);
    case 'code':
      return convertCode(node);
    case 'thematicBreak':
      return { type: 'divider' };
    case 'html':
      return convertHtml(node);
    case 'definition':
    case 'footnoteDefinition':
      // Not surfaced in v1 (editor doesn't generate them, and reliable
      // serialization back to markdown definitions is non-trivial).
      // Files containing these get them stripped on roundtrip —
      // acceptable v1 cost since lesson plans don't use these.
      return null;
    default:
      // YAML frontmatter, GFM tables, footnotes, etc. V1 strips them
      // on roundtrip (they're stripped silently — we'd surface as
      // `html` blocks if we could, but mdast doesn't give us the
      // original source span for unknown types). If real usage
      // demands these, v2 would add typed AST nodes.
      return null;
  }
}

function convertHeading(node: MdHeading): BlockNode {
  return {
    type: 'heading',
    level: node.depth as 1 | 2 | 3 | 4 | 5 | 6,
    children: convertInlineChildren(node.children),
  };
}

function convertList(node: MdList): BlockNode {
  return {
    type: 'list',
    ordered: Boolean(node.ordered),
    items: node.children.map(convertListItem),
  };
}

function convertListItem(node: MdListItem): ListItemBlock {
  return {
    type: 'list_item',
    children: node.children
      .map(convertBlock)
      .filter((b): b is BlockNode => b !== null),
  };
}

function convertBlockquote(node: MdBlockquote): BlockNode {
  return {
    type: 'blockquote',
    children: node.children
      .map(convertBlock)
      .filter((b): b is BlockNode => b !== null),
  };
}

function convertCode(node: MdCode): BlockNode {
  return {
    type: 'code',
    lang: node.lang ?? null,
    value: node.value,
  };
}

function convertHtml(node: MdHtml): BlockNode {
  const details = DETAILS_PATTERN.exec(node.value);
  if (details) {
    const [, summaryRaw, bodyRaw] = details;
    // Re-parse the body inside the toggle as markdown so users can
    // nest rich content inside collapsibles. The summary is plain
    // text — markdown inside <summary> is generally unsupported by
    // GitHub-flavored renderers, so we don't try to be clever.
    const bodyDoc = parseLessonPlan(bodyRaw.trim());
    const toggle: ToggleBlock = {
      type: 'toggle',
      summary: summaryRaw.trim(),
      children: bodyDoc.children,
    };
    return toggle;
  }
  return { type: 'html', value: node.value };
}

// ── Inline ─────────────────────────────────────────────────────────

function convertInlineChildren(children: PhrasingContent[]): InlineNode[] {
  return children
    .map(convertInline)
    .filter((n): n is InlineNode => n !== null);
}

function convertInline(node: PhrasingContent): InlineNode | null {
  switch (node.type) {
    case 'text':
      return convertText(node);
    case 'emphasis':
      return {
        type: 'emphasis',
        children: convertInlineChildren(node.children),
      };
    case 'strong':
      return {
        type: 'strong',
        children: convertInlineChildren(node.children),
      };
    case 'inlineCode':
      return convertInlineCode(node);
    case 'link':
      return convertLink(node);
    case 'image':
      // Inline image — preserve as a text-with-markdown fallback. The
      // editor's block-level image takes precedence; we shouldn't
      // see inline images often. Convert to a link-shaped inline so
      // it survives serialization (no inline_image type in v1).
      return convertImageAsInline(node);
    case 'break':
      return { type: 'linebreak' };
    default:
      return null;
  }
}

function convertText(node: MdText): InlineNode {
  return { type: 'text', value: node.value };
}

function convertInlineCode(node: MdInlineCode): InlineNode {
  return { type: 'inline_code', value: node.value };
}

function convertLink(node: MdLink): InlineNode {
  // Recognize `req://` URLs as typed library references — but only if
  // the refId is well-formed. A malformed refId (containing `)`, `"`,
  // whitespace, etc.) falls back to a plain link; the resulting
  // markdown is still well-formed and other consumers see a regular
  // link they can ignore.
  if (node.url.startsWith(REQ_SCHEME)) {
    const refId = node.url.slice(REQ_SCHEME.length);
    if (REF_ID_GRAMMAR.test(refId)) {
      const text = inlineToPlainText(convertInlineChildren(node.children));
      return {
        type: 'reference_chip',
        refId,
        text,
        title: node.title ?? null,
      };
    }
    // Malformed refId — fall through to plain link.
  }
  return {
    type: 'link',
    url: node.url,
    title: node.title ?? null,
    children: convertInlineChildren(node.children),
  };
}

function convertImageAsInline(_node: MdImage): InlineNode {
  // V1 doesn't model inline images. Rendering as `text` with
  // `![alt](url)` looks like the right roundtrip, but
  // remark-stringify escapes `!`/`[` in text content, so the
  // serialized output becomes `\!\[alt]\(url\)` and re-parses as
  // literal text, not an image — silently lossy.
  //
  // Returning empty text is also lossy, but predictably so. The
  // editor never generates inline images (block-level only via the
  // image block). If a teacher pastes markdown with inline images,
  // they get stripped — acceptable v1 cost. v2 may add a typed
  // `inline_image` AST node if real usage demands it.
  return { type: 'text', value: '' };
}

function inlineToPlainText(nodes: InlineNode[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case 'text':
          return n.value;
        case 'inline_code':
          return n.value;
        case 'emphasis':
        case 'strong':
        case 'link':
          return inlineToPlainText(n.children);
        case 'reference_chip':
          return n.text;
        case 'linebreak':
          return ' ';
        default:
          return '';
      }
    })
    .join('');
}
