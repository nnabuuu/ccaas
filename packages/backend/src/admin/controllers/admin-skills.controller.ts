/**
 * Admin Skills Controller
 *
 * Extended skill management for admins including version history and rollback.
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Auth, TenantId, Ctx } from '../../auth/decorators';
import { RequestContext } from '../../auth/types';
import { SkillsService } from '../../skills/skills.service';
import { SkillVersion } from '../../skills/entities/skill-version.entity';
import { Skill } from '../../skills/entities/skill.entity';
import { AuditService } from '../services/audit.service';
import { VersionDiff } from '../dto/admin.dto';

@Controller('api/v1/admin/skills')
@Auth('admin')
export class AdminSkillsController {
  constructor(
    private readonly skillsService: SkillsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * GET /api/v1/admin/skills/:idOrSlug/versions
   *
   * Get version history for a skill
   */
  @Get(':idOrSlug/versions')
  async getVersionHistory(
    @TenantId() tenantId: string,
    @Param('idOrSlug') idOrSlug: string,
  ): Promise<SkillVersion[]> {
    const skill = await this.skillsService.findOne(tenantId, idOrSlug);
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
