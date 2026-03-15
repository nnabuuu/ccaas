/**
 * Admin Skills Controller
 *
 * Extended skill management for admins including version history and rollback.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  NotFoundException,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthAdminOrBuilder, TenantId, Ctx } from '../../auth/decorators';
import { AdminTenantAccessGuard } from '../guards/admin-tenant-access.guard';
import { RequestContext } from '../../auth/types';
import { SkillsService } from '../../skills/skills.service';
import { SkillVersion } from '../../skills/entities/skill-version.entity';
import { Skill } from '../../skills/entities/skill.entity';
import { UpsertSkillFilesDto } from '../../skills/dto/skill-file.dto';
import { AuditService } from '../services/audit.service';
import { VersionDiff } from '../dto/admin.dto';

@Controller('api/v1/admin/skills')
@AuthAdminOrBuilder()
@UseGuards(AdminTenantAccessGuard)
export class AdminSkillsController {
  constructor(
    private readonly skillsService: SkillsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * GET /api/v1/admin/skills
   *
   * List all skills with pagination
   */
  @Get()
  async findAll(
    @Query('tenantId') tenantId?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @TenantId() defaultTenantId?: string,
  ): Promise<{ skills: any[]; total: number }> {
    // Admin can query any tenant by passing tenantId parameter
    const targetTenantId = tenantId || defaultTenantId;

    if (!targetTenantId) {
      throw new NotFoundException('Tenant ID is required');
    }

    const result = await this.skillsService.findAll(targetTenantId, {
      page: Number(page),
      limit: Number(limit),
    });

    return {
      skills: result.items.map(skill => ({
        id: skill.id,
        tenantId: skill.tenantId,
        name: skill.name,
        slug: skill.slug,
        description: skill.description,
        type: skill.type,
        status: skill.status,
        enabled: skill.enabled,
        currentVersion: skill.currentVersion,
        createdAt: skill.createdAt,
        updatedAt: skill.updatedAt,
      })),
      total: result.total,
    };
  }

  /**
   * GET /api/v1/admin/skills/:idOrSlug/versions
   *
   * Get version history for a skill
   */
  @Get(':idOrSlug/versions')
  async getVersionHistory(
    @TenantId() defaultTenantId: string,
    @Param('idOrSlug') idOrSlug: string,
    @Query('tenantId') tenantId?: string,
  ): Promise<SkillVersion[]> {
    // Admin can query any tenant by passing tenantId parameter
    const targetTenantId = tenantId || defaultTenantId;

    const skill = await this.skillsService.findOne(targetTenantId, idOrSlug);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${idOrSlug}`);
    }

    return this.skillsService.listVersions(skill.id);
  }

  /**
   * GET /api/v1/admin/skills/:idOrSlug/versions/:version
   *
   * Get a specific version of a skill
   */
  @Get(':idOrSlug/versions/:version')
  async getVersion(
    @TenantId() tenantId: string,
    @Param('idOrSlug') idOrSlug: string,
    @Param('version') version: string,
  ): Promise<SkillVersion> {
    const skill = await this.skillsService.findOneWithVersions(tenantId, idOrSlug);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${idOrSlug}`);
    }

    const skillVersion = skill.versions?.find((v) => v.version === version);
    if (!skillVersion) {
      throw new NotFoundException(`Version not found: ${version}`);
    }

    return skillVersion;
  }

  /**
   * POST /api/v1/admin/skills/:idOrSlug/rollback/:version
   *
   * Rollback a skill to a previous version
   */
  @Post(':idOrSlug/rollback/:version')
  @HttpCode(HttpStatus.OK)
  async rollbackToVersion(
    @TenantId() tenantId: string,
    @Param('idOrSlug') idOrSlug: string,
    @Param('version') version: string,
    @Ctx() ctx: RequestContext,
  ): Promise<Skill> {
    const adminId = ctx.apiKeyId || ctx.tenantId;

    try {
      const skill = await this.skillsService.rollbackToVersion(tenantId, idOrSlug, version);

      await this.auditService.logSuccess(
        adminId,
        'skill.rollback',
        'skill',
        skill.id,
        { version, previousVersion: skill.currentVersion },
        tenantId,
      );

      return skill;
    } catch (error) {
      const skill = await this.skillsService.findOne(tenantId, idOrSlug);
      await this.auditService.logFailure(
        adminId,
        'skill.rollback',
        'skill',
        skill?.id || idOrSlug,
        error instanceof Error ? error.message : 'Unknown error',
        { version },
        tenantId,
      );
      throw error;
    }
  }

  /**
   * GET /api/v1/admin/skills/:idOrSlug/diff
   *
   * Get diff between two versions
   */
  @Get(':idOrSlug/diff')
  async getVersionDiff(
    @TenantId() tenantId: string,
    @Param('idOrSlug') idOrSlug: string,
    @Query('v1') version1: string,
    @Query('v2') version2: string,
  ): Promise<VersionDiff> {
    const skill = await this.skillsService.findOneWithVersions(tenantId, idOrSlug);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${idOrSlug}`);
    }

    const v1 = skill.versions?.find((v) => v.version === version1);
    const v2 = skill.versions?.find((v) => v.version === version2);

    if (!v1) {
      throw new NotFoundException(`Version not found: ${version1}`);
    }
    if (!v2) {
      throw new NotFoundException(`Version not found: ${version2}`);
    }

    // Simple diff - in production, use a proper diff library
    const contentDiff = this.generateSimpleDiff(v1.content, v2.content);
    const configDiff = this.generateSimpleDiff(
      JSON.stringify(v1.config, null, 2),
      JSON.stringify(v2.config, null, 2),
    );

    // Tools diff
    const toolsInV1 = new Set(v1.allowedTools || []);
    const toolsInV2 = new Set(v2.allowedTools || []);
    const addedTools = [...toolsInV2].filter((t) => !toolsInV1.has(t)).map((t) => `+ ${t}`);
    const removedTools = [...toolsInV1].filter((t) => !toolsInV2.has(t)).map((t) => `- ${t}`);

    return {
      version1,
      version2,
      contentDiff,
      configDiff,
      toolsDiff: [...removedTools, ...addedTools],
    };
  }

  /**
   * GET /api/v1/admin/skills/:idOrSlug
   *
   * Get skill details by ID or slug (includes files metadata)
   */
  @Get(':idOrSlug')
  async findOne(
    @TenantId() defaultTenantId: string,
    @Param('idOrSlug') idOrSlug: string,
    @Query('tenantId') tenantId?: string,
  ) {
    // Admin can query any tenant by passing tenantId parameter
    const targetTenantId = tenantId || defaultTenantId;

    const skill = await this.skillsService.findOneWithVersions(targetTenantId, idOrSlug);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${idOrSlug}`);
    }

    // Include files metadata
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
   * POST /api/v1/admin/skills/:idOrSlug/publish
   *
   * Publish a skill with audit logging
   */
  @Post(':idOrSlug/publish')
  @HttpCode(HttpStatus.OK)
  async publishSkill(
    @TenantId() tenantId: string,
    @Param('idOrSlug') idOrSlug: string,
    @Ctx() ctx: RequestContext,
  ): Promise<Skill> {
    const adminId = ctx.apiKeyId || ctx.tenantId;

    const skill = await this.skillsService.publish(tenantId, idOrSlug);

    await this.auditService.logSuccess(
      adminId,
      'skill.publish',
      'skill',
      skill.id,
      { version: skill.currentVersion },
      tenantId,
    );

    return skill;
  }

  /**
   * POST /api/v1/admin/skills/:idOrSlug/archive
   *
   * Archive a skill with audit logging
   */
  @Post(':idOrSlug/archive')
  @HttpCode(HttpStatus.OK)
  async archiveSkill(
    @TenantId() tenantId: string,
    @Param('idOrSlug') idOrSlug: string,
    @Ctx() ctx: RequestContext,
  ): Promise<{ success: boolean }> {
    const adminId = ctx.apiKeyId || ctx.tenantId;
    const skill = await this.skillsService.findOne(tenantId, idOrSlug);

    if (!skill) {
      throw new NotFoundException(`Skill not found: ${idOrSlug}`);
    }

    await this.skillsService.archive(tenantId, idOrSlug);

    await this.auditService.logSuccess(
      adminId,
      'skill.archive',
      'skill',
      skill.id,
      { name: skill.name },
      tenantId,
    );

    return { success: true };
  }

  // ===========================================================================
  // Skill File Endpoints
  // ===========================================================================

  /**
   * GET /api/v1/admin/skills/:idOrSlug/files
   *
   * List all files for a skill
   */
  @Get(':idOrSlug/files')
  async listFiles(
    @TenantId() tenantId: string,
    @Param('idOrSlug') idOrSlug: string,
    @Query('tenantId') queryTenantId?: string,
  ) {
    const targetTenantId = queryTenantId || tenantId;
    const skill = await this.skillsService.findOne(targetTenantId, idOrSlug);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${idOrSlug}`);
    }
    return this.skillsService.getSkillFiles(skill.id);
  }

  /**
   * GET /api/v1/admin/skills/:idOrSlug/files/:fileId
   *
   * Get a single file with content
   */
  @Get(':idOrSlug/files/:fileId')
  async getFile(
    @TenantId() defaultTenantId: string,
    @Param('idOrSlug') idOrSlug: string,
    @Param('fileId') fileId: string,
    @Query('tenantId') queryTenantId?: string,
  ) {
    const targetTenantId = queryTenantId || defaultTenantId;
    const skill = await this.skillsService.findOne(targetTenantId, idOrSlug);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${idOrSlug}`);
    }
    const file = await this.skillsService.getSkillFile(skill.id, fileId);
    if (!file) {
      throw new NotFoundException(`File not found: ${fileId}`);
    }
    return file;
  }

  /**
   * PUT /api/v1/admin/skills/:idOrSlug/files
   *
   * Batch upsert files for a skill
   */
  @Put(':idOrSlug/files')
  async upsertFiles(
    @TenantId() defaultTenantId: string,
    @Param('idOrSlug') idOrSlug: string,
    @Body() dto: UpsertSkillFilesDto,
    @Query('tenantId') queryTenantId?: string,
  ) {
    const targetTenantId = queryTenantId || defaultTenantId;
    const skill = await this.skillsService.findOne(targetTenantId, idOrSlug);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${idOrSlug}`);
    }
    return this.skillsService.upsertFiles(skill.id, dto.files);
  }

  /**
   * DELETE /api/v1/admin/skills/:idOrSlug/files/:relativePath
   *
   * Delete a file by relativePath
   */
  @Delete(':idOrSlug/files/:relativePath(*)')
  async deleteFile(
    @TenantId() defaultTenantId: string,
    @Param('idOrSlug') idOrSlug: string,
    @Param('relativePath') relativePath: string,
    @Query('tenantId') queryTenantId?: string,
  ) {
    const targetTenantId = queryTenantId || defaultTenantId;
    const skill = await this.skillsService.findOne(targetTenantId, idOrSlug);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${idOrSlug}`);
    }
    await this.skillsService.deleteFile(skill.id, relativePath);
    return { success: true };
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private generateSimpleDiff(text1: string, text2: string): string {
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');

    const diff: string[] = [];
    const maxLength = Math.max(lines1.length, lines2.length);

    for (let i = 0; i < maxLength; i++) {
      const line1 = lines1[i];
      const line2 = lines2[i];

      if (line1 === undefined) {
        diff.push(`+ ${line2}`);
      } else if (line2 === undefined) {
        diff.push(`- ${line1}`);
      } else if (line1 !== line2) {
        diff.push(`- ${line1}`);
        diff.push(`+ ${line2}`);
      } else {
        diff.push(`  ${line1}`);
      }
    }

    return diff.join('\n');
  }
}
