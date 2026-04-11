/**
 * Skill Permission Guard
 *
 * Enforces role-based access control for skill operations
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SkillsService } from '../skills.service';
import { UserTenantService } from '../../users/user-tenant.service';
import { IS_PUBLIC_KEY } from '../../auth/decorators';
import type { RequestContext } from '../../auth/types';

@Injectable()
export class SkillPermissionGuard implements CanActivate {
  private readonly logger = new Logger(SkillPermissionGuard.name);

  constructor(
    private readonly skillsService: SkillsService,
    private readonly userTenantService: UserTenantService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const skillId = request.params?.id;
    const requestContext: RequestContext | undefined = request.context;
    // Use operation target tenant (set by TenantGuard), not caller identity tenant
    const tenantId: string | undefined = request.tenantId ?? requestContext?.tenantId;

    // READ operations (GET)
    if (method === 'GET' && skillId) {
      return this.checkReadPermission(skillId, tenantId, requestContext);
    }

    // WRITE operations (POST, PUT, PATCH, DELETE)
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return this.checkWritePermission(method, skillId, tenantId, requestContext);
    }

    // LIST operations (GET without ID) — allow for OptionalAuth routes
    // even if anonymous (tenantId still required via TenantGuard)
    return true;
  }

  /**
   * Check read permission for a specific skill
   */
  private async checkReadPermission(
    skillId: string,
    tenantId: string | undefined,
    context: RequestContext | undefined,
  ): Promise<boolean> {
    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    const skill = await this.skillsService.findOne(tenantId, skillId);

    if (!skill) {
      throw new ForbiddenException('Skill not found');
    }

    // Tenant-scoped skills are readable by all (including anonymous)
    if (skill.scope === 'tenant') {
      return true;
    }

    // Personal skills require authentication
    if (skill.scope === 'personal') {
      if (!context || context.isAnonymous) {
        throw new ForbiddenException('Authentication required to access personal skills');
      }

      // Admin can read all personal skills
      if (context.userTenant?.role === 'admin') {
        return true;
      }

      // Users can only read their own personal skills
      if (skill.createdBy === context.userId) {
        return true;
      }

      throw new ForbiddenException('You do not have permission to access this personal skill');
    }

    return true;
  }

  /**
   * Check write permission for skill operations
   */
  private async checkWritePermission(
    method: string,
    skillId: string | undefined,
    tenantId: string | undefined,
    context: RequestContext | undefined,
  ): Promise<boolean> {
    // Admin-scoped API keys bypass role-based permission checks
    if (context?.apiKeyScopes?.includes('admin')) {
      if (!tenantId) {
        throw new ForbiddenException('Tenant context required');
      }
      return true;
    }

    // Anonymous users cannot write
    if (!context || context.isAnonymous) {
      throw new ForbiddenException('Authentication required for this operation');
    }

    // Tenant-level API keys with skills:write scope (for system/automation)
    // These are API keys without userId, representing the tenant itself
    if (context.apiKeyScopes?.includes('skills:write') && !context.userId) {
      this.logger.log(`Allowing tenant-level write operation via API key with skills:write scope`);
      return true;
    }

    // User-level operations require userTenant
    if (!context.userTenant) {
      throw new ForbiddenException('User tenant information required');
    }

    // CREATE operation (POST without ID)
    if (method === 'POST' && !skillId) {
      return this.checkCreatePermission(context);
    }

    // UPDATE/DELETE operations require checking existing skill
    if (skillId) {
      return this.checkModifyPermission(skillId, tenantId, context);
    }

    return true;
  }

  /**
   * Check permission to create new skills
   */
  private checkCreatePermission(context: RequestContext): boolean {
    const { userTenant } = context;

    if (!userTenant) {
      throw new ForbiddenException('User tenant information required');
    }

    // Check canCreateSkills flag
    if (!userTenant.canCreateSkills) {
      throw new ForbiddenException('You do not have permission to create skills');
    }

    return true;
  }

  /**
   * Check permission to modify existing skill
   */
  private async checkModifyPermission(
    skillId: string,
    tenantId: string | undefined,
    context: RequestContext,
  ): Promise<boolean> {
    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    const skill = await this.skillsService.findOne(tenantId, skillId);

    if (!skill) {
      throw new ForbiddenException('Skill not found');
    }

    // Allow API keys with skills:write scope (for bootstrap/automation)
    if (context.apiKeyScopes?.includes('skills:write')) {
      this.logger.log(`Allowing modify operation via API key with skills:write scope`);
      return true;
    }

    const { userId, userTenant } = context;

    if (!userTenant) {
      throw new ForbiddenException('User tenant information required');
    }

    // Legacy skills without createdBy can be edited by anyone with write permissions
    if (!skill.createdBy) {
      return userTenant.role === 'admin' || userTenant.role === 'developer';
    }

    // Use UserTenantService to check if user can edit this resource
    const canEdit = this.userTenantService.canEditResource(
      userTenant,
      skill.createdBy,
      userId || '',
    );

    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to modify this skill');
    }

    return true;
  }
}
