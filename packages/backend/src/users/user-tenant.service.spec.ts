/**
 * UserTenantService Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserTenantService } from './user-tenant.service';
import { UserTenant } from './entities/user-tenant.entity';
import { CreateUserTenantDto } from './dto/create-user-tenant.dto';
import { UpdateUserTenantDto } from './dto/update-user-tenant.dto';

describe('UserTenantService', () => {
  let service: UserTenantService;
  let repository: jest.Mocked<Repository<UserTenant>>;

  const mockUserTenant = {
    id: 'ut-123',
    userId: 'user-123',
    tenantId: 'tenant-123',
    role: 'developer' as const,
    canCreateSkills: true,
    isActive: true,
    joinedAt: new Date(),
  };

  // Shared mock query builder
  let mockQb: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
    };

    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserTenantService,
        {
          provide: getRepositoryToken(UserTenant),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UserTenantService>(UserTenantService);
    repository = module.get(getRepositoryToken(UserTenant));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a user-tenant relationship with admin role', async () => {
      const createDto: CreateUserTenantDto = {
        userId: 'user-123',
        tenantId: 'tenant-123',
        role: 'admin',
      };

      repository.findOne.mockResolvedValue(null); // No existing relationship
      repository.create.mockReturnValue({ ...mockUserTenant, role: 'admin', canCreateSkills: true } as any);
      repository.save.mockResolvedValue({ ...mockUserTenant as any, role: 'admin', canCreateSkills: true } as any);

      const result = await service.create(createDto);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-123', tenantId: 'tenant-123' },
      });
      expect(repository.create).toHaveBeenCalledWith({
        ...createDto,
        canCreateSkills: true, // Auto-set for admin
      });
      expect(result.role).toBe('admin');
      expect(result.canCreateSkills).toBe(true);
    });

    it('should create a user-tenant relationship with developer role', async () => {
      const createDto: CreateUserTenantDto = {
        userId: 'user-123',
        tenantId: 'tenant-123',
        role: 'developer',
      };

      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockUserTenant as any);
      repository.save.mockResolvedValue(mockUserTenant as any);

      const result = await service.create(createDto);

      expect(result.role).toBe('developer');
      expect(result.canCreateSkills).toBe(true); // Auto-set for developer
    });

    it('should create a user-tenant relationship with viewer role', async () => {
      const createDto: CreateUserTenantDto = {
        userId: 'user-123',
        tenantId: 'tenant-123',
        role: 'viewer',
      };

      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue({ ...mockUserTenant, role: 'viewer', canCreateSkills: false } as any);
      repository.save.mockResolvedValue({ ...mockUserTenant as any, role: 'viewer', canCreateSkills: false } as any);

      const result = await service.create(createDto);

      expect(result.role).toBe('viewer');
      expect(result.canCreateSkills).toBe(false); // Auto-set to false for viewer
    });

    it('should respect explicit canCreateSkills value', async () => {
      const createDto: CreateUserTenantDto = {
        userId: 'user-123',
        tenantId: 'tenant-123',
        role: 'developer',
        canCreateSkills: false, // Explicitly set to false
      };

      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue({ ...mockUserTenant, canCreateSkills: false } as any);
      repository.save.mockResolvedValue({ ...mockUserTenant as any, canCreateSkills: false } as any);

      const result = await service.create(createDto);

      expect(result.canCreateSkills).toBe(false);
    });

    it('should throw ConflictException if relationship already exists', async () => {
      const createDto: CreateUserTenantDto = {
        userId: 'user-123',
        tenantId: 'tenant-123',
        role: 'developer',
      };

      repository.findOne.mockResolvedValue(mockUserTenant as any);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      await expect(service.create(createDto)).rejects.toThrow(
        'User is already a member of this tenant',
      );
    });
  });

  describe('findByTenant', () => {
    it('should return all active users in a tenant', async () => {
      const userTenants = [mockUserTenant, { ...mockUserTenant, id: 'ut-456' }];
      mockQb.getMany.mockResolvedValue(userTenants as any);

      const result = await service.findByTenant('tenant-123');

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('ut');
      expect(mockQb.leftJoinAndSelect).toHaveBeenCalledWith('ut.user', 'user');
      expect(mockQb.where).toHaveBeenCalledWith('ut.tenantId = :tenantId', { tenantId: 'tenant-123' });
      expect(mockQb.andWhere).toHaveBeenCalledWith('ut.isActive = :isActive', { isActive: true });
      expect(mockQb.orderBy).toHaveBeenCalledWith('ut.joinedAt', 'DESC');
      expect(result).toEqual(userTenants);
    });

    it('should apply search filter', async () => {
      mockQb.getMany.mockResolvedValue([]);

      await service.findByTenant('tenant-123', {
        filter: { search: 'john' },
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '(user.name LIKE :search OR user.email LIKE :search)',
        { search: '%john%' },
      );
    });

    it('should apply role filter', async () => {
      mockQb.getMany.mockResolvedValue([]);

      await service.findByTenant('tenant-123', {
        filter: { role: 'developer' },
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith('ut.role = :role', { role: 'developer' });
    });

    it('should apply status filter', async () => {
      mockQb.getMany.mockResolvedValue([]);

      await service.findByTenant('tenant-123', {
        filter: { status: 'active' },
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith('user.status = :status', { status: 'active' });
    });

    it('should apply pagination', async () => {
      mockQb.getMany.mockResolvedValue([]);

      await service.findByTenant('tenant-123', { skip: 10, take: 20 });

      expect(mockQb.skip).toHaveBeenCalledWith(10);
      expect(mockQb.take).toHaveBeenCalledWith(20);
    });
  });

  describe('countByTenant', () => {
    it('should count active users in a tenant', async () => {
      mockQb.getCount.mockResolvedValue(5);

      const result = await service.countByTenant('tenant-123');

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('ut');
      expect(mockQb.leftJoin).toHaveBeenCalledWith('ut.user', 'user');
      expect(result).toBe(5);
    });

    it('should apply search filter when counting', async () => {
      mockQb.getCount.mockResolvedValue(2);

      const result = await service.countByTenant('tenant-123', { search: 'john' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '(user.name LIKE :search OR user.email LIKE :search)',
        { search: '%john%' },
      );
      expect(result).toBe(2);
    });
  });

  describe('findByUser', () => {
    it('should return all active tenants for a user', async () => {
      const userTenants = [mockUserTenant];
      repository.find.mockResolvedValue(userTenants as any);

      const result = await service.findByUser('user-123');

      expect(repository.find).toHaveBeenCalledWith({
        where: { userId: 'user-123', isActive: true },
        relations: ['tenant'],
      });
      expect(result).toEqual(userTenants);
    });
  });

  describe('findUserInTenant', () => {
    it('should find a user-tenant relationship', async () => {
      repository.findOne.mockResolvedValue(mockUserTenant as any);

      const result = await service.findUserInTenant('user-123', 'tenant-123');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-123', tenantId: 'tenant-123' },
        relations: ['user', 'tenant'],
      });
      expect(result).toEqual(mockUserTenant);
    });

    it('should return null if relationship not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findUserInTenant('user-999', 'tenant-999');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user role', async () => {
      const updateDto: UpdateUserTenantDto = {
        role: 'admin',
      };

      repository.findOne.mockResolvedValue(mockUserTenant as any);
      repository.save.mockResolvedValue({ ...mockUserTenant as any, role: 'admin', canCreateSkills: true });

      const result = await service.update('ut-123', updateDto);

      expect(result.role).toBe('admin');
      expect(result.canCreateSkills).toBe(true); // Auto-updated
    });

    it('should update canCreateSkills flag', async () => {
      const updateDto: UpdateUserTenantDto = {
        canCreateSkills: false,
      };

      repository.findOne.mockResolvedValue(mockUserTenant as any);
      repository.save.mockResolvedValue({ ...mockUserTenant as any, canCreateSkills: false });

      const result = await service.update('ut-123', updateDto);

      expect(result.canCreateSkills).toBe(false);
    });

    it('should update isActive flag', async () => {
      const updateDto: UpdateUserTenantDto = {
        isActive: false,
      };

      repository.findOne.mockResolvedValue(mockUserTenant as any);
      repository.save.mockResolvedValue({ ...mockUserTenant as any, isActive: false });

      const result = await service.update('ut-123', updateDto);

      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException if relationship not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.update('ut-999', { role: 'admin' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete by setting isActive to false', async () => {
      repository.findOne.mockResolvedValue(mockUserTenant as any);
      repository.save.mockResolvedValue({ ...mockUserTenant as any, isActive: false });

      await service.remove('ut-123');

      expect(repository.save).toHaveBeenCalledWith({
        ...mockUserTenant,
        isActive: false,
      });
    });

    it('should throw NotFoundException if relationship not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.remove('ut-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('canPerformAction', () => {
    it('should return true for admin with viewer requirement', () => {
      const adminUserTenant = { ...mockUserTenant, role: 'admin' as const, isActive: true } as UserTenant;

      const result = service.canPerformAction(adminUserTenant, 'viewer');

      expect(result).toBe(true);
    });

    it('should return true for developer with developer requirement', () => {
      const devUserTenant = { ...mockUserTenant, role: 'developer' as const, isActive: true } as UserTenant;

      const result = service.canPerformAction(devUserTenant, 'developer');

      expect(result).toBe(true);
    });

    it('should return false for viewer with developer requirement', () => {
      const viewerUserTenant = { ...mockUserTenant, role: 'viewer' as const, isActive: true } as UserTenant;

      const result = service.canPerformAction(viewerUserTenant, 'developer');

      expect(result).toBe(false);
    });

    it('should return false for inactive user', () => {
      const inactiveUserTenant = { ...mockUserTenant, isActive: false } as UserTenant;

      const result = service.canPerformAction(inactiveUserTenant, 'viewer');

      expect(result).toBe(false);
    });

    it('should return false for null userTenant', () => {
      const result = service.canPerformAction(null, 'viewer');

      expect(result).toBe(false);
    });
  });

  describe('canEditResource', () => {
    it('should return true for admin editing any resource', () => {
      const adminUserTenant = { ...mockUserTenant, role: 'admin' as const, isActive: true } as UserTenant;

      const result = service.canEditResource(adminUserTenant, 'other-user-id', 'user-123');

      expect(result).toBe(true);
    });

    it('should return true for developer editing own resource', () => {
      const devUserTenant = { ...mockUserTenant, role: 'developer' as const, isActive: true } as UserTenant;

      const result = service.canEditResource(devUserTenant, 'user-123', 'user-123');

      expect(result).toBe(true);
    });

    it('should return false for developer editing others resource', () => {
      const devUserTenant = { ...mockUserTenant, role: 'developer' as const, isActive: true } as UserTenant;

      const result = service.canEditResource(devUserTenant, 'other-user-id', 'user-123');

      expect(result).toBe(false);
    });

    it('should return false for viewer', () => {
      const viewerUserTenant = { ...mockUserTenant, role: 'viewer' as const, isActive: true } as UserTenant;

      const result = service.canEditResource(viewerUserTenant, 'user-123', 'user-123');

      expect(result).toBe(false);
    });

    it('should return false for inactive user', () => {
      const inactiveUserTenant = { ...mockUserTenant, isActive: false } as UserTenant;

      const result = service.canEditResource(inactiveUserTenant, 'user-123', 'user-123');

      expect(result).toBe(false);
    });

    it('should return false for null userTenant', () => {
      const result = service.canEditResource(null, 'user-123', 'user-123');

      expect(result).toBe(false);
    });
  });
});
