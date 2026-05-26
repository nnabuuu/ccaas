export const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3007';
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5283';
export const LESSON_ID = 'ideal-beauty-reading';

/** Known correct quiz answers for step 1 (indices into options arrays) */
export const QUIZ_CORRECT_ANSWERS = [1, 2, 1];

// ── ccaas + creator-v7 wiring ──────────────────────────────────────────
// Agent-runtime sync layer lives on the ccaas backend (NOT live-lesson).
// Creator-v7 surfaces it via the /creator UI on a separate port.
// See solutions/business/live-lesson/docs/creator-v7-architecture.md for
// the wire diagram.

export const CCAAS_URL = process.env.CCAAS_URL || 'http://localhost:3001';
export const CREATOR_URL = process.env.CREATOR_URL || 'http://localhost:5284';

/** Tenant slug for the live-lesson-creator solution (auto-imported from SOLUTIONS_DIR). */
export const CREATOR_TENANT_SLUG = process.env.CREATOR_TENANT_SLUG || 'live-lesson-creator';

/** Session template the agent uses for editing manifests. */
export const CREATOR_TEMPLATE = process.env.CREATOR_TEMPLATE || 'edit-lesson';
