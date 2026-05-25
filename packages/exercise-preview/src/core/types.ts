/**
 * Core types for the Exercise Preview system.
 *
 * Stories use a Storybook CSF (Component Story Format) inspired API:
 *   default export = defineStories({ plugin, meta })
 *   named exports  = individual scenarios (Story objects)
 *
 * See: docs/exercise-plugin-preview-design.md §3
 */

/** Bundle/plugin metadata shown in the preview UI */
export interface StoryMeta {
  /** Display title, e.g. "Long Division" */
  title: string;
  /** Free-form description */
  description?: string;
  /** Tags for filtering/categorization, e.g. ['math', 'grade-8'] */
  tags?: string[];
  /** External docs link */
  docsUrl?: string;
  /** Plugin/bundle version compatibility */
  bundleVersion?: string;
}

/**
 * Mock submission used in teacher-view stories.
 * Renders as a row in the class-wide submission table.
 */
export interface MockSubmission {
  studentId: string;
  name: string;
  data: Record<string, unknown>;
  score?: number;
  submittedAt?: number;
}

/** One preview scenario */
export interface Story {
  /** Display name in the story tree */
  name: string;
  /** Full answer key (server-side, with answers) */
  answerKey: Record<string, unknown>;
  /** Student's initial answer state (optional) */
  initialAns?: Record<string, unknown>;
  /** Review data for restoring completed-step state — see useReviewRestore */
  reviewData?: {
    data: Record<string, unknown>;
    checkItems?: Array<Record<string, unknown>>;
  };
  /** Starting phase — default 'idle' */
  initialPhase?: 'idle' | 'submitting' | 'review';
  /** Starting role view — default 'student' */
  initialRole?: 'student' | 'teacher';
  /** Class-wide submissions for teacher-view stories */
  classSubmissions?: MockSubmission[];
  /**
   * Pre-baked observe data fed straight to the plugin's ObserveClassView.
   * Use when generating one from `classSubmissions` would just push grading
   * back into bundle code — each class-view has its own narrower shape
   * (McObserveData / MapObserveData / EvidenceObserveData / …).
   */
  classObserveData?: Record<string, unknown>;
  /** Markdown notes shown in the Inspector */
  notes?: string;
  /** Plugin-specific opaque metadata (custom wrapper consumption only) */
  metadata?: Record<string, unknown>;
  /** Hide in public demo build (default false) */
  skipInDemo?: boolean;
  /** Locale identifier for i18n (v2) — e.g. 'zh', 'en' */
  locale?: 'zh' | 'en';
}

/**
 * Minimal plugin shape required by the preview runtime.
 * The actual ExerciseUIPlugin interface lives in the frontend; here we only
 * need enough to identify and render the plugin.
 */
export interface PreviewPluginRef {
  /** Plugin type identifier, must match an @ExerciseType plugin on the backend */
  type: string;
  /** Optional human-readable display name */
  displayName?: string;
}

/**
 * Argument shape for `defineStories()`.
 */
export interface DefineStoriesArgs {
  plugin: PreviewPluginRef;
  meta: StoryMeta;
}

/**
 * Result of `defineStories()` — the default export of a *.stories.ts file.
 * Story authors then attach named exports as individual scenarios.
 */
export interface StoriesFile {
  plugin: PreviewPluginRef;
  meta: StoryMeta;
  __brand: 'kedge-agentic-exercise-preview-stories';
}

/**
 * Returned by StoryLoader.load() — a fully resolved bundle of stories
 * extracted from one or more *.stories.ts files.
 */
export interface LoadedBundle {
  filePath: string;
  plugin: PreviewPluginRef;
  meta: StoryMeta;
  stories: Record<string, Story>;
}
