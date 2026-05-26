/**
 * TipTap node for HTML blocks (e.g. the agent-contract comment at the
 * top of `lesson-plan.md`).
 *
 * Without this, StarterKit has no `htmlBlock` node registered, so
 * TipTap silently strips our html node on first edit — dropping the
 * agent contract comment that's a load-bearing part of the design
 * (see lesson-plan-format-design.md §4.2 layer 1).
 *
 * The node is non-editable: the agent contract isn't user content,
 * so we render it as a read-only badge. Users can delete it (and
 * presumably the scaffold will warn about that), but they can't
 * accidentally edit it character-by-character.
 */

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { FileCode } from 'lucide-react'

export const HtmlBlockNode = Node.create({
  name: 'htmlBlock',

  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      html: { default: '' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-html-block]',
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false
          return { html: el.dataset.htmlBlock ?? '' }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes({ 'data-html-block': HTMLAttributes.html as string }),
      // We don't dump the actual HTML into the DOM here — that could
      // introduce XSS or render comments incorrectly. The attribute
      // carries the data; the NodeView shows a placeholder.
      '',
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer((props: NodeViewProps) => {
      const html = (props.node.attrs.html as string) ?? ''
      // Show the first ~60 chars as a hint — typically this is the
      // agent contract comment header, which starts with "教学要求引用语法:".
      const preview = html.slice(0, 80).replace(/\n/g, ' ').trim()
      return (
        <NodeViewWrapper>
          <div
            className="my-2 px-3 py-2 rounded border border-gray-200 bg-gray-50 text-xs text-gray-500 font-mono select-none"
            contentEditable={false}
            title={html}
          >
            <span className="inline-flex items-center gap-1.5">
              <FileCode size={11} />
              <span className="text-gray-600">HTML 块 (保留, 不可编辑):</span>
              <span className="truncate max-w-[400px]">{preview}…</span>
            </span>
          </div>
        </NodeViewWrapper>
      )
    })
  },
})
