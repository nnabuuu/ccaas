/**
 * Bridge to MentionProvider/MentionPicker from chat-interface source.
 * These components are not yet exported from the package's public API,
 * so we import from source directly.
 */
export { MentionProvider, useMentionContext } from '../../../../../../packages/chat-interface/src/components/chat/MentionContext'
export type { MentionRef } from '../../../../../../packages/chat-interface/src/components/chat/MentionContext'
export { MentionPicker } from '../../../../../../packages/chat-interface/src/components/chat/MentionPicker'
