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
import { SolutionAuthGuard } from '../solutions/solution-auth.guard';
import { CurrentTenant } from '../common/decorators/current-solution.decorator';
import { ParseIdOrSlugPipe } from '../common/pipes/parse-id-or-slug.pipe';
import { SkillPermissionGuard } from './guards/skill-permission.guard';
import { OptionalAuth, Auth, CurrentUser, type CurrentUserData } from '../auth/decorators';

@ApiTags('skills')
@Controller('api/v1/skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  /**
   * List all skills for the tenant (anonymous read allowed)
   */
  @Get()
  @UseGuards(SolutionAuthGuard, SkillPermissionGuard)
  @OptionalAuth()
  async findAll(
    @CurrentTenant() solutionId: string,
    @Query() query: ListSkillsDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.skillsService.findAll(solutionId, query, currentUser?.userId);
  }

  /**
   * Create a new skill (requires auth)
   */
  @Post()
  @UseGuards(SolutionAuthGuard, SkillPermissionGuard)
  @Auth('skills:write')
  async create(
    @CurrentTenant() solutionId: string,
    @Body() dto: CreateSkillDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.skillsService.create(solutionId, dto, currentUser.userId);
  }

  /**
   * Get a skill by ID or slug (anonymous read allowed)
   */
  @Get(':id')
  @UseGuards(SolutionAuthGuard, SkillPermissionGuard)
  @OptionalAuth()
  async findOne(
    @CurrentTenant() solutionId: string,
    @Param('id') id: string,
  ) {
    const skill = await this.skillsService.findOneWithVersions(solutionId, id);
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
  @UseGuards(SolutionAuthGuard, SkillPermissionGuard)
  @Auth('skills:write')
  async update(
    @CurrentTenant() solutionId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSkillDto,
  ) {
    return this.skillsService.update(solutionId, id, dto);
  }

  /**
   * Archive (soft delete) a skill
   */
  @Delete(':id')
  @UseGuards(SolutionAuthGuard, SkillPermissionGuard)
  @Auth('skills:write')
  async remove(
    @CurrentTenant() solutionId: string,
    @Param('id') id: string,
  ) {
    await this.skillsService.archive(solutionId, id);
    return { success: true };
  }

  /**
   * Publish a skill
   */
  @Post(':id/publish')
  @UseGuards(SolutionAuthGuard, SkillPermissionGuard)
  @Auth('skills:write')
  async publish(
    @CurrentTenant() solutionId: string,
    @Param('id') id: string,
  ) {
    return this.skillsService.publish(solutionId, id);
  }

  /**
   * Unpublish a skill (set status back to draft)
   */
  @Post(':id/unpublish')
  @UseGuards(SolutionAuthGuard, SkillPermissionGuard)
  @Auth('skills:write')
  async unpublish(
    @CurrentTenant() solutionId: string,
    @Param('id') id: string,
  ) {
    return this.skillsService.unpublish(solutionId, id);
  }

  /**
   * List versions of a skill
   */
  @Get(':id/versions')
  @UseGuards(SolutionAuthGuard, SkillPermissionGuard)
  @OptionalAuth()
  async listVersions(
    @CurrentTenant() solutionId: string,
    @Param('id') id: string,
  ) {
    const skill = await this.skillsService.findOne(solutionId, id);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${id}`);
    }
    return this.skillsService.listVersions(skill.id);
  }

  /**
   * Create a new version
   */
  @Post(':id/versions')
  @UseGuards(SolutionAuthGuard, SkillPermissionGuard)
  @Auth('skills:write')
  async createVersion(
    @CurrentTenant() solutionId: string,
    @Param('id') id: string,
    @Body() dto: CreateVersionDto,
  ) {
    const skill = await this.skillsService.findOne(solutionId, id);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${id}`);
    }
    return this.skillsService.createVersion(skill.id, dto);
  }

  /**
   * Rollback to a specific version
   */
  @Post(':id/rollback/:version')
  @UseGuards(SolutionAuthGuard, SkillPermissionGuard)
  @Auth('skills:write')
  async rollback(
    @CurrentTenant() solutionId: string,
    @Param('id') id: string,
    @Param('version') version: string,
  ) {
    return this.skillsService.rollbackToVersion(solutionId, id, version);
  }

  /**
   * Toggle skill enabled/disabled state
   */
  @Patch(':id/toggle')
  @UseGuards(SolutionAuthGuard, SkillPermissionGuard)
  @Auth('skills:write')
  async toggle(
    @CurrentTenant() solutionId: string,
    @Param('id', ParseIdOrSlugPipe) id: string,
  ) {
    return this.skillsService.toggle(solutionId, id);
  }

  // =========================================================================
  // Skill File Endpoints
  // =========================================================================

  /**
   * List all files for a skill (metadata only, no content)
   */
  @Get(':id/files')
  @UseGuards(SolutionAuthGuard, SkillPermissionGuard)
  @OptionalAuth()
  async listFiles(
    @CurrentTenant() solutionId: string,
    @Param('id') id: string,
  ) {
    const skill = await this.skillsService.findOne(solutionId, id);
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
  @UseGuards(SolutionAuthGuard, SkillPermissionGuard)
  @OptionalAuth()
  async getFile(
    @CurrentTenant() solutionId: string,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ) {
    const skill = await this.skillsService.findOne(solutionId, id);
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
  @UseGuards(SolutionAuthGuard, SkillPermissionGuard)
  @Auth('skills:write')
  async upsertFiles(
    @CurrentTenant() solutionId: string,
    @Param('id') id: string,
    @Body() dto: UpsertSkillFilesDto,
  ) {
    const skill = await this.skillsService.findOne(solutionId, id);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${id}`);
    }
    return this.skillsService.upsertFiles(skill.id, dto.files);
  }

  /**
   * Delete a single file by relativePath
   */
  @Delete(':id/files/:relativePath(*)')
  @UseGuards(SolutionAuthGuard, SkillPermissionGuard)
  @Auth('skills:write')
  async deleteFile(
    @CurrentTenant() solutionId: string,
    @Param('id') id: string,
    @Param('relativePath') relativePath: string,
  ) {
    const skill = await this.skillsService.findOne(solutionId, id);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${id}`);
    }
    await this.skillsService.deleteFile(skill.id, relativePath);
    return { success: true };
  }
}
