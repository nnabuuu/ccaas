/**
 * @kedge-agentic/exercise-preview
 *
 * Preview platform for exercise type plugins. Provides:
 *   - defineStories() — declare preview scenarios for a plugin
 *   - StoryLoader — extract stories from module exports
 *   - Mini Backend (NestJS) — runs real GradingService against story answerKeys [P1]
 *   - PreviewApp (React) — three-pane UI: story tree / stage / inspector [P2]
 *   - CLI — dev server with hot reload [P1]
 *   - Admin embed — Playground page in admin-next [P3]
 *   - Public demo build — static site for share links [P4]
 *
 * See: solutions/business/live-lesson/docs/exercise-plugin-preview-design.md
 */
export * from './core';
