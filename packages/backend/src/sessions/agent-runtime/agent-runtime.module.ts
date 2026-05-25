/**
 * AgentRuntimeModule — wires the phase-1 sync layer into a backend
 * (core or solution-flavored).
 *
 * Solutions register their `ProjectArtifactSource` impl via
 * `AgentRuntimeModule.forRoot({ artifactSource })`. The module:
 *   - provides the source under the `PROJECT_ARTIFACT_SOURCE` DI token
 *     so the syncer (day 3-4) can inject it without solutions touching
 *     the syncer service directly
 *   - registers the `TypeOrmSnapshotStore` against the `SNAPSHOT_STORE`
 *     token + makes its entity available
 *   - falls back to a no-op source when none is provided, so backends
 *     that don't need sync (e.g., the core ccaas backend without a
 *     bound solution) still boot cleanly — the syncer just no-ops
 *
 * Day 3+ adds the orchestrator (`SessionAssetSyncer`) + REST endpoints
 * to this module. For day 2 we only ship the foundational wiring +
 * snapshot store.
 *
 * Why not put the AgentRuntimeModule inside the runtime package?
 * The runtime package is framework-free by design (no NestJS, no
 * TypeORM). Backends bring the NestJS module shape. The runtime
 * supplies the pure types/interfaces; backends supply the wiring.
 */

import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import type { ProjectArtifactSource } from '@kedge-agentic/agent-runtime';
import { InMemoryChangeStream } from '@kedge-agentic/agent-runtime';

import { SessionArtifactSnapshot } from './session-artifact-snapshot.entity';
import { TypeOrmSnapshotStore } from './typeorm-snapshot-store';

/** DI token for `@Inject(PROJECT_ARTIFACT_SOURCE)` on the syncer. */
export const PROJECT_ARTIFACT_SOURCE = 'PROJECT_ARTIFACT_SOURCE';
/** DI token for the runtime's `SnapshotStore` port. */
export const SNAPSHOT_STORE = 'SNAPSHOT_STORE';
/** DI token for the runtime's `ChangeStream` port. */
export const CHANGE_STREAM = 'CHANGE_STREAM';

export interface AgentRuntimeModuleOptions {
  /**
   * Solution's impl of `ProjectArtifactSource`. Provide a NestJS
   * `Type<ProjectArtifactSource>` and the module will resolve it via
   * DI (so the impl can inject its own repositories).
   *
   * If omitted, a no-op source is used and the syncer becomes inert
   * for any session bound to a projectId. Useful when the backend
   * boots without a solution attached.
   */
  artifactSource?: Type<ProjectArtifactSource>;
}

/** Used when the host backend doesn't provide an artifact source. */
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
    const sourceProvider: Provider = options.artifactSource
      ? {
          provide: PROJECT_ARTIFACT_SOURCE,
          useExisting: options.artifactSource,
        }
      : {
          provide: PROJECT_ARTIFACT_SOURCE,
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
      global: true,
      imports: [TypeOrmModule.forFeature([SessionArtifactSnapshot])],
      providers: [
        TypeOrmSnapshotStore,
        snapshotStoreProvider,
        changeStreamProvider,
        ...(options.artifactSource ? [options.artifactSource] : [NoopArtifactSource]),
        sourceProvider,
      ],
      exports: [PROJECT_ARTIFACT_SOURCE, SNAPSHOT_STORE, CHANGE_STREAM, TypeOrmSnapshotStore],
    };
  }
}

