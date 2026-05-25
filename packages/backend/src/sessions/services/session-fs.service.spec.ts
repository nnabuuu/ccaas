/**
 * SessionFsService unit tests.
 *
 * Covers:
 *   - happy path for diff/timeline/snapshot/rollback (delegates to handle)
 *   - 400 when provider's handle lacks the method (local provider)
 *   - 400 on invalid label format for snapshot/rollback
 *   - 404 when session id not in the in-memory map
 *   - 403 when caller's tenantId doesn't match session.tenantId
 */

import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { SessionFsService } from './session-fs.service';
import { SessionService } from '../session.service';
import { WORKSPACE_PROVIDER } from '../workspace/types';

const TENANT = 'tenant-1';

function fakeSession(overrides: Partial<any> = {}) {
  return {
    sessionId: 's-1',
    tenantId: TENANT,
    workspaceHandle: {
      path: '/tmp/x',
      snapshot: jest.fn().mockResolvedValue('/tmp/snap/x.db'),
      rollback: jest.fn().mockResolvedValue(undefined),
      diff: jest.fn().mockResolvedValue([
        { op: 'added', type: 'file', path: '/entities/x.md' },
      ]),
      timeline: jest.fn().mockResolvedValue([
        { id: 1, name: 'write', status: 'success', started_at: 0 },
      ]),
    },
    ...overrides,
  };
}

async function build(session: any) {
  const module = await Test.createTestingModule({
    providers: [
      SessionFsService,
      {
        provide: WORKSPACE_PROVIDER,
        useValue: { capabilities: () => ({ snapshot: true, multiMount: false, fastClone: false, observability: true }) },
      },
      {
        provide: SessionService,
        useValue: { getSession: jest.fn().mockReturnValue(session) },
      },
    ],
  }).compile();
  return module.get(SessionFsService);
}

describe('SessionFsService', () => {
  describe('diff', () => {
    it('delegates to handle.diff and returns the entries', async () => {
      const session = fakeSession();
      const svc = await build(session);
      const out = await svc.diff('s-1', TENANT);
      expect(out).toEqual([{ op: 'added', type: 'file', path: '/entities/x.md' }]);
      expect(session.workspaceHandle.diff).toHaveBeenCalled();
    });

    it('400 when handle has no diff (local provider)', async () => {
      const session = fakeSession({ workspaceHandle: { path: '/tmp/x' } });
      const svc = await build(session);
      await expect(svc.diff('s-1', TENANT)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('timeline', () => {
    it('delegates with opts', async () => {
      const session = fakeSession();
      const svc = await build(session);
      const out = await svc.timeline('s-1', TENANT, { limit: 5, status: 'success' });
      expect(out).toHaveLength(1);
      expect(session.workspaceHandle.timeline).toHaveBeenCalledWith({ limit: 5, status: 'success' });
    });

    it('400 when handle has no timeline', async () => {
      const session = fakeSession({ workspaceHandle: { path: '/tmp/x' } });
      const svc = await build(session);
      await expect(svc.timeline('s-1', TENANT)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('snapshot', () => {
    it('happy path returns { label, takenAt }', async () => {
      const session = fakeSession();
      const svc = await build(session);
      const out = await svc.snapshot('s-1', TENANT, 'before-risky');
      expect(out.label).toBe('before-risky');
      expect(typeof out.takenAt).toBe('string');
      expect(session.workspaceHandle.snapshot).toHaveBeenCalledWith('before-risky');
    });

    it('400 on empty label', async () => {
      const svc = await build(fakeSession());
      await expect(svc.snapshot('s-1', TENANT, '')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('400 on label with disallowed chars', async () => {
      const svc = await build(fakeSession());
      await expect(svc.snapshot('s-1', TENANT, 'has spaces')).rejects.toBeInstanceOf(BadRequestException);
      await expect(svc.snapshot('s-1', TENANT, '../etc')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('400 when handle has no snapshot', async () => {
      const session = fakeSession({ workspaceHandle: { path: '/tmp/x' } });
      const svc = await build(session);
      await expect(svc.snapshot('s-1', TENANT, 'lbl')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('rollback', () => {
    it('happy path returns void; delegates with label', async () => {
      const session = fakeSession();
      const svc = await build(session);
      await expect(svc.rollback('s-1', TENANT, 'lbl')).resolves.toBeUndefined();
      expect(session.workspaceHandle.rollback).toHaveBeenCalledWith('lbl');
    });

    it('400 on invalid label', async () => {
      const svc = await build(fakeSession());
      await expect(svc.rollback('s-1', TENANT, '')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('ownership / lookup', () => {
    it('404 when session not in memory', async () => {
      const module = await Test.createTestingModule({
        providers: [
          SessionFsService,
          { provide: WORKSPACE_PROVIDER, useValue: { capabilities: () => ({ snapshot: true, multiMount: false, fastClone: false, observability: true }) } },
          { provide: SessionService, useValue: { getSession: jest.fn().mockReturnValue(undefined) } },
        ],
      }).compile();
      const svc = module.get(SessionFsService);
      await expect(svc.diff('missing', TENANT)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('403 when tenantId mismatches session.tenantId', async () => {
      const session = fakeSession({ tenantId: 'tenant-other' });
      const svc = await build(session);
      await expect(svc.diff('s-1', TENANT)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('no ownership check when session.tenantId is undefined (anonymous session)', async () => {
      const session = fakeSession({ tenantId: undefined });
      const svc = await build(session);
      await expect(svc.diff('s-1', TENANT)).resolves.toBeDefined();
    });
  });
});
