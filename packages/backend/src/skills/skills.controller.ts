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
import { ApiTags } from '@nestjs/swagger';
import { SkillsService } from './skills.service';
import {
  CreateSkillDto,
  UpdateSkillDto,
  ListSkillsDto,
  CreateVersionDto,
} from './dto/skill.dto';
import { UpsertSkillFilesDto } from './dto/skill-file.dto';
import { TenantGuard } from '../tenants/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { ParseIdOrSlugPipe } from '../common/pipes/parse-id-or-slug.pipe';
import { SkillPermissionGuard } from './guards/skill-permission.guard';
import { CurrentUser, type CurrentUserData } from '../auth/decorators';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';

@ApiTags('skills')
@Controller('api/v1/skills')
@UseGuards(ApiKeyGuard, TenantGuard, SkillPermissionGuard)
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
   * Get a skill by ID or slug (includes files metadata)
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

    // Include files metadata (without content for efficiency)
    const files = await this.skillsService.getSkillFiles(skill.id);
    return {
      ...skill,
      files: files.map((f) => ({
        id: f.id,
        relativePath: f.relativePath,
        contentHash: f.contentHash,
      })),
    };
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

  // =========================================================================
  // Skill File Endpoints
  // =========================================================================

  /**
   * List all files for a skill (metadata only, no content)
   */
  @Get(':id/files')
  async listFiles(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const skill = await this.skillsService.findOne(tenantId, id);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${id}`);
    }
    const files = await this.skillsService.getSkillFiles(skill.id);
    return files.map((f) => ({
      id: f.id,
      relativePath: f.relativePath,
      contentHash: f.contentHash,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));
  }

  /**
   * Get a single file with content
   */
  @Get(':id/files/:fileId')
  async getFile(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ) {
    const skill = await this.skillsService.findOne(tenantId, id);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${id}`);
    }
    const file = await this.skillsService.getSkillFile(skill.id, fileId);
    if (!file) {
      throw new NotFoundException(`File not found: ${fileId}`);
    }
    return file;
  }

  /**
   * Batch upsert files for a skill
   */
  @Put(':id/files')
  async upsertFiles(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpsertSkillFilesDto,
  ) {
    const skill = await this.skillsService.findOne(tenantId, id);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${id}`);
    }
    return this.skillsService.upsertFiles(skill.id, dto.files);
  }

  /**
   * Delete a single file by relativePath
   */
  @Delete(':id/files/:relativePath(*)')
  async deleteFile(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('relativePath') relativePath: string,
  ) {
    const skill = await this.skillsService.findOne(tenantId, id);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${id}`);
    }
    await this.skillsService.deleteFile(skill.id, relativePath);
    return { success: true };
  }
}
