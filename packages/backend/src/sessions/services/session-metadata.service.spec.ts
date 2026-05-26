/**
 * SessionMetadataService unit tests.
 *
 * Covers: CRUD happy path, key/value validation, per-row + per-session
 * size caps, tenant ownership, 404 on missing key.
 */

import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';

import { SessionMetadataService } from './session-metadata.service';
import { SessionService } from '../session.service';
import { SessionMetadata } from '../entities/session-metadata.entity';

const TENANT = 'tenant-1';
const SESSION_ID = 's-1';

class FakeRepo {
  rows: SessionMetadata[] = [];

  async find({ where }: { where: Partial<SessionMetadata> }) {
    return this.rows.filter((r) =>
      Object.entries(where).every(([k, v]) => (r as any)[k] === v),
    );
  }
  async findOne({ where }: { where: Partial<SessionMetadata> }) {
    return (await this.find({ where }))[0] ?? null;
  }
  create(data: Partial<SessionMetadata>): SessionMetadata {
    return { ...data, id: 'uuid-' + this.rows.length, createdAt: new Date(), updatedAt: new Date() } as SessionMetadata;
  }
  async save(row: SessionMetadata): Promise<SessionMetadata> {
    row.updatedAt = new Date();
    const existing = this.rows.find((r) => r.id === row.id);
    if (existing) Object.assign(existing, row);
    else this.rows.push(row);
    return row;
  }
  async delete({ sessionId, key }: { sessionId: string; key: string }) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.sessionId === sessionId && r.key === key));
    return { affected: before - this.rows.length };
  }
}

async function build(opts: { solutionId?: string; missing?: boolean } = {}) {
  const session = opts.missing ? undefined : { sessionId: SESSION_ID, solutionId: opts.solutionId ?? TENANT };
  const repo = new FakeRepo();
  const module = await Test.createTestingModule({
    providers: [
      SessionMetadataService,
      { provide: SessionService, useValue: { getSession: jest.fn().mockReturnValue(session) } },
      { provide: getRepositoryToken(SessionMetadata), useValue: repo },
    ],
  }).compile();
  return { svc: module.get(SessionMetadataService), repo };
}

describe('SessionMetadataService', () => {
  describe('put / get / list / delete happy path', () => {
    it('put + get round-trip preserves JSON types (string)', async () => {
      const { svc } = await build();
      await svc.put(SESSION_ID, TENANT, 'name', 'alice');
      expect((await svc.get(SESSION_ID, TENANT, 'name')).value).toBe('alice');
    });

    it('put + get round-trip preserves JSON types (object)', async () => {
      const { svc } = await build();
      await svc.put(SESSION_ID, TENANT, 'step', { current: 3, total: 10 });
      expect((await svc.get(SESSION_ID, TENANT, 'step')).value).toEqual({ current: 3, total: 10 });
    });

    it('put overwrites existing key (no duplicate row)', async () => {
      const { svc, repo } = await build();
      await svc.put(SESSION_ID, TENANT, 'k', 1);
      await svc.put(SESSION_ID, TENANT, 'k', 2);
      expect(repo.rows.filter((r) => r.key === 'k')).toHaveLength(1);
      expect((await svc.get(SESSION_ID, TENANT, 'k')).value).toBe(2);
    });

    it('list returns all rows for the session', async () => {
      const { svc } = await build();
      await svc.put(SESSION_ID, TENANT, 'a', 1);
      await svc.put(SESSION_ID, TENANT, 'b', 'two');
      const rows = await svc.list(SESSION_ID, TENANT);
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.key).sort()).toEqual(['a', 'b']);
    });

    it('delete removes the row; subsequent get → 404', async () => {
      const { svc } = await build();
      await svc.put(SESSION_ID, TENANT, 'gone', 1);
      await svc.delete(SESSION_ID, TENANT, 'gone');
      await expect(svc.get(SESSION_ID, TENANT, 'gone')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('delete on missing key → 404', async () => {
      const { svc } = await build();
      await expect(svc.delete(SESSION_ID, TENANT, 'never')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('validation', () => {
    it('400 on key with spaces', async () => {
      const { svc } = await build();
      await expect(svc.put(SESSION_ID, TENANT, 'bad key', 1)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('400 on key with path traversal', async () => {
      const { svc } = await build();
      await expect(svc.put(SESSION_ID, TENANT, '../etc', 1)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('400 on empty key', async () => {
      const { svc } = await build();
      await expect(svc.get(SESSION_ID, TENANT, '')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('413 on value over 64 KB', async () => {
      const { svc } = await build();
      const big = 'x'.repeat(64 * 1024 + 100);
      await expect(svc.put(SESSION_ID, TENANT, 'k', big)).rejects.toBeInstanceOf(PayloadTooLargeException);
    });

    it('413 when total exceeds 256 KB across keys', async () => {
      const { svc } = await build();
      // 4 keys × 60 KB = 240 KB (under cap); 5th 60 KB key pushes over 256 KB
      const sixty = 'y'.repeat(60 * 1024);
      for (const k of ['k1', 'k2', 'k3', 'k4']) {
        await svc.put(SESSION_ID, TENANT, k, sixty);
      }
      await expect(svc.put(SESSION_ID, TENANT, 'k5', sixty)).rejects.toBeInstanceOf(PayloadTooLargeException);
    });

    it('shrinking an existing key does not falsely trip total cap', async () => {
      const { svc } = await build();
      const sixty = 'y'.repeat(60 * 1024);
      // fill near cap
      for (const k of ['k1', 'k2', 'k3', 'k4']) {
        await svc.put(SESSION_ID, TENANT, k, sixty);
      }
      // shrink k1 to 1B — should succeed (overwrite, total goes DOWN)
      await expect(svc.put(SESSION_ID, TENANT, 'k1', 'x')).resolves.toBeDefined();
    });
  });

  describe('ownership / lookup', () => {
    it('404 when session not in memory', async () => {
      const { svc } = await build({ missing: true });
      await expect(svc.list(SESSION_ID, TENANT)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('403 when tenant mismatch', async () => {
      const { svc } = await build({ solutionId: 'tenant-other' });
      await expect(svc.list(SESSION_ID, TENANT)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(svc.put(SESSION_ID, TENANT, 'k', 1)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(svc.delete(SESSION_ID, TENANT, 'k')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
