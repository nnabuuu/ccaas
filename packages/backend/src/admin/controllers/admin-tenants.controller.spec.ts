/**
 * Admin Tenants Controller Tests
 *
 * Tests for input validation in tenant lookup.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminTenantsController } from './admin-tenants.controller';
import { TenantsService } from '../../tenants/tenants.service';
import { SkillsService } from '../../skills/skills.service';
import { AuditService } from '../services/audit.service';
import { TenantQuota } from '../entities/tenant-quota.entity';
import { UserTenantService } from '../../users/user-tenant.service';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { ScopesGuard } from '../../auth/guards/scopes.guard';
import { AdminTenantAccessGuard } from '../guards/admin-tenant-access.guard';

describe('AdminTenantsController', () => {
  let controller: AdminTenantsController;
  let tenantsService: jest.Mocked<TenantsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminTenantsController],
      providers: [
        {
          provide: TenantsService,
          useValue: {
            findAll: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
          },
        },
        {
          provide: SkillsService,
          useValue: {
            findOne: jest.fn(),
            toggle: jest.fn(),
            findAll: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: AuditService,
          useValue: {
            logSuccess: jest.fn(),
            logFailure: jest.fn(),
          },
        },
        {
          provide: UserTenantService,
          useValue: {
            findByUser: jest.fn().mockResolvedValue([]),
            findUserInTenant: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TenantQuota),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ScopesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminTenantAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminTenantsController>(AdminTenantsController);
    tenantsService = module.get(TenantsService);
  });

  describe('findAll', () => {
    it('should return all tenants for admin', async () => {
      const mockTenants = [
        { id: 'tenant-1', name: 'Tenant One', slug: 'tenant-one' },
        { id: 'tenant-2', name: 'Tenant Two', slug: 'tenant-two' },
      ];

      tenantsService.findAll = jest.fn().mockResolvedValue(mockTenants);

      const ctx = {
        apiKeyScopes: ['admin'],
        tenantId: 'tenant-1',
      } as any;

      const result = await controller.findAll(ctx);

      expect(result).toEqual(mockTenants);
      expect(tenantsService.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne - input validation', () => {
    describe('valid inputs', () => {
      it('should accept valid UUID', async () => {
        const validUuid = '123e4567-e89b-12d3-a456-426614174000';
        const mockTenant = { id: validUuid, name: 'Test Tenant', slug: 'test' };

        tenantsService.findOne = jest.fn().mockResolvedValue(mockTenant);

        const result = await controller.findOne(validUuid);

        expect(result).toEqual(mockTenant);
        expect(tenantsService.findOne).toHaveBeenCalledWith(validUuid);
      });

      it('should accept valid UUID (uppercase)', async () => {
        const validUuid = '123E4567-E89B-12D3-A456-426614174000';
        const mockTenant = { id: validUuid.toLowerCase(), name: 'Test Tenant', slug: 'test' };

        tenantsService.findOne = jest.fn().mockResolvedValue(mockTenant);

        const result = await controller.findOne(validUuid);

        expect(result).toEqual(mockTenant);
      });

      it('should accept valid slug (lowercase letters)', async () => {
        const validSlug = 'my-tenant';
        const mockTenant = { id: 'some-uuid', name: 'My Tenant', slug: validSlug };

        tenantsService.findOne = jest.fn().mockResolvedValue(mockTenant);

        const result = await controller.findOne(validSlug);

        expect(result).toEqual(mockTenant);
        expect(tenantsService.findOne).toHaveBeenCalledWith(validSlug);
      });

      it('should accept valid slug (with numbers)', async () => {
        const validSlug = 'tenant123';
        const mockTenant = { id: 'some-uuid', name: 'Tenant 123', slug: validSlug };

        tenantsService.findOne = jest.fn().mockResolvedValue(mockTenant);

        const result = await controller.findOne(validSlug);

        expect(result).toEqual(mockTenant);
      });

      it('should accept valid slug (with underscores)', async () => {
        const validSlug = 'tenant_name';
        const mockTenant = { id: 'some-uuid', name: 'Tenant Name', slug: validSlug };

        tenantsService.findOne = jest.fn().mockResolvedValue(mockTenant);

        const result = await controller.findOne(validSlug);

        expect(result).toEqual(mockTenant);
      });

      it('should accept valid slug (with hyphens)', async () => {
        const validSlug = 'tenant-name-123';
        const mockTenant = { id: 'some-uuid', name: 'Tenant Name', slug: validSlug };

        tenantsService.findOne = jest.fn().mockResolvedValue(mockTenant);

        const result = await controller.findOne(validSlug);

        expect(result).toEqual(mockTenant);
      });

      it('should accept single character slug', async () => {
        const validSlug = 'a';
        const mockTenant = { id: 'some-uuid', name: 'A', slug: validSlug };

        tenantsService.findOne = jest.fn().mockResolvedValue(mockTenant);

        const result = await controller.findOne(validSlug);

        expect(result).toEqual(mockTenant);
      });
    });

    describe('invalid inputs', () => {
      it('should reject empty string', async () => {
        await expect(controller.findOne('')).rejects.toThrow(BadRequestException);
        await expect(controller.findOne('')).rejects.toThrow('Invalid tenant identifier');
      });

      it('should reject string exceeding 100 characters', async () => {
        const longString = 'a'.repeat(101);

        await expect(controller.findOne(longString)).rejects.toThrow(BadRequestException);
        await expect(controller.findOne(longString)).rejects.toThrow('Invalid tenant identifier');
      });

      it('should reject string starting with hyphen', async () => {
        await expect(controller.findOne('-invalid')).rejects.toThrow(BadRequestException);
        await expect(controller.findOne('-invalid')).rejects.toThrow('Invalid tenant identifier format');
      });

      it('should reject string starting with underscore', async () => {
        await expect(controller.findOne('_invalid')).rejects.toThrow(BadRequestException);
        await expect(controller.findOne('_invalid')).rejects.toThrow('Invalid tenant identifier format');
      });

      it('should reject string with special characters', async () => {
        await expect(controller.findOne('tenant@name')).rejects.toThrow(BadRequestException);
        await expect(controller.findOne('tenant@name')).rejects.toThrow('Invalid tenant identifier format');
      });

      it('should reject string with spaces', async () => {
        await expect(controller.findOne('tenant name')).rejects.toThrow(BadRequestException);
        await expect(controller.findOne('tenant name')).rejects.toThrow('Invalid tenant identifier format');
      });

      it('should reject string with SQL injection attempt', async () => {
        await expect(controller.findOne("tenant'; DROP TABLE tenants;--")).rejects.toThrow(BadRequestException);
      });

      it('should reject string with path traversal attempt', async () => {
        await expect(controller.findOne('../../../etc/passwd')).rejects.toThrow(BadRequestException);
      });

      it('should reject string starting with period', async () => {
        await expect(controller.findOne('.hidden')).rejects.toThrow(BadRequestException);
        await expect(controller.findOne('.hidden')).rejects.toThrow('Invalid tenant identifier format');
      });

      it('should reject string with only special chars', async () => {
        await expect(controller.findOne('---')).rejects.toThrow(BadRequestException);
        await expect(controller.findOne('---')).rejects.toThrow('Invalid tenant identifier format');
      });
    });

    describe('tenant not found', () => {
      it('should throw NotFoundException when tenant does not exist', async () => {
        const validUuid = '123e4567-e89b-12d3-a456-426614174000';
        tenantsService.findOne = jest.fn().mockResolvedValue(null);

        await expect(controller.findOne(validUuid)).rejects.toThrow(NotFoundException);
        await expect(controller.findOne(validUuid)).rejects.toThrow(`Tenant not found: ${validUuid}`);
      });

      it('should throw NotFoundException for valid slug that does not exist', async () => {
        const validSlug = 'nonexistent-tenant';
        tenantsService.findOne = jest.fn().mockResolvedValue(null);

        await expect(controller.findOne(validSlug)).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle exactly 100 character string', async () => {
      const exactLength = 'a'.repeat(100);
      const mockTenant = { id: 'some-uuid', name: 'Test', slug: exactLength };

      tenantsService.findOne = jest.fn().mockResolvedValue(mockTenant);

      const result = await controller.findOne(exactLength);

      expect(result).toEqual(mockTenant);
    });

    it('should handle uppercase slug (case insensitive pattern)', async () => {
      const uppercaseSlug = 'MYTENANT';
      const mockTenant = { id: 'some-uuid', name: 'My Tenant', slug: 'mytenant' };

      tenantsService.findOne = jest.fn().mockResolvedValue(mockTenant);

      // The slug pattern is case insensitive
      const result = await controller.findOne(uppercaseSlug);

      expect(result).toEqual(mockTenant);
    });

    it('should handle mixed case slug', async () => {
      const mixedCaseSlug = 'MyTenant123';
      const mockTenant = { id: 'some-uuid', name: 'My Tenant', slug: 'mytenant123' };

      tenantsService.findOne = jest.fn().mockResolvedValue(mockTenant);

      const result = await controller.findOne(mixedCaseSlug);

      expect(result).toEqual(mockTenant);
    });

    it('should handle numeric-only slug', async () => {
      const numericSlug = '12345';
      const mockTenant = { id: 'some-uuid', name: 'Tenant 12345', slug: '12345' };

      tenantsService.findOne = jest.fn().mockResolvedValue(mockTenant);

      const result = await controller.findOne(numericSlug);

      expect(result).toEqual(mockTenant);
    });
  });
});
