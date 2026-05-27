import type { ReactNode } from 'react'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import type {
  Root as MdRoot,
  RootContent,
  PhrasingContent,
  Heading as MdHeading,
  Paragraph as MdParagraph,
  List as MdList,
  ListItem as MdListItem,
  Text as MdText,
  Emphasis as MdEmphasis,
  Strong as MdStrong,
  InlineCode as MdInlineCode,
  Link as MdLink,
  Html as MdHtml,
  Code as MdCode,
  Blockquote as MdBlockquote,
  Image as MdImage,
} from 'mdast'
import Callout from './Callout'
import {
  splitIntoSegments,
  stripBannerComment,
} from './audit-markdown'

/**
 * AuditReportRenderer — render the persisted audit markdown report.
 *
 * Two-pass design:
 *  1. Pre-split the raw markdown into a sequence of segments:
 *     either a "markdown" chunk or a "callout" block. Callouts are
 *     identified by the `:::pass[title] ... :::` syntax that the
 *     backend prompt instructs the LLM to emit. They're stripped out
 *     before passing to remark because remark doesn't natively
 *     understand directive syntax + we want to control rendering.
 *  2. Each markdown segment runs through `remark-parse` to mdast,
 *     then we walk the AST emitting React. Callouts get rendered
 *     via the <Callout> component (which itself recursively renders
 *     its inner markdown).
 *
 * Subset rendered (covers what the audit prompt instructs the LLM to
 * emit; out-of-spec markdown falls through as plain paragraph text):
 *   headings 1-4, paragraphs, lists (with task-list checkbox in `- [x]`
 *   form), strong/em/code, links (inert for `nav://` / `action://` /
 *   `ref://` schemes — chat-bridge not yet wired), horizontal rules,
 *   fenced code blocks.
 *
 * Skipped: images, blockquotes, tables, HTML blocks (the banner HTML
 * comment at top is the one HTML form we expect; it's stripped by
 * `stripBannerComment` before any rendering).
 */

interface Props {
  markdown: string
}

export default function AuditReportRenderer({ markdown }: Props) {
  const segments = splitIntoSegments(stripBannerComment(markdown))
  return (
    <div className="prose-audit space-y-2 text-gray-800 leading-relaxed">
      {segments.map((seg, i) =>
        seg.kind === 'callout' ? (
          <Callout key={i} severity={seg.severity} title={seg.title}>
            <RenderMarkdown source={seg.body} />
          </Callout>
        ) : (
          <RenderMarkdown key={i} source={seg.body} />
        ),
      )}
    </div>
  )
}

// ── Pre-processing ──

/**
 * Strip the AI-generated banner HTML comment the backend prepends to
 * every persisted report. The banner is metadata for downstream agent
 * readers (anti-injection signal), not for the teacher's UI.
 *
 * Only strips a leading comment — if a comment appears later in the
 * document (unlikely; LLM doesn't emit HTML) it's left alone.
 */
// ── Markdown segment rendering ──

const MARKDOWN_PROCESSOR = unified().use(remarkParse)

function RenderMarkdown({ source }: { source: string }) {
  if (!source.trim()) return null
  const tree = MARKDOWN_PROCESSOR.parse(source) as MdRoot
  return <>{tree.children.map((node, i) => renderBlock(node, i))}</>
}

function renderBlock(node: RootContent, key: number): ReactNode {
  switch (node.type) {
    case 'heading':
      return renderHeading(node as MdHeading, key)
    case 'paragraph':
      return (
        <p key={key} className="my-2">
          {(node as MdParagraph).children.map(renderInline)}
        </p>
      )
    case 'list':
      return renderList(node as MdList, key)
    case 'thematicBreak':
      return <hr key={key} className="my-4 border-gray-200" />
    case 'code':
      return (
        <pre
          key={key}
          className="bg-gray-100 text-gray-800 text-xs font-mono p-3 rounded-md my-3 overflow-x-auto"
        >
          {(node as MdCode).value}
        </pre>
      )
    case 'html':
      // Stray HTML mid-document — the banner comment is already
      // stripped, so anything reaching here is unexpected. Show the
      // raw text rather than execute it.
      return (
        <span key={key} className="text-xs text-gray-400">
          {(node as MdHtml).value}
        </span>
      )
    case 'blockquote':
      // Audit prompt doesn't ask for blockquotes, but the LLM might
      // emit one when quoting evidence. Render as a tinted side-bar
      // so the semantics aren't lost.
      return (
        <blockquote
          key={key}
          className="border-l-2 border-gray-300 pl-3 my-3 text-gray-600 italic"
        >
          {(node as MdBlockquote).children.map((c, i) => renderBlock(c as RootContent, i))}
        </blockquote>
      )
    case 'image':
      // Audit shouldn't include images, but defend against silent
      // content drop: surface alt text as muted "[图片: alt]".
      return (
        <span key={key} className="text-xs text-gray-400">
          [图片: {(node as MdImage).alt || (node as MdImage).url}]
        </span>
      )
    default:
      // Unsupported block type — render any phrasing children as a
      // paragraph fallback so content isn't silently dropped.
      if ('children' in node && Array.isArray((node as any).children)) {
        return (
          <p key={key} className="my-2 text-gray-700">
            {((node as any).children as PhrasingContent[]).map(renderInline)}
          </p>
        )
      }
      return null
  }
}

