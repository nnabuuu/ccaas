/**
 * Types for the teaching-requirements subsystem.
 *
 * Two layers — see `docs/lesson-plan-format-design.md` §1-2 + §5:
 *   - **L1 Library**: shipped JSON, immutable per version, cross-user.
 *   - **L2 Interpretation**: per-user overlay (stored in DB), never
 *     embedded into the lesson plan markdown.
 *
 * `ReqItem` is the L1 unit. `ReqItemWithCategory` is the same item
 * augmented with category metadata so the editor can render a
 * `category · code` chip without a second lookup.
 *
 * `ReqItemWithInterpretation` adds the L2 overlay (`myInterpretation`)
 * if the requesting user has one. Cross-user leakage is prevented at
 * the controller layer (userId comes from auth context, never from
 * query/body).
 */

export interface ReqItem {
  id: string;
  code: string;
  text: string;
}

export interface ReqCategory {
  id: string;
  label: string;
  color: string;
  items: ReqItem[];
}

export interface TeachingRequirementsLibrary {
  subject: string;
  subjectLabel: string;
  version: string;
  categories: ReqCategory[];
}

export interface ReqItemWithCategory extends ReqItem {
  subject: string;
  categoryId: string;
  categoryLabel: string;
  categoryColor: string;
}

export interface InterpretationOverlay {
  notes: string;
  updatedAt: string;
}

export interface ReqItemWithInterpretation extends ReqItemWithCategory {
  myInterpretation: InterpretationOverlay | null;
}
