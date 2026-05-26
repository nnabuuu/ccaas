/**
 * AdminPlaygroundDraftsController tests.
 *
 * Pins the contract from code-review fix #9:
 *  - Anonymous callers (no userId AND no apiKeyId) are rejected with 401.
 *    Without this guard, all anonymous callers would share a single
 *    'anonymous' bucket and overwrite each other's drafts.
 *  - When userId is present, drafts are scoped to userId.
 *  - When only apiKeyId is present, drafts fall back to apiKeyId scoping.
 *  - List / get / upsert / delete all enforce ownership via ownerId().
 */
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AdminPlaygroundDraftsController } from './admin-playground-drafts.controller';
import { PlaygroundDraft } from '../entities/playground-draft.entity';
import { UserSolutionService } from '../../users/user-solution.service';
import { ApiKeyService } from '../../auth/api-key.service';
import type { RequestContext } from '../../auth/types';

function makeCtx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    solutionId: 'tenant-a',
    apiKeyScopes: ['admin'],
    requestId: 'req-1',
    timestamp: new Date(),
    ...overrides,
  } as unknown as RequestContext;
}

describe('AdminPlaygroundDraftsController', () => {
  let controller: AdminPlaygroundDraftsController;
  let repo: jest.Mocked<Repository<PlaygroundDraft>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminPlaygroundDraftsController],
      providers: [
        {
          provide: getRepositoryToken(PlaygroundDraft),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
        // The controller is decorated with @UseGuards(AdminSolutionAccessGuard),
        // which depends on UserSolutionService. Stub it so the testing module
        // can resolve DI — the guard logic itself isn't under test here.
        {
          provide: UserSolutionService,
          useValue: { findUserInTenant: jest.fn() },
        },
        {
          provide: ApiKeyService,
          useValue: { validateApiKey: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(AdminPlaygroundDraftsController);
    repo = module.get(getRepositoryToken(PlaygroundDraft));
  });

  describe('anonymous rejection (fix #9)', () => {
    it('list() throws 401 when ctx has neither userId nor apiKeyId', async () => {
      const ctx = makeCtx(); // no userId, no apiKeyId
      await expect(controller.list(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(repo.find).not.toHaveBeenCalled();
    });

    it('get() throws 401 on anonymous ctx', async () => {
      const ctx = makeCtx();
      await expect(controller.get(ctx, 'quiz', 'story1')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('upsert() throws 401 on anonymous ctx', async () => {
      const ctx = makeCtx();
      await expect(
        controller.upsert(ctx, 'quiz', 'story1', { payload: { foo: 'bar' } }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('delete() throws 401 on anonymous ctx', async () => {
      const ctx = makeCtx();
      await expect(controller.delete(ctx, 'quiz', 'story1')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('ownerId resolution', () => {
    it('prefers userId over apiKeyId when both present', async () => {
      const ctx = makeCtx({
        userId: 'user-123',
        apiKeyId: 'apikey-zzz',
      } as Partial<RequestContext>);
      repo.find.mockResolvedValue([]);

      await controller.list(ctx);

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-123' } }),
      );
    });

    it('falls back to apiKeyId when userId missing', async () => {
      const ctx = makeCtx({ apiKeyId: 'apikey-zzz' } as Partial<RequestContext>);
      repo.find.mockResolvedValue([]);

      await controller.list(ctx);

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'apikey-zzz' } }),
      );
    });

    it('two anonymous callers never share storage — both rejected, never collide on "anonymous" key', async () => {
      // Regression guard for the pre-fix behaviour where userId fell back to
      // the literal string 'anonymous', causing all anonymous callers to
      // share a single row.
      const a = makeCtx();
      const b = makeCtx();
      await expect(controller.list(a)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(controller.list(b)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(repo.find).not.toHaveBeenCalled();
    });
  });

  describe('list()', () => {
    it('filters by bundleId when provided', async () => {
      const ctx = makeCtx({ userId: 'u1' } as Partial<RequestContext>);
      repo.find.mockResolvedValue([]);

      await controller.list(ctx, 'quiz');

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', bundleId: 'quiz' },
          take: 200,
          order: { updatedAt: 'DESC' },
        }),
      );
    });

    it('returns { data, total } shape', async () => {
      const ctx = makeCtx({ userId: 'u1' } as Partial<RequestContext>);
      const drafts = [
        { id: 'd1', userId: 'u1', bundleId: 'quiz', storyName: 's1' } as PlaygroundDraft,
        { id: 'd2', userId: 'u1', bundleId: 'match', storyName: 's2' } as PlaygroundDraft,
      ];
      repo.find.mockResolvedValue(drafts);

      const result = await controller.list(ctx);

      expect(result).toEqual({ data: drafts, total: 2 });
    });
  });

  describe('get()', () => {
    it('returns the draft when found', async () => {
      const ctx = makeCtx({ userId: 'u1' } as Partial<RequestContext>);
      const draft = {
        id: 'd1',
        userId: 'u1',
        bundleId: 'quiz',
        storyName: 's1',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PlaygroundDraft;
      repo.findOne.mockResolvedValue(draft);

      const result = await controller.get(ctx, 'quiz', 's1');
      expect(result).toBe(draft);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { userId: 'u1', bundleId: 'quiz', storyName: 's1' },
      });
    });

    it('throws 404 when draft not found', async () => {
      const ctx = makeCtx({ userId: 'u1' } as Partial<RequestContext>);
      repo.findOne.mockResolvedValue(null);

      await expect(controller.get(ctx, 'quiz', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('upsert()', () => {
    it('creates a new draft when none exists', async () => {
      const ctx = makeCtx({ userId: 'u1' } as Partial<RequestContext>);
      repo.findOne.mockResolvedValue(null);
      const created = {
        id: 'd-new',
        userId: 'u1',
        bundleId: 'quiz',
        storyName: 's1',
        payload: { foo: 1 },
        notes: 'hi',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PlaygroundDraft;
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      const result = await controller.upsert(ctx, 'quiz', 's1', {
        payload: { foo: 1 },
        notes: 'hi',
      });

      expect(repo.create).toHaveBeenCalledWith({
        userId: 'u1',
        bundleId: 'quiz',
        storyName: 's1',
        payload: { foo: 1 },
        notes: 'hi',
      });
      expect(repo.save).toHaveBeenCalledWith(created);
      expect(result).toBe(created);
    });

    it('updates existing draft', async () => {
      const ctx = makeCtx({ userId: 'u1' } as Partial<RequestContext>);
      const existing: PlaygroundDraft = {
        id: 'd1',
        userId: 'u1',
        bundleId: 'quiz',
        storyName: 's1',
        payload: { foo: 'old' },
        notes: 'old-notes',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PlaygroundDraft;
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockImplementation(async (e) => e as PlaygroundDraft);

      const result = await controller.upsert(ctx, 'quiz', 's1', {
        payload: { foo: 'new' },
        notes: 'new-notes',
      });

      expect(repo.create).not.toHaveBeenCalled();
      expect(result.payload).toEqual({ foo: 'new' });
      expect(result.notes).toBe('new-notes');
    });

    it('preserves notes when body.notes is undefined', async () => {
      const ctx = makeCtx({ userId: 'u1' } as Partial<RequestContext>);
      const existing: PlaygroundDraft = {
        id: 'd1',
        userId: 'u1',
        bundleId: 'quiz',
        storyName: 's1',
        payload: {},
        notes: 'keep-me',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PlaygroundDraft;
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockImplementation(async (e) => e as PlaygroundDraft);

      const result = await controller.upsert(ctx, 'quiz', 's1', { payload: { foo: 'x' } });

      expect(result.notes).toBe('keep-me');
    });
  });

  describe('delete()', () => {
    it('deletes scoped by userId and composite key', async () => {
      const ctx = makeCtx({ userId: 'u1' } as Partial<RequestContext>);
      repo.delete.mockResolvedValue({ affected: 1, raw: [] });

      await controller.delete(ctx, 'quiz', 's1');

      expect(repo.delete).toHaveBeenCalledWith({
        userId: 'u1',
        bundleId: 'quiz',
        storyName: 's1',
      });
    });

    it('is idempotent — returns void even if the row did not exist', async () => {
      const ctx = makeCtx({ userId: 'u1' } as Partial<RequestContext>);
      repo.delete.mockResolvedValue({ affected: 0, raw: [] });

      await expect(controller.delete(ctx, 'quiz', 's1')).resolves.toBeUndefined();
    });
  });
});
