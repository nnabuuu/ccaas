/**
 * Cross-module event names + payload types for tenant.config mutations.
 *
 * `SOLUTION_CONFIG_CHANGED` is emitted by `SolutionsService.update()` whenever
 * an update payload carried a `config` field (no fire for name/plan/etc).
 * The `ProjectArtifactSourceRegistry` subscribes to invalidate its cached
 * `slug → ProjectArtifactSource` entry — so a `PUT /solutions/:id` that
 * changes `config.artifactUrl` takes effect on the next sync turn without
 * a backend restart.
 *
 * Both publisher and subscriber import from this file so a typo in the
 * event name can't desync them.
 */

export const SOLUTION_CONFIG_CHANGED = 'tenant.config.changed';

export interface SolutionConfigChangedEvent {
  solutionId: string;
  slug: string;
}
