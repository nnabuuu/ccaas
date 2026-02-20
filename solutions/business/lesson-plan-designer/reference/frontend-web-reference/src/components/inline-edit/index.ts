/**
 * Inline Edit Components
 *
 * A collection of click-to-edit components that follow the Tier 1 editing pattern:
 * - Click to enter edit mode
 * - Auto-save on blur
 * - Optimistic UI with rollback on error
 *
 * @see /docs/ux-design/INLINE_EDIT_UX_PATTERN.md for design documentation
 * @see /frontend-web-refactor/FRONTEND_DOCUMENTATION.md Section 6 for implementation guide
 */

export { default as InlineEditText } from './InlineEditText.vue'
export { default as InlineEditDate } from './InlineEditDate.vue'
export { default as InlineEditTimeRange } from './InlineEditTimeRange.vue'
export { default as InlineEditNumber } from './InlineEditNumber.vue'
export { default as InlineEditSelect } from './InlineEditSelect.vue'
