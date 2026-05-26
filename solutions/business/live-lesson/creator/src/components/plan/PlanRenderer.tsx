/**
 * PlanRenderer — read-only render of a parsed lesson plan AST.
 *
 * Walks the block tree (from `parseLessonPlan`) and emits React
 * elements. Reference chips fetch their `myInterpretation` from the
 * caller-provided lookup, which the parent component prepares with
 * the L2 batch fetch.
 *
 * Editable rendering (TipTap) lives in a separate component
 * (PlanEditor); this one is the always-on read-only view used both
 * stand-alone and as a fallback when the editor hasn't booted yet.
 */

import type { ReactNode } from 'react'
import type {
  BlockNode,
  InlineNode,
  ListItemBlock,
  PlanDocument,
  ReferenceChipInline,
} from '../../lib/lesson-plan-md'
import type { InterpretationOverlay } from '../../api/teaching-requirements'
import ReferenceChip from './ReferenceChip'

export interface ChipResolution {
  /** L1 category color for chip styling; absent for stale chips. */
  categoryColor?: string
  /** L2 overlay if the current user has one. */
  interpretation: InterpretationOverlay | null
}

export type ChipResolver = (refId: string) => ChipResolution

interface Props {
  doc: PlanDocument
  /** Maps a refId to category color + interpretation. */
  resolveChip: ChipResolver
  /** Called when a chip's "edit interpretation" button is clicked. */
  onEditInterpretation?: (refId: string) => void
}

export default function PlanRenderer({
  doc,
  resolveChip,
  onEditInterpretation,
}: Props) {
  return (
    <div className="prose-plan space-y-4 leading-relaxed text-gray-900">
      {doc.children.map((block, i) => renderBlock(block, i, resolveChip, onEditInterpretation))}
    </div>
  )
}

function renderBlock(
  block: BlockNode,
  index: number,
  resolveChip: ChipResolver,
  onEditInterpretation?: (refId: string) => void,
): ReactNode {
  const key = `b-${index}`
  switch (block.type) {
    case 'heading':
      return renderHeading(block, key, resolveChip, onEditInterpretation)
    case 'paragraph':
      return (
        <p key={key} className="text-gray-800">
          {block.children.map((c, j) => renderInline(c, `${key}-i${j}`, resolveChip, onEditInterpretation))}
        </p>
      )
    case 'list':
      return renderList(block, key, resolveChip, onEditInterpretation)
    case 'blockquote':
      return (
        <blockquote
          key={key}
          className="border-l-4 border-gray-300 pl-4 py-1 text-gray-600 italic"
        >
          {block.children.map((c, j) => renderBlock(c, j, resolveChip, onEditInterpretation))}
        </blockquote>
      )
    case 'code':
      return (
        <pre key={key} className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto text-sm">
          <code className={block.lang ? `language-${block.lang}` : undefined}>
            {block.value}
          </code>
        </pre>
      )
    case 'divider':
      return <hr key={key} className="border-gray-200 my-6" />
    case 'image':
      return (
        <img
          key={key}
          src={block.url}
          alt={block.alt}
          title={block.title ?? undefined}
          className="max-w-full rounded-md"
        />
      )
    case 'toggle':
      return (
        <details key={key} className="rounded-md border border-gray-200 p-3 open:bg-gray-50">
          <summary className="cursor-pointer font-medium text-gray-700">
            {block.summary}
          </summary>
          <div className="mt-2 space-y-2">
            {block.children.map((c, j) => renderBlock(c, j, resolveChip, onEditInterpretation))}
          </div>
        </details>
      )
    case 'html':
      // We render html blocks as nothing in the visual layer — they
      // exist purely to round-trip the agent contract comment. Leaking
      // them into the DOM would either show as literal `<!-- -->` or
      // worse, get parsed as HTML and break layout.
      return null
  }
}

function renderHeading(
  block: BlockNode & { type: 'heading' },
  key: string,
  resolveChip: ChipResolver,
  onEditInterpretation?: (refId: string) => void,
): ReactNode {
  const children = block.children.map((c, j) =>
    renderInline(c, `${key}-i${j}`, resolveChip, onEditInterpretation),
  )
  const sizes: Record<number, string> = {
    1: 'text-3xl font-bold mt-6',
    2: 'text-2xl font-semibold mt-5',
    3: 'text-xl font-semibold mt-4',
    4: 'text-lg font-semibold mt-3',
    5: 'text-base font-semibold mt-3',
    6: 'text-sm font-semibold mt-3 uppercase tracking-wide',
  }
  const className = sizes[block.level]
  switch (block.level) {
    case 1:
      return <h1 key={key} className={className}>{children}</h1>
    case 2:
      return <h2 key={key} className={className}>{children}</h2>
    case 3:
      return <h3 key={key} className={className}>{children}</h3>
    case 4:
      return <h4 key={key} className={className}>{children}</h4>
    case 5:
      return <h5 key={key} className={className}>{children}</h5>
    case 6:
      return <h6 key={key} className={className}>{children}</h6>
  }
}

function renderList(
  block: BlockNode & { type: 'list' },
  key: string,
  resolveChip: ChipResolver,
  onEditInterpretation?: (refId: string) => void,
): ReactNode {
  const items = block.items.map((it, i) => renderListItem(it, `${key}-li${i}`, resolveChip, onEditInterpretation))
  return block.ordered ? (
    <ol key={key} className="list-decimal pl-6 space-y-1">{items}</ol>
  ) : (
    <ul key={key} className="list-disc pl-6 space-y-1">{items}</ul>
  )
}

function renderListItem(
  item: ListItemBlock,
  key: string,
  resolveChip: ChipResolver,
  onEditInterpretation?: (refId: string) => void,
): ReactNode {
  return (
    <li key={key}>
      {item.children.map((c, j) => renderBlock(c, j, resolveChip, onEditInterpretation))}
    </li>
  )
}

function renderInline(
  node: InlineNode,
  key: string,
  resolveChip: ChipResolver,
  onEditInterpretation?: (refId: string) => void,
): ReactNode {
  switch (node.type) {
    case 'text':
      return <span key={key}>{node.value}</span>
    case 'emphasis':
      return (
        <em key={key}>
          {node.children.map((c, j) => renderInline(c, `${key}-${j}`, resolveChip, onEditInterpretation))}
        </em>
      )
    case 'strong':
      return (
        <strong key={key}>
          {node.children.map((c, j) => renderInline(c, `${key}-${j}`, resolveChip, onEditInterpretation))}
        </strong>
      )
    case 'inline_code':
      return (
        <code key={key} className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">
          {node.value}
        </code>
      )
    case 'link':
      return (
        <a
          key={key}
          href={node.url}
          title={node.title ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="text-teal-700 underline hover:text-teal-900"
        >
          {node.children.map((c, j) => renderInline(c, `${key}-${j}`, resolveChip, onEditInterpretation))}
        </a>
      )
    case 'reference_chip':
      return renderChip(node, key, resolveChip, onEditInterpretation)
    case 'linebreak':
      return <br key={key} />
  }
}

function renderChip(
  node: ReferenceChipInline,
  key: string,
  resolveChip: ChipResolver,
  onEditInterpretation?: (refId: string) => void,
): ReactNode {
  const resolved = resolveChip(node.refId)
  return (
    <ReferenceChip
      key={key}
      refId={node.refId}
      text={node.text}
      title={node.title}
      categoryColor={resolved.categoryColor}
      stale={node.stale}
      interpretation={resolved.interpretation}
      onEditInterpretation={
        onEditInterpretation
          ? () => onEditInterpretation(node.refId)
          : undefined
      }
    />
  )
}
