/**
 * TypeOrmSnapshotStore — TypeORM-backed adapter for the runtime's
 * `SnapshotStore` port (`@kedge-agentic/agent-runtime/sync`).
 *
 * One row per (sessionId, path) in `session_artifact_snapshot`. The
 * `(sessionId, path)` unique index drives upsert semantics.
 *
 * This adapter lives in backend (not runtime) so the runtime package
 * stays framework-free. The contract is the same interface the
 * runtime defines; tests in agent-runtime use the in-memory impl.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type {
  SnapshotEntry,
  SnapshotStore,
} from '@kedge-agentic/agent-runtime';

import { SessionArtifactSnapshot } from './session-artifact-snapshot.entity';

@Injectable()
export class TypeOrmSnapshotStore implements SnapshotStore {
  constructor(
    @InjectRepository(SessionArtifactSnapshot)
    private readonly repo: Repository<SessionArtifactSnapshot>,
  ) {}

  async list(sessionId: string): Promise<ReadonlyArray<SnapshotEntry>> {
    const rows = await this.repo.find({ where: { sessionId } });
    return rows.map(toEntry);
  }

  async put(entry: SnapshotEntry): Promise<void> {
    // upsert on the (sessionId, path) unique index. Better-sqlite3 + TypeORM
    // requires explicit conflict columns for ON CONFLICT semantics.
    await this.repo.upsert(
      {
        sessionId: entry.sessionId,
        path: entry.path,
        contentHash: entry.contentHash,
        type: entry.type,
      },
      ['sessionId', 'path'],
    );
  }

  async remove(sessionId: string, path: string): Promise<void> {
    await this.repo.delete({ sessionId, path });
  }

  async clear(sessionId: string): Promise<void> {
    await this.repo.delete({ sessionId });
  }
}

function toEntry(row: SessionArtifactSnapshot): SnapshotEntry {
  return {
    sessionId: row.sessionId,
    path: row.path,
    contentHash: row.contentHash,
    type: row.type,
    updatedAt: row.updatedAt.toISOString(),
  };
}
