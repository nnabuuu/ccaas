/**
 * AgentRuntimeModule — wires the agent-runtime sync layer into the backend.
 *
 * Phase 1.6 made `tenant.config.artifactUrl` the single source of truth
 * for the artifact-callback URL (see
 * `docs/gitbook/{zh,en}/reference/agent-runtime.md`). Solutions declare
 * the URL in their `solution.json`; `SolutionLoaderService` (in
 * `solutions/`) writes it through to `tenant.config` at boot via
 * auto-discovery or at runtime via `POST /admin/solutions/import`.
 * Operators can also update directly via `PUT /solutions/:id`.
 *
 * This module therefore no longer parses env vars or constructs
 * per-tenant `RestWorkspaceArtifactSource` instances at init. The
 * `WorkspaceArtifactSourceRegistry` is a plain `@Injectable` class that
 * caches `slug → source` lazily and invalidates via the
 * `tenant.config.changed` event.
 *
 * Tokens still exposed:
 *   - `WORKSPACE_ARTIFACT_SOURCE_REGISTRY` — what `SessionAssetSyncer` injects
 *   - `WORKSPACE_ARTIFACT_SOURCE` — back-compat; bound to a `NoopArtifactSource`
 *     (or the test `options.artifactSource`) for any direct injectors
 *   - `SNAPSHOT_STORE`, `CHANGE_STREAM` — unchanged from phase 1
 *
 * Test injection: pass `options.artifactSource: Type<WorkspaceArtifactSource>`
 * to override the noop default. Useful in unit tests that don't want to
 * stand up a tenant + the DB lookup; production code uses tenant.config.
 *
 * The module is imported exactly once — by `SessionsModule` — to avoid
 * `@Global` recursion with `@Global SolutionsModule`.
 */

import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import type {
  WorkspaceArtifactSource,
  WorkspaceAccessResolver,
} from '@kedge-agentic/agent-runtime';
import { InMemoryChangeStream } from '@kedge-agentic/agent-runtime';

import { SessionArtifactSnapshot } from './session-artifact-snapshot.entity';
import { TypeOrmSnapshotStore } from './typeorm-snapshot-store';
import {
  WORKSPACE_ARTIFACT_SOURCE,
  WORKSPACE_ARTIFACT_SOURCE_REGISTRY,
  WORKSPACE_BINARY_ARTIFACT_SOURCE_REGISTRY,
  WORKSPACE_ACCESS_RESOLVER,
  SNAPSHOT_STORE,
  CHANGE_STREAM,
} from './tokens';

export {
  WORKSPACE_ARTIFACT_SOURCE,
  WORKSPACE_ARTIFACT_SOURCE_REGISTRY,
  WORKSPACE_BINARY_ARTIFACT_SOURCE_REGISTRY,
  WORKSPACE_ACCESS_RESOLVER,
  SNAPSHOT_STORE,
  CHANGE_STREAM,
};

export interface AgentRuntimeModuleOptions {
  /**
   * Test-only override for the single-source token. Production source
   * resolution always flows through `tenant.config.artifactUrl` (read
   * by the registry); this option only affects code that directly
   * injects `WORKSPACE_ARTIFACT_SOURCE`.
   */
  artifactSource?: Type<WorkspaceArtifactSource>;
}

/** Default for the single-source DI token when no test override is given. */
class NoopArtifactSource implements WorkspaceArtifactSource {
  async loadArtifacts(): Promise<ReadonlyArray<never>> {
    return [];
  }
  async saveArtifact(): Promise<void> {
    // intentionally empty — nothing to persist
  }
}

/**
 * Default resolver: deny all (returns false for every call). Solutions
 * opt in by overriding `WORKSPACE_ACCESS_RESOLVER` in their module
 * providers with a concrete impl querying their project table or
 * reusing ccaas's `SessionMetadataWorkspaceResolver`. Phase 2b-2.
 */
class DenyAllWorkspaceAccessResolver implements WorkspaceAccessResolver {
  async verifyWorkspaceAccess(): Promise<boolean> {
    return false;
  }
}

@Module({})
export class AgentRuntimeModule {
  static forRoot(options: AgentRuntimeModuleOptions = {}): DynamicModule {
    const singleSourceProvider: Provider = options.artifactSource
      ? {
          provide: WORKSPACE_ARTIFACT_SOURCE,
          useExisting: options.artifactSource,
        }
      : {
          provide: WORKSPACE_ARTIFACT_SOURCE,
          useClass: NoopArtifactSource,
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
      imports: [TypeOrmModule.forFeature([SessionArtifactSnapshot])],
      providers: [
        TypeOrmSnapshotStore,
        snapshotStoreProvider,
        changeStreamProvider,
        ...(options.artifactSource
          ? [options.artifactSource]
          : [NoopArtifactSource]),
        singleSourceProvider,
        // Default access resolver — denies all. Solutions override
        // `WORKSPACE_ACCESS_RESOLVER` in their own module to enable
        // SSE auth for their workspaces.
        DenyAllWorkspaceAccessResolver,
        {
          provide: WORKSPACE_ACCESS_RESOLVER,
          useExisting: DenyAllWorkspaceAccessResolver,
        },
        // Note: WorkspaceArtifactSourceRegistry is NOT registered here. It
        // depends on SolutionsService, which lives in the @Global SolutionsModule
        // that the consuming module (SessionsModule) imports. Registering it
        // here would require importing SolutionsModule, which pulls in
        // SolutionAuthGuard → UserSolutionService and creates DI grief in test
        // isolation. SessionsModule registers + binds WORKSPACE_ARTIFACT_SOURCE_REGISTRY.
      ],
      exports: [
        WORKSPACE_ARTIFACT_SOURCE,
        WORKSPACE_ACCESS_RESOLVER,
        SNAPSHOT_STORE,
        CHANGE_STREAM,
        TypeOrmSnapshotStore,
      ],
    };
  }
}
