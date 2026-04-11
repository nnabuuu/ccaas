/**
 * ApiKeyService Unit Tests - Builder scope validation & userId update
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let mockApiKeyRepo: any;
  let mockTenantsService: any;
  let mockUserTenantService: any;
  let mockUsersService: any;
  let mockConfigService: any;

  const fakeTenant = { id: 'tenant-1', slug: 'test', status: 'active' };
  const fakeUser = { id: 'user-1', email: 'builder@example.com' };

  beforeEach(() => {
    mockApiKeyRepo = {
      create: jest.fn((data: any) => ({ ...data, id: 'key-1', createdAt: new Date(), updatedAt: new Date(), usageCount: 0, lastUsedAt: null })),
      save: jest.fn((entity: any) => Promise.resolve({ ...entity, id: entity.id || 'key-1', createdAt: new Date(), updatedAt: new Date() })),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
    };

    mockTenantsService = {
      findOne: jest.fn().mockResolvedValue(fakeTenant),
      getDefaultTenantId: jest.fn().mockReturnValue('default'),
    };

    mockUserTenantService = {
      findUserInTenant: jest.fn(),
    };

    mockUsersService = {
      findOne: jest.fn().mockResolvedValue(fakeUser),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue(false),
    };

    service = new ApiKeyService(
      mockApiKeyRepo,
      mockTenantsService,
      mockUserTenantService,
      mockUsersService,
      mockConfigService,
    );
  });

  describe('create() - builder scope validation', () => {
    it('should throw BadRequestException when builder scope has no userId', async () => {
      await expect(
        service.create('tenant-1', { name: 'Bad Key', scopes: ['builder'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should include helpful message when builder scope has no userId', async () => {
      await expect(
        service.create('tenant-1', { name: 'Bad Key', scopes: ['builder'] }),
      ).rejects.toThrow(/userId is required for builder scope/);
    });

    it('should allow builder scope with userId', async () => {
      const result = await service.create('tenant-1', {
        name: 'Good Key',
        scopes: ['builder'],
        userId: 'user-1',
      });

      expect(result.rawKey).toBeDefined();
      expect(result.rawKey.startsWith('sk-')).toBe(true);
    });

    it('should allow non-builder scopes without userId', async () => {
      const result = await service.create('tenant-1', {
        name: 'Chat Key',
        scopes: ['chat'],
      });

      expect(result.rawKey).toBeDefined();
    });

    it('should throw NotFoundException for non-existent userId', async () => {
      mockUsersService.findOne.mockRejectedValue(new NotFoundException());

      await expect(
        service.create('tenant-1', { name: 'Key', scopes: ['chat'], userId: 'ghost' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update() - userId handling', () => {
    const existingKey = {
      id: 'key-1',
      tenantId: 'tenant-1',
      name: 'Existing Key',
      keyPrefix: 'sk-test-1234567',
      scopes: ['builder'] as any,
      rateLimitRpm: 60,
      rateLimitRpd: 10000,
      status: 'active' as const,
      expiresAt: null,
      lastUsedAt: null,
      usageCount: 0,
      userId: null as string | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockApiKeyRepo.findOne.mockResolvedValue({ ...existingKey });
    });

    it('should update userId on existing key', async () => {
      const result = await service.update('key-1', { userId: 'user-1' });

      const savedEntity = mockApiKeyRepo.save.mock.calls[0][0];
      expect(savedEntity.userId).toBe('user-1');
      expect(result).toBeDefined();
    });

    it('should validate userId references existing user', async () => {
      mockUsersService.findOne.mockRejectedValue(new NotFoundException());

      await expect(
        service.update('key-1', { userId: 'ghost-user' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow clearing userId on a non-builder key', async () => {
      mockApiKeyRepo.findOne.mockResolvedValue({ ...existingKey, userId: 'user-1', scopes: ['chat'] });

      await service.update('key-1', { userId: '' });

      const savedEntity = mockApiKeyRepo.save.mock.calls[0][0];
      expect(savedEntity.userId).toBeNull();
    });

    it('should not change userId when not in dto', async () => {
      mockApiKeyRepo.findOne.mockResolvedValue({ ...existingKey, userId: 'user-1' });

      await service.update('key-1', { name: 'Renamed' });

      const savedEntity = mockApiKeyRepo.save.mock.calls[0][0];
      expect(savedEntity.userId).toBe('user-1');
    });

    it('should reject clearing userId on a builder-scoped key', async () => {
      mockApiKeyRepo.findOne.mockResolvedValue({ ...existingKey, userId: 'user-1', scopes: ['builder'] });

      await expect(
        service.update('key-1', { userId: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject adding builder scope when key has no userId', async () => {
      mockApiKeyRepo.findOne.mockResolvedValue({ ...existingKey, userId: null, scopes: ['chat'] });

      await expect(
        service.update('key-1', { scopes: ['builder'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate unexpected errors from usersService.findOne', async () => {
      mockUsersService.findOne.mockRejectedValue(new Error('DB connection lost'));

      await expect(
        service.update('key-1', { userId: 'user-1' }),
      ).rejects.toThrow('DB connection lost');
    });
  });
});
