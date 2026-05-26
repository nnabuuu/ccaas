/**
 * Canonicalizer — refreshes `reference_chip` inline nodes against the
 * L1 library.
 *
 * Per `docs/lesson-plan-format-design.md` §1 (Canonicalization):
 *
 *  - **Load time**: walk the document, for each `reference_chip`:
 *      - If the L1 library still has the id, overwrite `text` and
 *        `title` with the current canonical values. Denormalized
 *        fields in the document on disk get refreshed.
 *      - If the L1 library no longer has the id, set `stale: true`
 *        so the editor renders a broken-chip warning.
 *  - **Save time**: same operation — the file on disk gets written
 *    with the latest canonical text/title. This means agent
 *    `cat plan/lesson-plan.md` always sees an up-to-date snapshot.
 *
 * The canonicalizer doesn't talk to the library directly; the caller
 * provides a `LibraryLookup` function. This lets us:
 *  - Test without standing up the L1 service.
 *  - Mock the library in the editor (e.g. for offline preview).
 *  - Swap the lookup source (REST API vs. materialized `_lib/*.md`
 *    file) without changing this code.
 */

import type {
  BlockNode,
  InlineNode,
  ListItemBlock,
  PlanDocument,
  ReferenceChipInline,
} from './types';

/** Shape the canonicalizer expects from the library. */
export interface LibraryEntry {
  text: string;
  /** Pre-formatted "课标 X.Y · 分类" string. */
  titleMetadata: string;
}

export type LibraryLookup = (refId: string) => LibraryEntry | undefined;

/**
 * Returns a NEW document with all `reference_chip` nodes canonicalized.
 * Doesn't mutate the input (tree is shallow-cloned along the path of
 * refreshed nodes).
 */
export function canonicalizeLessonPlan(
  doc: PlanDocument,
  lookup: LibraryLookup,
): PlanDocument {
  return {
    type: 'document',
    children: doc.children.map((b) => canonicalizeBlock(b, lookup)),
  };
}

function canonicalizeBlock(node: BlockNode, lookup: LibraryLookup): BlockNode {
  switch (node.type) {
    case 'heading':
    case 'paragraph':
      return {
        ...node,
        children: node.children.map((c) => canonicalizeInline(c, lookup)),
      };
    case 'list':
      return {
        ...node,
        items: node.items.map(
          (it): ListItemBlock => ({
            ...it,
            children: it.children.map((c) => canonicalizeBlock(c, lookup)),
          }),
        ),
      };
    case 'blockquote':
      return {
        ...node,
        children: node.children.map((c) => canonicalizeBlock(c, lookup)),
      };
    case 'toggle':
      return {
        ...node,
        children: node.children.map((c) => canonicalizeBlock(c, lookup)),
      };
    case 'code':
    case 'divider':
    case 'image':
    case 'html':
      return node;
  }
}

function canonicalizeInline(
  node: InlineNode,
  lookup: LibraryLookup,
): InlineNode {
  if (node.type === 'reference_chip') {
    return canonicalizeChip(node, lookup);
  }
  if (
    node.type === 'emphasis' ||
    node.type === 'strong' ||
    node.type === 'link'
  ) {
    return {
      ...node,
      children: node.children.map((c) => canonicalizeInline(c, lookup)),
    };
  }
  return node;
}

function canonicalizeChip(
  node: ReferenceChipInline,
  lookup: LibraryLookup,
): ReferenceChipInline {
  const entry = lookup(node.refId);
  if (!entry) {
    return {
      ...node,
      stale: true,
    };
  }
  return {
    type: 'reference_chip',
    refId: node.refId,
    text: entry.text,
    title: entry.titleMetadata,
    // Explicit absence of `stale` — successful lookup clears any
    // prior staleness from a previous canonicalize pass.
  };
}

/**
 * Build a `LibraryLookup` from a flat array of items (shape returned
 * by `GET /api/teaching-requirements?subject=…&q=`). Convenience for
 * the editor + materializer.
 */
export function makeLookup(
  items: Array<{
    id: string;
    text: string;
    code: string;
    categoryLabel: string;
  }>,
): LibraryLookup {
  const map = new Map<string, LibraryEntry>();
  for (const item of items) {
    map.set(item.id, {
      text: item.text,
      titleMetadata: `${item.code} · ${item.categoryLabel}`,
    });
  }
  return (refId) => map.get(refId);
}

/**
 * Collect all `req://` ids referenced in a document. Used by the Plan
 * Tab to know which interpretations to fetch from L2.
 */
export function collectReqIds(doc: PlanDocument): string[] {
  const out = new Set<string>();
  for (const block of doc.children) {
    collectFromBlock(block, out);
  }
  return Array.from(out);
}

function collectFromBlock(node: BlockNode, out: Set<string>): void {
  switch (node.type) {
    case 'heading':
    case 'paragraph':
      for (const c of node.children) collectFromInline(c, out);
      return;
    case 'list':
      for (const it of node.items) {
        for (const c of it.children) collectFromBlock(c, out);
      }
      return;
    case 'blockquote':
    case 'toggle':
      for (const c of node.children) collectFromBlock(c, out);
      return;
  }
}

function collectFromInline(node: InlineNode, out: Set<string>): void {
  if (node.type === 'reference_chip') {
    out.add(node.refId);
    return;
  }
  if (
    node.type === 'emphasis' ||
    node.type === 'strong' ||
    node.type === 'link'
  ) {
    for (const c of node.children) collectFromInline(c, out);
  }
}
