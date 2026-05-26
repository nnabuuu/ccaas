/**
 * Block-tree types for the lesson plan markdown editor.
 *
 * Markdown is the canonical storage layer (see
 * `docs/lesson-plan-format-design.md` §3). The editor parses markdown
 * into the block tree below, edits, then serializes back. Roundtrip
 * stability is a hard contract: `serialize(parse(md)) === normalize(md)`.
 *
 * The mapping mirrors mdast's structure but adds a `reference_chip`
 * node for `req://` links — those parse as normal mdast `link` nodes
 * but the canonicalizer / editor treats them as a distinct block
 * (rich chip rendering, picker integration).
 */

export type BlockNode =
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | BlockquoteBlock
  | CodeBlock
  | DividerBlock
  | ImageBlock
  | ToggleBlock
  | HtmlBlock;

export interface HeadingBlock {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: InlineNode[];
}

export interface ParagraphBlock {
  type: 'paragraph';
  children: InlineNode[];
}

export interface ListBlock {
  type: 'list';
  ordered: boolean;
  items: ListItemBlock[];
}

export interface ListItemBlock {
  type: 'list_item';
  /** Each item may contain block-level children (paragraphs, nested lists). */
  children: BlockNode[];
}

export interface BlockquoteBlock {
  type: 'blockquote';
  children: BlockNode[];
}

export interface CodeBlock {
  type: 'code';
  lang: string | null;
  value: string;
}

export interface DividerBlock {
  type: 'divider';
}

export interface ImageBlock {
  type: 'image';
  url: string;
  alt: string;
  title: string | null;
}

export interface ToggleBlock {
  type: 'toggle';
  /** Plain-text summary; rich content not supported in v1 (markdown limitation). */
  summary: string;
  /** Body parsed as markdown blocks. */
  children: BlockNode[];
}

/**
 * Raw HTML fragment — used for the file-top comment header per design
 * §4.2 layer 1. Preserved verbatim through the roundtrip so the
 * editor doesn't strip the agent-facing contract documentation.
 */
export interface HtmlBlock {
  type: 'html';
  value: string;
}

// ── Inline nodes ────────────────────────────────────────────────────

export type InlineNode =
  | TextInline
  | EmphasisInline
  | StrongInline
  | InlineCodeInline
  | LinkInline
  | ReferenceChipInline
  | LineBreakInline;

export interface TextInline {
  type: 'text';
  value: string;
}

export interface EmphasisInline {
  type: 'emphasis';
  children: InlineNode[];
}

export interface StrongInline {
  type: 'strong';
  children: InlineNode[];
}

export interface InlineCodeInline {
  type: 'inline_code';
  value: string;
}

export interface LinkInline {
  type: 'link';
  url: string;
  title: string | null;
  children: InlineNode[];
}

/**
 * Special inline node for `[text](req://r-X.Y.Z "課標 …")` references.
 * Parsed automatically by the parser when it sees a link with the
 * `req://` URI scheme. Editor renders this as a rich chip with
 * category + standard code; canonicalizer refreshes `text`/`title`
 * against the L1 library.
 *
 * `stale` is set by the canonicalizer when the L1 library no longer
 * contains this id — the editor renders a "broken-link chip" so the
 * teacher can decide what to do.
 */
export interface ReferenceChipInline {
  type: 'reference_chip';
  /** The opaque id after `req://`. */
  refId: string;
  /** Denormalized fields, refreshed by the canonicalizer. */
  text: string;
  title: string | null;
  stale?: boolean;
}

export interface LineBreakInline {
  type: 'linebreak';
}

/** Top-level document is a flat sequence of blocks. */
export interface PlanDocument {
  type: 'document';
  children: BlockNode[];
}
