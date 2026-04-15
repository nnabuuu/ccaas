/**
 * Bridge to MentionProvider/MentionPicker from chat-interface source.
 * These components are not yet exported from the package's public API,
 * so we import from source directly.
 */
export { MentionProvider, useMentionContext } from '../../../../../../packages/chat-interface/src/components/chat/MentionContext'
export type { MentionRef } from '../../../../../../packages/chat-interface/src/components/chat/MentionContext'
export { MentionPicker } from '../../../../../../packages/chat-interface/src/components/chat/MentionPicker'

import { useEffect, type MutableRefObject } from 'react'
import { useMentionContext } from '../../../../../../packages/chat-interface/src/components/chat/MentionContext'

/**
 * MentionTrigger — wires @ keydown on the composer textarea to open the picker,
 * and exposes clearRefs via a ref so the parent can call it on message sent.
 * Must be rendered inside MentionProvider.
 */
export function MentionTrigger({ clearRefsRef }: { clearRefsRef?: MutableRefObject<(() => void) | null> }) {
  const { openPicker, clearRefs } = useMentionContext()

  useEffect(() => {
    if (clearRefsRef) clearRefsRef.current = clearRefs
  }, [clearRefs, clearRefsRef])

  useEffect(() => {
    const textarea = document.querySelector('textarea[aria-label="Message input"]') as HTMLTextAreaElement
    if (!textarea) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === '@') {
        e.preventDefault()
        openPicker()
      }
    }
    textarea.addEventListener('keydown', handler)
    return () => textarea.removeEventListener('keydown', handler)
  }, [openPicker])

  return null
}
