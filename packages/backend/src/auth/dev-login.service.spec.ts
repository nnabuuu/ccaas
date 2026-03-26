import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { DevLoginService } from './dev-login.service';
import { User } from '../users/entities/user.entity';
import { ApiKeyService } from './api-key.service';
import { TenantsService } from '../tenants/tenants.service';
import { UserTenantService } from '../users/user-tenant.service';

describe('DevLoginService', () => {
  let service: DevLoginService;
  let userRepo: any;
  let apiKeyService: any;
  let tenantsService: any;
  let userTenantService: any;

  const mockUser = {
    id: 'user-1',
    email: 'admin@localhost',
    name: 'Dev Admin',
    username: 'admin',
    passwordHash: '', // set in beforeEach
    status: 'active',
  };

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((data) => ({ ...data, id: 'user-1' })),
      save: jest.fn().mockImplementation((data) => data),
      createQueryBuilder: jest.fn(),
    };

    apiKeyService = {
      create: jest.fn().mockResolvedValue({
        rawKey: 'sk-test-key-12345678901234',
        apiKey: { id: 'key-1', keyPrefix: 'sk-test-key-1234' },
      }),
    };

    tenantsService = {
      getDefaultTenantId: jest.fn().mockReturnValue('default'),
      findOne: jest.fn().mockResolvedValue({ id: 'default-tenant-uuid', slug: 'default', status: 'active' }),
    };

    userTenantService = {
      findUserInTenant: jest.fn().mockResolvedValue({ id: 'ut-1', role: 'admin' }),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevLoginService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: ApiKeyService, useValue: apiKeyService },
        { provide: TenantsService, useValue: tenantsService },
        { provide: UserTenantService, useValue: userTenantService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<DevLoginService>(DevLoginService);
  });

  describe('hashPassword / verifyPassword', () => {
    it('should hash and verify a password correctly', async () => {
      const hash = await service.hashPassword('test123');
      expect(hash).toMatch(/^scrypt:[a-f0-9]+:[a-f0-9]+$/);
      expect(await service.verifyPassword('test123', hash)).toBe(true);
    });

    it('should reject wrong password', async () => {
      const hash = await service.hashPassword('test123');
      expect(await service.verifyPassword('wrong', hash)).toBe(false);
    });

    it('should reject malformed hash', async () => {
      expect(await service.verifyPassword('test', 'not-a-hash')).toBe(false);
      expect(await service.verifyPassword('test', '')).toBe(false);
      expect(await service.verifyPassword('test', 'scrypt::')).toBe(false);
    });

    it('should produce different hashes for the same password (random salt)', async () => {
      const h1 = await service.hashPassword('same');
      const h2 = await service.hashPassword('same');
      expect(h1).not.toEqual(h2);
      // But both verify
      expect(await service.verifyPassword('same', h1)).toBe(true);
      expect(await service.verifyPassword('same', h2)).toBe(true);
    });
  });

  describe('login', () => {
    it('should return apiKey and user on valid credentials', async () => {
      const hash = await service.hashPassword('dev123');
      const qb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ ...mockUser, passwordHash: hash }),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.login('admin', 'dev123');

      expect(result.apiKey).toBe('sk-test-key-12345678901234');
      expect(result.user).toEqual({
        id: 'user-1',
        username: 'admin',
        name: 'Dev Admin',
      });
      expect(apiKeyService.create).toHaveBeenCalledWith(
        'default-tenant-uuid',
        expect.objectContaining({
          name: 'Dev login session',
          scopes: ['admin'],
          userId: 'user-1',
          expiresAt: expect.any(Date),
        }),
      );
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hash = await service.hashPassword('dev123');
      const qb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ ...mockUser, passwordHash: hash }),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.login('admin', 'wrong')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      const qb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.login('nobody', 'pass')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user has no passwordHash', async () => {
      const qb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ ...mockUser, passwordHash: null }),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.login('admin', 'pass')).rejects.toThrow(UnauthorizedException);
    });

    it('should set API key expiry to 24 hours', async () => {
      const hash = await service.hashPassword('dev123');
      const qb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ ...mockUser, passwordHash: hash }),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb);

      const now = Date.now();
      await service.login('admin', 'dev123');

      const expiresAt = apiKeyService.create.mock.calls[0][1].expiresAt as Date;
      const ttl = expiresAt.getTime() - now;
      // Should be ~24h (allow 5s tolerance)
      expect(ttl).toBeGreaterThan(24 * 60 * 60 * 1000 - 5000);
      expect(ttl).toBeLessThan(24 * 60 * 60 * 1000 + 5000);
    });
  });

  describe('onModuleInit', () => {
    it('should not crash if seeding fails', async () => {
      tenantsService.getDefaultTenantId.mockImplementation(() => {
        throw new Error('No default tenant');
      });
      userRepo.findOne.mockResolvedValue(null);

      // Should not throw
      await service.onModuleInit();
    });
  });
});
