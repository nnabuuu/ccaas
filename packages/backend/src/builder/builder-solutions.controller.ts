/**
 * Builder Solutions Controller
 *
 * Allows builder-scoped API keys to create and manage their own tenants.
 * All operations are scoped to tenants linked to the builder's user via UserSolution.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Auth, Ctx } from '../auth/decorators';
import { RequestContext } from '../auth/types';
import { SolutionsService } from '../solutions/solutions.service';
import { UserSolutionService } from '../users/user-solution.service';
import { AuditService } from '../admin/services/audit.service';
import { CreateTenantDto, UpdateTenantDto } from '../solutions/dto/solution.dto';
import type { Solution } from '../solutions/entities/solution.entity';
import { requireBuilderUserId, verifyBuilderTenantOwnership } from './builder.helpers';

@ApiTags('builder')
@Controller('api/v1/builder/solutions')
@Auth('builder')
export class BuilderSolutionsController {
  private readonly logger = new Logger(BuilderSolutionsController.name);

  constructor(
    private readonly tenantsService: SolutionsService,
    private readonly userTenantService: UserSolutionService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * POST /api/v1/builder/solutions
   *
   * Create a tenant and auto-link the builder as admin via UserSolution.
   */
  @Post()
  async create(
    @Body() dto: CreateTenantDto,
    @Ctx() ctx: RequestContext,
  ) {
    const userId = requireBuilderUserId(ctx);

    const result = await this.tenantsService.create(dto);

    // Auto-link builder user as admin of the new tenant
    await this.userTenantService.create({
      userId,
      solutionId: result.tenant.id,
      role: 'admin',
    });

    this.logger.log(
      `Builder ${userId} created tenant ${result.tenant.slug} and auto-linked as admin`,
    );

    await this.auditService.log({
      adminId: ctx.apiKeyId || userId,
      action: 'solution.create',
      targetType: 'solution',
      targetId: result.tenant.id,
      solutionId: result.tenant.id,
      metadata: {
        name: dto.name,
        slug: result.tenant.slug,
        builderUserId: userId,
      },
    });

    return result;
  }

  /**
   * GET /api/v1/builder/solutions
   *
   * List tenants owned by the builder (filtered by UserSolution).
   */
  @Get()
  async findAll(@Ctx() ctx: RequestContext): Promise<Solution[]> {
    const userId = requireBuilderUserId(ctx);

    const userTenants = await this.userTenantService.findByUser(userId);
    const tenants: Solution[] = [];

    for (const ut of userTenants) {
      if (ut.tenant && ut.tenant.status === 'active') {
        tenants.push(ut.tenant);
      }
    }

    return tenants;
  }

  /**
   * GET /api/v1/builder/solutions/:id
   *
   * Get a tenant owned by the builder.
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
  ): Promise<Solution> {
    const userId = requireBuilderUserId(ctx);
    return verifyBuilderTenantOwnership(userId, id, this.tenantsService, this.userTenantService);
  }

  /**
   * PUT /api/v1/builder/solutions/:id
   *
   * Update a tenant owned by the builder.
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
    @Ctx() ctx: RequestContext,
  ): Promise<Solution> {
    const userId = requireBuilderUserId(ctx);
    await verifyBuilderTenantOwnership(userId, id, this.tenantsService, this.userTenantService);

    const updated = await this.tenantsService.update(id, dto);

    await this.auditService.log({
      adminId: ctx.apiKeyId || userId,
      action: 'solution.update',
      targetType: 'solution',
      targetId: id,
      solutionId: id,
      metadata: {
        builderUserId: userId,
        changes: dto,
      },
    });

    return updated;
  }
}
