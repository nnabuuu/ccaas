/**
 * AgentRuntimeModule — wires the phase-1 sync layer into a backend.
 *
 * Three DI tokens exposed:
 *   - `PROJECT_ARTIFACT_SOURCE_REGISTRY` — tenant-aware router; the
 *     `SessionAssetSyncer` injects this and resolves per session.
 *   - `PROJECT_ARTIFACT_SOURCE` — single "default" source; back-compat
 *     for direct injectors and for `forRoot({ artifactSource })`. The
 *     registry uses this as its `defaultSource` fallback for tenants
 *     not in the per-tenant map.
 *   - `SNAPSHOT_STORE`, `CHANGE_STREAM` — unchanged from phase 1.
 *
 * Resolution priority (highest → lowest):
 *   1. `options.artifactSource` (explicit Type<ProjectArtifactSource>) →
 *      registered as the registry's defaultSource. Test-friendly.
 *   2. `SOLUTION_ARTIFACT_URLS=slug:url,...` env var → per-tenant
 *      `RestProjectArtifactSource` instances keyed by slug.
 *   3. `SOLUTION_ARTIFACT_URL=url` env var (legacy single) →
 *      registered as the registry's defaultSource.
 *   4. Nothing → NoopArtifactSource as defaultSource (syncer no-ops).
 *
 * `SOLUTION_ARTIFACT_URLS` and `SOLUTION_ARTIFACT_URL` can coexist:
 * the map handles named tenants, the single URL handles everyone else.
 *
 * Why not put this in the runtime package? The runtime is framework-
 * free by design (no NestJS, no TypeORM). Backends bring the NestJS
 * module shape; the runtime supplies pure types/interfaces.
 */

import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import type { ProjectArtifactSource } from '@kedge-agentic/agent-runtime';
import { InMemoryChangeStream } from '@kedge-agentic/agent-runtime';


import { SessionArtifactSnapshot } from './session-artifact-snapshot.entity';
import { TypeOrmSnapshotStore } from './typeorm-snapshot-store';
import { RestProjectArtifactSource } from './rest-project-artifact-source';
import { ProjectArtifactSourceRegistry } from './project-artifact-source-registry';
import {
  PROJECT_ARTIFACT_SOURCE,
  PROJECT_ARTIFACT_SOURCE_REGISTRY,
  SNAPSHOT_STORE,
  CHANGE_STREAM,
} from './tokens';

export {
  PROJECT_ARTIFACT_SOURCE,
  PROJECT_ARTIFACT_SOURCE_REGISTRY,
  SNAPSHOT_STORE,
  CHANGE_STREAM,
};

export interface AgentRuntimeModuleOptions {
  /**
   * Solution's impl of `ProjectArtifactSource`. When provided, takes
   * precedence over both env-var configurations and is registered as
   * the registry's `defaultSource` — applied to all tenants without
   * an explicit per-tenant entry.
   *
   * Typically only used by tests; production deployments configure
   * via env vars.
   */
  artifactSource?: Type<ProjectArtifactSource>;
}

/** Used when neither explicit source nor any env URL is configured. */
class NoopArtifactSource implements ProjectArtifactSource {
  async loadArtifacts(): Promise<ReadonlyArray<never>> {
    return [];
  }
  async saveArtifact(): Promise<void> {
    // intentionally empty — nothing to persist
  }
}

@Module({})
export class AgentRuntimeModule {
  static forRoot(options: AgentRuntimeModuleOptions = {}): DynamicModule {
    // The single-source token still serves direct injectors. When
    // options.artifactSource is provided we point this at it; else
    // we fall back to a NoopArtifactSource so DI never fails to
    // resolve. (The registry wraps a richer fallback chain.)
    const singleSourceProvider: Provider = options.artifactSource
      ? {
          provide: PROJECT_ARTIFACT_SOURCE,
          useExisting: options.artifactSource,
        }
      : {
          provide: PROJECT_ARTIFACT_SOURCE,
          useClass: NoopArtifactSource,
        };

    const registryProvider: Provider = {
      provide: PROJECT_ARTIFACT_SOURCE_REGISTRY,
      useFactory: (
        explicitSource: ProjectArtifactSource,
        cfg: ConfigService,
      ) => buildRegistry(options, explicitSource, cfg),
      inject: [PROJECT_ARTIFACT_SOURCE, ConfigService],
    };

    const changeStreamProvider: Provider = {
      provide: CHANGE_STREAM,
      useFactory: () => new InMemoryChangeStream(),
    };

    const snapshotStoreProvider: Provider = {
      provide: SNAPSHOT_STORE,
      useExisting: TypeOrmSnapshotStore,
    };

    return {
      module: AgentRuntimeModule,
      imports: [
        TypeOrmModule.forFeature([SessionArtifactSnapshot]),
        // Explicit import so the registry factory's inject array
        // (which needs ConfigService) resolves within this module's
        // own provider graph, including under test isolation.
        ConfigModule,
      ],
      providers: [
        TypeOrmSnapshotStore,
        snapshotStoreProvider,
        changeStreamProvider,
        ...(options.artifactSource
          ? [options.artifactSource]
          : [NoopArtifactSource]),
        singleSourceProvider,
        registryProvider,
      ],
      exports: [
        PROJECT_ARTIFACT_SOURCE,
        PROJECT_ARTIFACT_SOURCE_REGISTRY,
        SNAPSHOT_STORE,
        CHANGE_STREAM,
        TypeOrmSnapshotStore,
      ],
    };
  }
}

/**
 * Construct the registry from the resolution priority described in
 * the module-level docstring. `explicitSource` is what got bound to
 * `PROJECT_ARTIFACT_SOURCE` — either the test-provided class or a
 * NoopArtifactSource.
 *
 * The legacy `SOLUTION_ARTIFACT_URL` env var becomes the registry's
 * defaultSource only when no explicit source AND no per-tenant entries
 * exist; otherwise it's ignored (explicit source wins, and a non-empty
 * per-tenant map signals the deployment is opting in to the new shape).
 */
function buildRegistry(
  options: AgentRuntimeModuleOptions,
  explicitSource: ProjectArtifactSource,
  cfg: ConfigService,
): ProjectArtifactSourceRegistry {
  const perTenantUrls = cfg.get<Record<string, string>>(
    'workspace.solutionArtifactUrls',
    {},
  );
  const legacyUrl = cfg.get<string | undefined>(
    'workspace.solutionArtifactUrl',
    undefined,
  );

  const perTenant = new Map<string, ProjectArtifactSource>();
  for (const [slug, url] of Object.entries(perTenantUrls)) {
    perTenant.set(slug, new RestProjectArtifactSource(url));
  }

  let defaultSource: ProjectArtifactSource | null = null;
  if (options.artifactSource) {
    // The DI-resolved instance was passed in as `explicitSource`.
    defaultSource = explicitSource;
  } else if (legacyUrl) {
    defaultSource = new RestProjectArtifactSource(legacyUrl);
  }
  // else: defaultSource stays null — tenants without an explicit
  // entry get no source and the syncer no-ops for them.

  return new ProjectArtifactSourceRegistry(perTenant, defaultSource);
}
