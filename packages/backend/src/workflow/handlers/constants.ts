/**
 * Shared constants for the live-lesson workflow handler family.
 *
 * Lives at `handlers/constants.ts` rather than re-exported from the
 * lifecycle service so sibling handlers don't cross-import each other
 * for tenant/namespace strings (pass-1 review S6 + S7).
 *
 * Namespaces are intentionally distinct across services because
 * `SolutionToolkitRegistry.registerToolkit` is idempotent-per-namespace
 * and would otherwise overwrite a sibling's tools at boot. The dev-time
 * bug that motivated this split is captured in the M3 commit log.
 */

export const LIVE_LESSON_TENANT_SLUG = 'live-lesson';

export const WORKFLOW_LIFECYCLE_NAMESPACE = 'workflow-actions';
export const WORKFLOW_EXERCISE_NAMESPACE = 'workflow-actions-exercise';
export const WORKFLOW_PROGRESS_NAMESPACE = 'workflow-actions-progress';
