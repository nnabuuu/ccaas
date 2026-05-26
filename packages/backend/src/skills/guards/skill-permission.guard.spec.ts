/**
 * SkillPermissionGuard Unit Tests
 *
 * TDD: Writing tests FIRST before implementation
 */

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SkillPermissionGuard } from './skill-permission.guard';
import { SkillsService } from '../skills.service';
import { UserSolutionService } from '../../users/user-solution.service';

describe('SkillPermissionGuard', () => {
  let guard: SkillPermissionGuard;
  let skillsService: jest.Mocked<SkillsService>;
  let userTenantService: jest.Mocked<UserSolutionService>;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    skillsService = {
      findOne: jest.fn(),
    } as any;

    userTenantService = {
      canEditResource: jest.fn(),
    } as any;

    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    guard = new SkillPermissionGuard(skillsService, userTenantService, reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockContext = (request: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;
  };

  describe('canActivate', () => {
    describe('Public Routes', () => {
      it('should allow access to public routes without authentication', async () => {
        reflector.getAllAndOverride.mockReturnValue(true); // IS_PUBLIC_KEY

        const context = createMockContext({});
        const result = await guard.canActivate(context);

        expect(result).toBe(true);
        expect(skillsService.findOne).not.toHaveBeenCalled();
      });
    });

    describe('READ Operations (GET)', () => {
      it('should allow admin to read any skill', async () => {
        const request = {
          method: 'GET',
          params: { id: 'skill-123' },
          context: {
            solutionId: 'tenant-123',
            userId: 'user-123',
            userTenant: { role: 'admin', isActive: true },
          },
        };

        reflector.getAllAndOverride.mockReturnValue(false);
        skillsService.findOne.mockResolvedValue({
          id: 'skill-123',
          createdBy: 'other-user',
          scope: 'solution',
        } as any);

        const context = createMockContext(request);
        const result = await guard.canActivate(context);

        expect(result).toBe(true);
      });

      it('should allow developer to read tenant-scoped skills', async () => {
        const request = {
          method: 'GET',
          params: { id: 'skill-123' },
          context: {
            solutionId: 'tenant-123',
            userId: 'user-123',
            userTenant: { role: 'developer', isActive: true },
          },
        };

        reflector.getAllAndOverride.mockReturnValue(false);
        skillsService.findOne.mockResolvedValue({
          id: 'skill-123',
          createdBy: 'other-user',
          scope: 'solution',
        } as any);

        const context = createMockContext(request);
        const result = await guard.canActivate(context);

        expect(result).toBe(true);
      });

      it('should allow developer to read own personal skills', async () => {
        const request = {
          method: 'GET',
          params: { id: 'skill-123' },
          context: {
            solutionId: 'tenant-123',
            userId: 'user-123',
            userTenant: { role: 'developer', isActive: true },
          },
        };

        reflector.getAllAndOverride.mockReturnValue(false);
        skillsService.findOne.mockResolvedValue({
          id: 'skill-123',
          createdBy: 'user-123',
          scope: 'personal',
        } as any);

        const context = createMockContext(request);
        const result = await guard.canActivate(context);

        expect(result).toBe(true);
      });

      it('should deny developer from reading others personal skills', async () => {
        const request = {
          method: 'GET',
          params: { id: 'skill-123' },
          context: {
            solutionId: 'tenant-123',
            userId: 'user-123',
            userTenant: { role: 'developer', isActive: true },
          },
        };

        reflector.getAllAndOverride.mockReturnValue(false);
        skillsService.findOne.mockResolvedValue({
          id: 'skill-123',
          createdBy: 'other-user',
          scope: 'personal',
        } as any);

        const context = createMockContext(request);

        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
        await expect(guard.canActivate(context)).rejects.toThrow(
          'You do not have permission to access this personal skill',
        );
      });

      it('should allow viewer to read tenant-scoped skills', async () => {
        const request = {
          method: 'GET',
          params: { id: 'skill-123' },
          context: {
            solutionId: 'tenant-123',
            userId: 'user-123',
            userTenant: { role: 'viewer', isActive: true },
          },
        };

        reflector.getAllAndOverride.mockReturnValue(false);
        skillsService.findOne.mockResolvedValue({
          id: 'skill-123',
          createdBy: 'other-user',
          scope: 'solution',
        } as any);

        const context = createMockContext(request);
        const result = await guard.canActivate(context);

        expect(result).toBe(true);
      });
    });

    describe('WRITE Operations (POST, PUT, PATCH)', () => {
      it('should allow admin to create skills', async () => {
        const request = {
          method: 'POST',
          context: {
            solutionId: 'tenant-123',
            userId: 'user-123',
            userTenant: { role: 'admin', isActive: true, canCreateSkills: true },
          },
        };

        reflector.getAllAndOverride.mockReturnValue(false);

        const context = createMockContext(request);
        const result = await guard.canActivate(context);

        expect(result).toBe(true);
      });

      it('should allow developer to create skills if canCreateSkills is true', async () => {
        const request = {
          method: 'POST',
          context: {
            solutionId: 'tenant-123',
            userId: 'user-123',
            userTenant: { role: 'developer', isActive: true, canCreateSkills: true },
          },
        };

        reflector.getAllAndOverride.mockReturnValue(false);

        const context = createMockContext(request);
        const result = await guard.canActivate(context);

        expect(result).toBe(true);
      });

      it('should deny developer from creating skills if canCreateSkills is false', async () => {
        const request = {
          method: 'POST',
          context: {
            solutionId: 'tenant-123',
            userId: 'user-123',
            userTenant: { role: 'developer', isActive: true, canCreateSkills: false },
          },
        };

        reflector.getAllAndOverride.mockReturnValue(false);

        const context = createMockContext(request);

        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
        await expect(guard.canActivate(context)).rejects.toThrow(
          'You do not have permission to create skills',
        );
      });

      it('should deny viewer from creating skills', async () => {
        const request = {
          method: 'POST',
          context: {
            solutionId: 'tenant-123',
            userId: 'user-123',
            userTenant: { role: 'viewer', isActive: true, canCreateSkills: false },
          },
        };

        reflector.getAllAndOverride.mockReturnValue(false);

        const context = createMockContext(request);

        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      });

      it('should allow admin to update any skill', async () => {
        const request = {
          method: 'PATCH',
          params: { id: 'skill-123' },
          context: {
            solutionId: 'tenant-123',
            userId: 'user-123',
            userTenant: { role: 'admin', isActive: true },
          },
        };

        reflector.getAllAndOverride.mockReturnValue(false);
        skillsService.findOne.mockResolvedValue({
          id: 'skill-123',
          createdBy: 'other-user',
          scope: 'solution',
        } as any);
        userTenantService.canEditResource.mockReturnValue(true);

        const context = createMockContext(request);
        const result = await guard.canActivate(context);

        expect(result).toBe(true);
        expect(userTenantService.canEditResource).toHaveBeenCalledWith(
          request.context.userTenant,
          'other-user',
          'user-123',
        );
      });

      it('should allow developer to update own skills', async () => {
        const request = {
          method: 'PATCH',
          params: { id: 'skill-123' },
          context: {
            solutionId: 'tenant-123',
            userId: 'user-123',
            userTenant: { role: 'developer', isActive: true },
          },
        };

        reflector.getAllAndOverride.mockReturnValue(false);
        skillsService.findOne.mockResolvedValue({
          id: 'skill-123',
          createdBy: 'user-123',
          scope: 'solution',
        } as any);
        userTenantService.canEditResource.mockReturnValue(true);

        const context = createMockContext(request);
        const result = await guard.canActivate(context);

        expect(result).toBe(true);
      });

      it('should deny developer from updating others skills', async () => {
        const request = {
          method: 'PATCH',
          params: { id: 'skill-123' },
          context: {
            solutionId: 'tenant-123',
            userId: 'user-123',
            userTenant: { role: 'developer', isActive: true },
          },
        };

        reflector.getAllAndOverride.mockReturnValue(false);
        skillsService.findOne.mockResolvedValue({
          id: 'skill-123',
          createdBy: 'other-user',
          scope: 'solution',
        } as any);
        userTenantService.canEditResource.mockReturnValue(false);

        const context = createMockContext(request);

        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
        await expect(guard.canActivate(context)).rejects.toThrow(
          'You do not have permission to modify this skill',
        );
      });
    });

    describe('DELETE Operations', () => {
      it('should allow admin to delete any skill', async () => {
        const request = {
          method: 'DELETE',
          params: { id: 'skill-123' },
          context: {
            solutionId: 'tenant-123',
            userId: 'user-123',
            userTenant: { role: 'admin', isActive: true },
          },
        };

        reflector.getAllAndOverride.mockReturnValue(false);
        skillsService.findOne.mockResolvedValue({
          id: 'skill-123',
          createdBy: 'other-user',
        } as any);
        userTenantService.canEditResource.mockReturnValue(true);

        const context = createMockContext(request);
        const result = await guard.canActivate(context);

        expect(result).toBe(true);
      });

      it('should deny developer from deleting others skills', async () => {
        const request = {
          method: 'DELETE',
          params: { id: 'skill-123' },
          context: {
            solutionId: 'tenant-123',
            userId: 'user-123',
            userTenant: { role: 'developer', isActive: true },
          },
        };

        reflector.getAllAndOverride.mockReturnValue(false);
        skillsService.findOne.mockResolvedValue({
          id: 'skill-123',
          createdBy: 'other-user',
        } as any);
        userTenantService.canEditResource.mockReturnValue(false);

        const context = createMockContext(request);

        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      });
    });

    describe('Anonymous Access', () => {
      it('should allow anonymous users to read tenant-scoped skills', async () => {
        const request = {
          method: 'GET',
          params: { id: 'skill-123' },
          context: {
            solutionId: 'tenant-123',
            isAnonymous: true,
          },
        };

        reflector.getAllAndOverride.mockReturnValue(false);
        skillsService.findOne.mockResolvedValue({
          id: 'skill-123',
          scope: 'solution',
        } as any);

        const context = createMockContext(request);
        const result = await guard.canActivate(context);

        expect(result).toBe(true);
      });

      it('should deny anonymous users from creating skills', async () => {
        const request = {
          method: 'POST',
          context: {
            solutionId: 'tenant-123',
            isAnonymous: true,
          },
        };

        reflector.getAllAndOverride.mockReturnValue(false);

        const context = createMockContext(request);

        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      });
    });

    describe('Cross-Solution Resolution', () => {
      it('should use request.solutionId (target) over context.solutionId (caller)', async () => {
        const request = {
          method: 'GET',
          params: { id: 'skill-123' },
          solutionId: 'tenant-target',
          context: {
            solutionId: 'tenant-caller',
            userId: 'user-123',
            apiKeyScopes: ['admin'],
            userTenant: { role: 'admin', isActive: true },
          },
        };

        reflector.getAllAndOverride.mockReturnValue(false);
        skillsService.findOne.mockResolvedValue({
          id: 'skill-123',
          scope: 'solution',
        } as any);

        const context = createMockContext(request);
        const result = await guard.canActivate(context);

        expect(result).toBe(true);
        expect(skillsService.findOne).toHaveBeenCalledWith('tenant-target', 'skill-123');
      });

      it('should fall back to context.solutionId when request.solutionId is absent', async () => {
        const request = {
          method: 'GET',
          params: { id: 'skill-456' },
          // no request.solutionId — SolutionAuthGuard not applied or no header
          context: {
            solutionId: 'tenant-from-context',
            userId: 'user-123',
            userTenant: { role: 'admin', isActive: true },
          },
        };

        reflector.getAllAndOverride.mockReturnValue(false);
        skillsService.findOne.mockResolvedValue({
          id: 'skill-456',
          scope: 'solution',
        } as any);

        const context = createMockContext(request);
        const result = await guard.canActivate(context);

        expect(result).toBe(true);
        expect(skillsService.findOne).toHaveBeenCalledWith('tenant-from-context', 'skill-456');
      });
    });

    describe('Edge Cases', () => {
      it('should handle missing userTenant gracefully', async () => {
        const request = {
          method: 'POST',
          context: {
            solutionId: 'tenant-123',
            userId: 'user-123',
            // No userTenant
          },
        };

        reflector.getAllAndOverride.mockReturnValue(false);

        const context = createMockContext(request);

        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      });

      it('should handle skill not found', async () => {
        const request = {
          method: 'PATCH',
          params: { id: 'skill-999' },
          context: {
            solutionId: 'tenant-123',
            userId: 'user-123',
            userTenant: { role: 'admin', isActive: true },
          },
        };

        reflector.getAllAndOverride.mockReturnValue(false);
        skillsService.findOne.mockResolvedValue(null);

        const context = createMockContext(request);

        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      });

      it('should handle skills without createdBy (legacy)', async () => {
        const request = {
          method: 'PATCH',
          params: { id: 'skill-123' },
          context: {
            solutionId: 'tenant-123',
            userId: 'user-123',
            userTenant: { role: 'developer', isActive: true },
          },
        };

        reflector.getAllAndOverride.mockReturnValue(false);
        skillsService.findOne.mockResolvedValue({
          id: 'skill-123',
          createdBy: null, // Legacy skill
          scope: 'solution',
        } as any);

        const context = createMockContext(request);
        const result = await guard.canActivate(context);

        // Should allow since it's a legacy tenant skill
        expect(result).toBe(true);
      });
    });
  });
});
