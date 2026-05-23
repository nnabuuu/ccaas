/**
 * @kedge-agentic/exercise-preview
 *
 * Preview platform for exercise type plugins. Provides:
 *   - defineStories() — declare preview scenarios for a plugin
 *   - StoryLoader — extract stories from module exports
 *   - createPreviewServer() — lightweight HTTP server (in-memory state, no DB)
 *   - startDevServer() — CLI dev server with story autodiscovery
 *   - createPreviewBackendProviders() — NestJS provider definitions
 *   - PreviewBackendService — class form for use in custom NestJS controllers
 *
 * See: solutions/business/live-lesson/docs/exercise-plugin-preview-design.md
 */
export * from './core';
export * from './backend';
export * from './nestjs';
export { startDevServer } from './cli/dev-server';
export { loadBundlesFromDir } from './cli/load-bundles';
