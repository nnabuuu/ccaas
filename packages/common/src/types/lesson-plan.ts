/**
 * @ccaas/common - LessonPlan Types
 *
 * Type definitions for the Lesson Plan Designer solution.
 *
 * @packageDocumentation
 */

/**
 * Generate a simple UUID v4
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// Basic Types
// ============================================================================

/**
 * Status of a lesson plan in the workflow
 */
export type LessonPlanStatus = 'draft' | 'review' | 'published';

/**
 * Bloom's Taxonomy cognitive levels
 */
export type BloomLevel =
  | 'remember'
  | 'understand'
  | 'apply'
  | 'analyze'
  | 'evaluate'
  | 'create';

// ============================================================================
// Learning Objective Types
// ============================================================================

/**
 * A learning objective for the lesson
 */
export interface LearningObjective {
  id: string;
  description: string;
  bloomLevel: BloomLevel;
  assessmentCriteria?: string;
}

// ============================================================================
// Standard Types
// ============================================================================

/**
 * A curriculum standard alignment
 */
export interface Standard {
  id: string;
  code: string;
  description: string;
  source: string;
}

// ============================================================================
// Material Types
// ============================================================================

/**
 * Type of teaching material
 */
export type MaterialType = 'handout' | 'digital' | 'manipulative' | 'video' | 'other';

/**
 * A teaching material or resource
 */
export interface Material {
  id: string;
  name: string;
  type: MaterialType;
  quantity?: number;
  url?: string;
  notes?: string;
}

// ============================================================================
// Activity Types
// ============================================================================

/**
 * Type of instructional activity
 */
export type ActivityType =
  | 'introduction'
  | 'direct-instruction'
  | 'guided-practice'
  | 'independent-practice'
  | 'group'
  | 'assessment'
  | 'closure';

/**
 * An instructional activity in the lesson
 */
export interface Activity {
  id: string;
  title: string;
  description: string;
  duration: number; // in minutes
  type: ActivityType;
  instructions: string[];
  materials?: string[]; // Material IDs
  teacherNotes?: string;
}

// ============================================================================
// Assessment Types
// ============================================================================

/**
 * Assessment strategies for the lesson
 */
export interface Assessment {
  formative: string[];
  summative: string[];
  rubric?: string;
  selfAssessment?: string;
}

// ============================================================================
// Differentiation Types
// ============================================================================

/**
 * Differentiated instruction strategies
 */
export interface Differentiation {
  struggling: string[];
  onLevel: string[];
  advanced: string[];
  accommodations?: string[];
  modifications?: string[];
}

// ============================================================================
// LessonPlan Type
// ============================================================================

/**
 * A complete lesson plan
 */
export interface LessonPlan {
  id: string;
  tenantId: string;
  title: string;
  subject: string;
  gradeLevel: string;
  duration: string;

  objectives: LearningObjective[];
  standards: Standard[];
  materials: Material[];
  activities: Activity[];
  assessment: Assessment;
  differentiation: Differentiation;

  status: LessonPlanStatus;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates an empty lesson plan with default values
 */
export function createEmptyLessonPlan(
  tenantId: string,
  overrides?: Partial<LessonPlan>
): LessonPlan {
  const now = new Date().toISOString();

  return {
    id: generateId(),
    tenantId,
    title: '',
    subject: '',
    gradeLevel: '',
    duration: '',
    objectives: [],
    standards: [],
    materials: [],
    activities: [],
    assessment: {
      formative: [],
      summative: [],
    },
    differentiation: {
      struggling: [],
      onLevel: [],
      advanced: [],
    },
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Checks if a lesson plan has all required fields completed
 */
export function isLessonPlanComplete(plan: LessonPlan): boolean {
  // Basic info required
  if (!plan.title || !plan.subject || !plan.gradeLevel || !plan.duration) {
    return false;
  }

  // At least one objective required
  if (plan.objectives.length === 0) {
    return false;
  }

  // At least one activity required
  if (plan.activities.length === 0) {
    return false;
  }

  // Assessment needs at least one formative assessment
  if (plan.assessment.formative.length === 0) {
    return false;
  }

  // Differentiation needs all three levels
  if (
    plan.differentiation.struggling.length === 0 ||
    plan.differentiation.onLevel.length === 0 ||
    plan.differentiation.advanced.length === 0
  ) {
    return false;
  }

  return true;
}

// ============================================================================
// Field Keys for output_update protocol
// ============================================================================

/**
 * Field keys that can be synced via output_update
 */
export const LESSON_PLAN_SYNC_FIELDS = [
  'title',
  'subject',
  'gradeLevel',
  'duration',
  'objectives',
  'standards',
  'materials',
  'activities',
  'assessment',
  'differentiation',
] as const;

export type LessonPlanSyncField = (typeof LESSON_PLAN_SYNC_FIELDS)[number];