function renderHeading(node: MdHeading, key: number): ReactNode {
  // Heading sizes follow the prompt's 4-chapter structure:
  // # 概述, ## 一、..., ### subsections, #### detail.
  const baseClass = 'font-semibold text-gray-900 leading-tight'
  const inner = node.children.map(renderInline)
  switch (node.depth) {
    case 1:
      return (
        <h1 key={key} className={`${baseClass} text-2xl mt-2 mb-3`}>
          {inner}
        </h1>
      )
    case 2:
      return (
        <h2 key={key} className={`${baseClass} text-xl mt-6 mb-2`}>
          {inner}
        </h2>
      )
    case 3:
      return (
        <h3 key={key} className={`${baseClass} text-base mt-4 mb-1.5`}>
          {inner}
        </h3>
      )
    default:
      return (
        <h4 key={key} className={`${baseClass} text-sm mt-3 mb-1`}>
          {inner}
        </h4>
      )
  }
}

function renderList(node: MdList, key: number): ReactNode {
  const Tag = node.ordered ? 'ol' : 'ul'
  const listClass = node.ordered
    ? 'list-decimal pl-5 my-2 space-y-1'
    : 'list-disc pl-5 my-2 space-y-1'
  return (
    <Tag key={key} className={listClass}>
      {node.children.map((item, i) => renderListItem(item as MdListItem, i))}
    </Tag>
  )
}

function renderListItem(node: MdListItem, key: number): ReactNode {
  // Task-list items: mdast sets `checked` to a boolean for `- [x]` /
  // `- [ ]` syntax. Render as a disabled checkbox + inline content
  // so the "配置健康度" chapter's check-list reads well.
  const hasCheckbox = typeof node.checked === 'boolean'
  return (
    <li key={key} className={hasCheckbox ? 'flex items-start gap-2' : ''}>
      {hasCheckbox && (
        <input
          type="checkbox"
          checked={node.checked === true}
          readOnly
          disabled
          className="mt-1 accent-gray-500"
          aria-label={node.checked ? 'checked' : 'unchecked'}
        />
      )}
      <div className="flex-1 min-w-0">
        {node.children.map((child, i) => renderBlock(child, i))}
      </div>
    </li>
  )
}

function renderInline(node: PhrasingContent, key: number): ReactNode {
  switch (node.type) {
    case 'text':
      return <span key={key}>{(node as MdText).value}</span>
    case 'strong':
      return (
        <strong key={key} className="font-semibold text-gray-900">
          {(node as MdStrong).children.map(renderInline)}
        </strong>
      )
    case 'emphasis':
      return (
        <em key={key} className="italic">
          {(node as MdEmphasis).children.map(renderInline)}
        </em>
      )
    case 'inlineCode':
      return (
        <code
          key={key}
          className="bg-gray-100 text-gray-800 text-xs font-mono px-1 py-0.5 rounded"
        >
          {(node as MdInlineCode).value}
        </code>
      )
    case 'link':
      return renderLink(node as MdLink, key)
    case 'break':
      return <br key={key} />
    default:
      return null
  }
}

/**
 * Links with custom protocols (nav://, action://, ref://) come from
 * the audit prompt — they're meant to drive chat-bridge actions or
 * deep-links to plan/execution tabs. The v7-rich framework needed for
 * that wiring isn't here yet, so for MVP they render as inert tinted
 * spans: visible to the teacher (so they understand what the LLM was
 * pointing to) but not clickable.
 *
 * Regular http(s) links render normally with target=_blank so the
 * teacher can follow external references from the LLM.
 */
const INERT_SCHEMES = ['nav://', 'action://', 'ref://', 'req://']

function renderLink(node: MdLink, key: number): ReactNode {
  const url = node.url
  const inner = node.children.map(renderInline)
  const isInert = INERT_SCHEMES.some((s) => url.startsWith(s))
  if (isInert) {
    // Show as muted inline text so the teacher sees the LLM's intent
    // ("[模块引用] step-1") without the rendered URL being clickable.
    return (
      <span
        key={key}
        className="text-gray-500 underline decoration-dotted decoration-gray-400"
        title={url}
      >
        {inner}
      </span>
    )
  }
  return (
    <a
      key={key}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline"
    >
      {inner}
    </a>
  )
}
