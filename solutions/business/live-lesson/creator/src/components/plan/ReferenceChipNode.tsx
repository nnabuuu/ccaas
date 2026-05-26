/**
 * TipTap node extension for the inline reference chip.
 *
 * The chip is an *inline atom* node — it sits in the middle of text
 * but doesn't have editable content; users edit via the picker /
 * interpretation modal. This matches the markdown semantics (the
 * chip text is canonical, refreshed from L1).
 *
 * NodeView renders our existing `ReferenceChip` component so the
 * editable view matches the read-only view 1:1.
 */

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import ReferenceChip from './ReferenceChip'
import type { ChipResolver } from './PlanRenderer'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    referenceChip: {
      insertReferenceChip: (attrs: {
        refId: string
        text: string
        title: string | null
      }) => ReturnType
    }
  }
}

interface CreateOptions {
  resolveChip: ChipResolver
  onEditInterpretation?: (refId: string) => void
}

export function createReferenceChipExtension({
  resolveChip,
  onEditInterpretation,
}: CreateOptions) {
  return Node.create({
    name: 'referenceChip',

    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    draggable: false,

    addAttributes() {
      return {
        refId: { default: '' },
        text: { default: '' },
        title: { default: null },
        stale: { default: false },
      }
    },

    // Allow the chip to be reconstructed from HTML during paste, but
    // primarily we round-trip via the markdown bridge so this is a
    // defensive parse rule.
    parseHTML() {
      return [
        {
          tag: 'span[data-req-id]',
          getAttrs: (el) => {
            if (!(el instanceof HTMLElement)) return false
            return {
              refId: el.dataset.reqId ?? '',
              text: el.textContent ?? '',
              title: el.getAttribute('data-title'),
              stale: el.dataset.stale === '1',
            }
          },
        },
      ]
    },

    renderHTML({ HTMLAttributes }) {
      // Bare HTML rendering used when the editor serializes (we don't
      // depend on this — markdown is the storage format), but
      // sane HTML for paste / copy.
      return [
        'span',
        mergeAttributes(
          {
            'data-req-id': HTMLAttributes.refId,
            'data-title': HTMLAttributes.title,
            'data-stale': HTMLAttributes.stale ? '1' : '0',
          },
        ),
        HTMLAttributes.text as string,
      ]
    },

    addCommands() {
      return {
        insertReferenceChip:
          (attrs) =>
          ({ commands }) => {
            return commands.insertContent({
              type: 'referenceChip',
              attrs: { ...attrs, stale: false },
            })
          },
      }
    },

    addNodeView() {
      return ReactNodeViewRenderer((props: NodeViewProps) => {
        const attrs = props.node.attrs as {
          refId: string
          text: string
          title: string | null
          stale?: boolean
        }
        const resolution = resolveChip(attrs.refId)
        return (
          <NodeViewWrapper as="span" className="inline">
            <ReferenceChip
              refId={attrs.refId}
              text={attrs.text}
              title={attrs.title}
              categoryColor={resolution.categoryColor}
              stale={attrs.stale}
              interpretation={resolution.interpretation}
              onEditInterpretation={
                onEditInterpretation
                  ? () => onEditInterpretation(attrs.refId)
                  : undefined
              }
            />
          </NodeViewWrapper>
        )
      })
    },
  })
}
