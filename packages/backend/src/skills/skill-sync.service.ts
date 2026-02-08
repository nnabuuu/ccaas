/**
 * Skill Sync Service
 *
 * Syncs skills from the database to a session workspace so that
 * Claude CLI can load them from .claude/skills/ directory.
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SkillsService } from './skills.service';

export interface SyncResult {
  skillCount: number;
  skills: string[]; // Skill slugs
  skillIds: string[]; // Week 3: Skill IDs for precise session tracking
  durationMs: number;
  warnings: string[];
}

export interface SyncOptions {
  publishedOnly?: boolean;
  skillSlugs?: string[];
  includeManifest?: boolean;
}

@Injectable()
export class SkillSyncService {
  private readonly logger = new Logger(SkillSyncService.name);

  constructor(private readonly skillsService: SkillsService) {}

  /**
   * Sync skills from database to session workspace
   */
  async syncToSession(
    sessionDir: string,
    tenantId: string,
    options: SyncOptions = {},
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const syncedSkills: string[] = [];
    const syncedSkillIds: string[] = []; // Week 3: Track skill IDs

    const { publishedOnly = true, skillSlugs, includeManifest = false } = options;

    this.logger.log(`Syncing skills for tenant ${tenantId} to ${sessionDir}`);

    // Create .claude/skills directory in session workspace
    const skillsDir = path.join(sessionDir, '.claude', 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    // Get skills for tenant
    let skills = publishedOnly
      ? await this.skillsService.findPublished(tenantId)
      : (await this.skillsService.findAll(tenantId, { limit: 1000 })).items;

    // Filter by slugs if specified
    if (skillSlugs) {
      skills = skills.filter((s) => skillSlugs.includes(s.slug));
    }

    this.logger.log(`Found ${skills.length} skills to sync for tenant ${tenantId}`);

    // Sync each skill
    for (const skill of skills) {
      try {
        // Create skill directory
        const skillDir = path.join(skillsDir, skill.slug);
        await fs.mkdir(skillDir, { recursive: true });

        // Build SKILL.md with proper frontmatter for Claude Code
        const skillMdContent = this.buildSkillMd(skill);

        // Write SKILL.md
        await fs.writeFile(
          path.join(skillDir, 'SKILL.md'),
          skillMdContent,
          'utf-8',
        );

        // Optionally write manifest for debugging
        if (includeManifest) {
          await fs.writeFile(
            path.join(skillDir, 'manifest.json'),
            JSON.stringify(
              {
                id: skill.id,
                name: skill.name,
                slug: skill.slug,
                version: skill.currentVersion,
                type: skill.type,
                config: skill.config,
                allowedTools: skill.allowedTools,
                triggers: skill.triggers,
                syncedAt: new Date().toISOString(),
              },
              null,
              2,
            ),
            'utf-8',
          );
        }

        syncedSkills.push(skill.slug);
        syncedSkillIds.push(skill.id); // Week 3: Track skill ID
        this.logger.debug(`Synced skill: ${skill.name} (${skill.slug})`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        warnings.push(`Failed to sync skill ${skill.slug}: ${message}`);
        this.logger.warn(`Warning: ${warnings[warnings.length - 1]}`);
      }
    }

    const durationMs = Date.now() - startTime;

    this.logger.log(
      `Completed: ${syncedSkills.length} skills synced in ${durationMs}ms`,
    );

    return {
      skillCount: syncedSkills.length,
      skills: syncedSkills,
      skillIds: syncedSkillIds, // Week 3: Return skill IDs
      durationMs,
      warnings,
    };
  }

  /**
   * Sync a single skill to session workspace
   */
  async syncSingleSkill(
    sessionDir: string,
    tenantId: string,
    skillIdOrSlug: string,
  ): Promise<boolean> {
    const result = await this.syncToSession(sessionDir, tenantId, {
      skillSlugs: [skillIdOrSlug],
    });
    return result.skillCount > 0;
  }

  /**
   * Remove skills from session workspace
   */
  async clearSessionSkills(sessionDir: string): Promise<void> {
    const skillsDir = path.join(sessionDir, '.claude', 'skills');
    try {
      await fs.rm(skillsDir, { recursive: true, force: true });
      this.logger.log(`Cleared skills from ${sessionDir}`);
    } catch {
      // Directory might not exist
    }
  }

  /**
   * Check if a session has skills synced
   */
  async getSessionSkills(sessionDir: string): Promise<string[]> {
    const skillsDir = path.join(sessionDir, '.claude', 'skills');
    try {
      const entries = await fs.readdir(skillsDir, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  }

  /**
   * Write a test skill directly to session workspace (for testing)
   */
  async writeTestSkill(
    sessionDir: string,
    slug: string,
    content: string,
  ): Promise<void> {
    const skillDir = path.join(sessionDir, '.claude', 'skills', slug);
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), content, 'utf-8');
    this.logger.log(`Wrote test skill ${slug} to ${sessionDir}`);
  }

  /**
   * Build SKILL.md content with proper frontmatter for Claude Code
   *
   * Claude Code uses the frontmatter description to determine when to
   * automatically load and use a skill. The description should include
   * trigger keywords so Claude can discover the skill.
   */
  private buildSkillMd(skill: {
    slug: string;
    name: string;
    description?: string;
    content: string;
    triggers?: Array<{ type: string; value: string }>;
  }): string {
    // Build description that includes trigger keywords
    let description = skill.description || skill.name;

    // Append trigger keywords to description for better discovery
    if (skill.triggers && skill.triggers.length > 0) {
      const keywords = skill.triggers
        .filter((t) => t.type === 'keyword')
        .map((t) => t.value);

      if (keywords.length > 0) {
        description += ` Activate when user mentions: ${keywords.join(', ')}.`;
      }
    }

    // Escape any quotes in description for YAML
    const safeDescription = description.replace(/"/g, '\\"');

    // Build frontmatter
    const frontmatter = [
      '---',
      `name: ${skill.slug}`,
      `description: "${safeDescription}"`,
      '---',
    ].join('\n');

    // Combine frontmatter with content
    return `${frontmatter}\n\n${skill.content}`;
  }
}
