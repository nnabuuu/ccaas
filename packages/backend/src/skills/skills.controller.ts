/**
 * Skills Controller
 *
 * REST API for skill management.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { SkillsService } from './skills.service';
import {
  CreateSkillDto,
  UpdateSkillDto,
  ListSkillsDto,
  CreateVersionDto,
} from './dto/skill.dto';
import { TenantGuard } from '../tenants/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { ParseIdOrSlugPipe } from '../common/pipes/parse-id-or-slug.pipe';
import { SkillPermissionGuard } from './guards/skill-permission.guard';
import { CurrentUser, type CurrentUserData } from '../auth/decorators';

@Controller('api/v1/skills')
@UseGuards(TenantGuard, SkillPermissionGuard)
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  /**
   * List all skills for the tenant
   */
  @Get()
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() query: ListSkillsDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.skillsService.findAll(tenantId, query, currentUser.userId);
  }

  /**
   * Create a new skill
   */
  @Post()
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateSkillDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.skillsService.create(tenantId, dto, currentUser.userId);
  }

  /**
   * Get a skill by ID or slug
   */
  @Get(':id')
  async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const skill = await this.skillsService.findOneWithVersions(tenantId, id);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${id}`);
    }
    return skill;
  }

  /**
   * Update a skill
   */
  @Put(':id')
  async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSkillDto,
  ) {
    return this.skillsService.update(tenantId, id, dto);
  }

  /**
   * Archive (soft delete) a skill
   */
  @Delete(':id')
  async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    await this.skillsService.archive(tenantId, id);
    return { success: true };
  }

  /**
   * Publish a skill
   */
  @Post(':id/publish')
  async publish(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.skillsService.publish(tenantId, id);
  }

  /**
   * Unpublish a skill (set status back to draft)
   */
  @Post(':id/unpublish')
  async unpublish(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.skillsService.unpublish(tenantId, id);
  }

  /**
   * List versions of a skill
   */
  @Get(':id/versions')
  async listVersions(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const skill = await this.skillsService.findOne(tenantId, id);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${id}`);
    }
    return this.skillsService.listVersions(skill.id);
  }

  /**
   * Create a new version
   */
  @Post(':id/versions')
  async createVersion(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateVersionDto,
  ) {
    const skill = await this.skillsService.findOne(tenantId, id);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${id}`);
    }
    return this.skillsService.createVersion(skill.id, dto);
  }

  /**
   * Rollback to a specific version
   */
  @Post(':id/rollback/:version')
  async rollback(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('version') version: string,
  ) {
    return this.skillsService.rollbackToVersion(tenantId, id, version);
  }

  /**
   * Toggle skill enabled/disabled state
   */
  @Patch(':id/toggle')
  async toggle(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseIdOrSlugPipe) id: string,
  ) {
    return this.skillsService.toggle(tenantId, id);
  }
}
