import { createContext, useContext, type ReactNode } from 'react'
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
import { useChatBridge } from '../../contexts/ChatBridgeContext'
import type { AuditSeverity } from '../../api/audit'
import type { WorkspaceTabKey } from '../../lib/dynamic-tabs'

/**
 * CalloutContext: carries the enclosing callout's metadata down into
 * the markdown rendering of its body. The `action://fix` link uses
 * this to build a prefilled chat message ("please fix <title>: <body>")
 * without rebuilding the prompt-side contract.
 *
 * Internal to this file — not for cross-module consumption.
 */
interface CalloutFrame {
  severity: AuditSeverity
  title?: string
  body: string
}
const CalloutContext = createContext<CalloutFrame | null>(null)

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
            <CalloutContext.Provider
              value={{
                severity: seg.severity,
                title: seg.title,
                body: seg.body,
              }}
            >
              <RenderMarkdown source={seg.body} />
            </CalloutContext.Provider>
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
      return <LinkNode key={key} node={node as MdLink} />
    case 'break':
      return <br key={key} />
    default:
      return null
  }
}

/**
 * Custom-scheme link rendering. The audit prompt instructs the LLM to
 * emit:
 *   - `action://fix?...` — "ask AI to fix this finding"
 *   - `nav://<tab>/<anchor>` — "jump to a specific location"
 *   - `ref://<id>` — informational reference (no action)
 *
 * When ChatBridgeContext is provided (production render under
 * ProjectEditorPage), action:// + nav:// links become real buttons:
 * action:// fills + sends a prefilled message into AiPanel (using the
 * enclosing CalloutContext for context); nav:// switches workspace
 * tabs. When no bridge is provided (isolated tests, etc.), all
 * custom schemes fall back to inert muted text — the prior MVP
 * behavior. Regular http(s) links always open in a new tab.
 *
 * ref:// stays inert in all cases — it's informational, no action
 * semantics defined yet.
 */
const HTTP_SCHEMES = /^https?:\/\//

// Map a nav://<target>/<anchor> URL to a workspace key. Returns null
// when the target isn't a known workspace.
function parseNavWorkspace(url: string): {
  key: WorkspaceTabKey
  anchor?: string
} | null {
  // Accept e.g. nav://execution/step-1, nav://plan/r-1.2.3,
  // nav://skills, nav://execution.
  const m = url.match(/^nav:\/\/([^/?#]+)(?:\/([^?#]*))?/)
  if (!m) return null
  const target = m[1]
  if (target === 'plan' || target === 'execution' || target === 'skills') {
    return { key: target, anchor: m[2] || undefined }
  }
  return null
}

/**
 * Trust boundary note: `callout.body` originates from the LLM (audit
 * report content), then flows through this template into a chat-send
 * to a *second* LLM call. That's a second-order prompt injection
 * surface — a malicious upstream skill writing into `audit/*.md`
 * would steer the next chat turn. Mitigations:
 *   1. The banner HTML comment is stripped pre-parse (audit-markdown.ts)
 *      so the "AI-generated, untrusted" prefix can't be smuggled out.
 *   2. Body is truncated to 800 chars so worst-case blast is bounded.
 *   3. The first line `请帮我修复...` anchors the system prompt's
 *      expectation that this is a fix request, not raw user content.
 * Future hardening: wrap `callout.body` in a fenced quote block
 * before injecting so the downstream LLM has a clear delimiter.
 */
function buildFixMessage(
  url: string,
  linkLabel: string,
  callout: CalloutFrame | null,
): string {
  // Best-effort templating: include the callout's title + body if
  // available so the chat agent has the same context the teacher
  // just clicked on, not just "fix step-1".
  const target = url.replace(/^action:\/\/fix\??/, '')
  const lines: string[] = []
  lines.push(`请帮我修复审计发现的问题 (${linkLabel})。`)
  if (callout?.title) {
    lines.push('')
    lines.push(`**${callout.title}** (severity: ${callout.severity})`)
  }
  if (callout?.body) {
    lines.push('')
    // Truncate body to a sane prompt size — the LLM has the file
    // anyway, no need to repeat huge sections inline.
    const body = callout.body.replace(/\n+/g, '\n').slice(0, 800)
    lines.push(body)
  }
  if (target) {
    lines.push('')
    lines.push(`参数: \`${target}\``)
  }
  return lines.join('\n').trim()
}

function LinkNode({ node }: { node: MdLink }): ReactNode {
  const url = node.url
  const inner = node.children.map(renderInline)
  const linkLabel = extractText(node.children)
  const bridge = useChatBridge()
  const callout = useContext(CalloutContext)

  // Plain http(s) — open in a new tab, no chat-bridge interaction.
  if (HTTP_SCHEMES.test(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline"
      >
        {inner}
      </a>
    )
  }

  // action:// fix — when bridge available, send prefilled message.
  if (url.startsWith('action://fix') && bridge) {
    return (
      <button
        type="button"
        onClick={() => bridge.sendMessage(buildFixMessage(url, linkLabel, callout))}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded mr-1"
        title={url}
      >
        ✦ {inner}
      </button>
    )
  }

  // nav:// — workspace switch when bridge + known target.
  if (url.startsWith('nav://') && bridge) {
    const parsed = parseNavWorkspace(url)
    if (parsed) {
      return (
        <button
          type="button"
          onClick={() => bridge.switchToWorkspace(parsed.key, parsed.anchor)}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded mr-1"
          title={url}
        >
          → {inner}
        </button>
      )
    }
  }

  // ref:// or unknown custom scheme / no bridge — inert muted text.
  // (We surface the URL via title= so a curious teacher can hover to
  // see what the LLM was pointing at.)
  return (
    <span
      className="text-gray-500 underline decoration-dotted decoration-gray-400"
      title={url}
    >
      {inner}
    </span>
  )
}

/** Recursively extract the plain text from inline mdast children —
 * used to derive a button label from `[label](action://...)`. */
function extractText(children: PhrasingContent[]): string {
  const parts: string[] = []
  for (const c of children) {
    if (c.type === 'text') parts.push((c as MdText).value)
    else if ('children' in c && Array.isArray((c as any).children)) {
      parts.push(extractText((c as any).children))
    }
  }
  return parts.join('').trim()
}
