/**
 * Solution Loader Service
 *
 * Orchestrates the full registration flow for discovered solutions:
 *   1. Scan solutions directory (via SolutionScannerService)
 *   2. Parse SKILL.md metadata (via SkillMetadataParserService)
 *   3. Ensure tenant exists (via TenantsService)
 *   4. Register skills with upsert logic (via SkillsService)
 *   5. Register MCP servers with upsert logic (via McpPoolService)
 *
 * Provides:
 *   - loadAll()  - Auto-discover and register all enabled solutions
 *   - loadOne()  - Register a single solution by slug
 *   - getStatus() - Health check / registration status
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SolutionScannerService, type SolutionMetadata } from './solution-scanner.service';
import { SkillMetadataParserService } from './skill-metadata-parser.service';
import { TenantsService } from '../tenants/tenants.service';
import { SkillsService } from '../skills/skills.service';
import { McpPoolService, type CreateMcpServerDto } from '../mcp/mcp-pool.service';
import type { SolutionConfigV2, SkillDefinition, McpServerDefinition } from './dto/solution-config.dto';

// ============================================================================
// Types
// ============================================================================

export interface LoadResult {
  slug: string;
  name: string;
  tenantId: string;
  skills: SkillLoadResult[];
  mcpServers: McpServerLoadResult[];
  warnings: string[];
}

export interface SkillLoadResult {
  slug: string;
  name: string;
  action: 'created' | 'updated' | 'skipped';
  skillId?: string;
  error?: string;
}

export interface McpServerLoadResult {
  slug: string;
  name: string;
  action: 'created' | 'updated' | 'skipped';
  serverId?: string;
  error?: string;
}

export interface LoadAllResult {
  loaded: LoadResult[];
  failed: Array<{ slug: string; error: string }>;
  totalSolutions: number;
  totalSkills: number;
  totalMcpServers: number;
}

export interface LoaderStatus {
  lastLoadAt: Date | null;
  solutionsLoaded: number;
  skillsRegistered: number;
  mcpServersRegistered: number;
  errors: string[];
}

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class SolutionLoaderService {
  private readonly logger = new Logger(SolutionLoaderService.name);
  private status: LoaderStatus = {
    lastLoadAt: null,
    solutionsLoaded: 0,
    skillsRegistered: 0,
    mcpServersRegistered: 0,
    errors: [],
  };

  constructor(
    private readonly scanner: SolutionScannerService,
    private readonly parser: SkillMetadataParserService,
    private readonly tenants: TenantsService,
    private readonly skills: SkillsService,
    private readonly mcpPool: McpPoolService,
  ) {}

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Scan and register all discovery-enabled solutions.
   */
  async loadAll(solutionsDir?: string): Promise<LoadAllResult> {
    this.logger.log('Starting auto-discovery of solutions...');

    const solutions = await this.scanner.scanSolutions(solutionsDir);
    const result: LoadAllResult = {
      loaded: [],
      failed: [],
      totalSolutions: solutions.length,
      totalSkills: 0,
      totalMcpServers: 0,
    };

    for (const solution of solutions) {
      try {
        const loadResult = await this.loadSolution(solution);
        result.loaded.push(loadResult);
        result.totalSkills += loadResult.skills.filter(
          (s) => s.action !== 'skipped' && !s.error,
        ).length;
        result.totalMcpServers += loadResult.mcpServers.filter(
          (m) => m.action !== 'skipped' && !m.error,
        ).length;
      } catch (err) {
        const error = (err as Error).message;
        this.logger.error(`Failed to load solution "${solution.slug}": ${error}`);
        result.failed.push({ slug: solution.slug, error });
      }
    }

    // Update status
    this.status = {
      lastLoadAt: new Date(),
      solutionsLoaded: result.loaded.length,
      skillsRegistered: result.totalSkills,
      mcpServersRegistered: result.totalMcpServers,
      errors: result.failed.map((f) => `${f.slug}: ${f.error}`),
    };

    this.logger.log(
      `Auto-discovery complete: ${result.loaded.length} solution(s) loaded, ` +
      `${result.failed.length} failed, ` +
      `${result.totalSkills} skill(s), ${result.totalMcpServers} MCP server(s)`,
    );

    return result;
  }

  /**
   * Load a single solution by slug from the solutions directory.
   */
  async loadOne(slug: string, solutionsDir?: string): Promise<LoadResult> {
    this.logger.log(`Loading solution: ${slug}`);

    const solutions = await this.scanner.scanSolutions(solutionsDir);
    const solution = solutions.find((s) => s.slug === slug);

    if (!solution) {
      throw new Error(
        `Solution "${slug}" not found or discovery is disabled`,
      );
    }

    return this.loadSolution(solution);
  }

  /**
   * Get loader health/status information.
   */
  getStatus(): LoaderStatus {
    return { ...this.status };
  }

  // --------------------------------------------------------------------------
  // Core Registration Flow
  // --------------------------------------------------------------------------

  /**
   * Register a single solution: ensure tenant, register skills, register MCP servers.
   */
  private async loadSolution(solution: SolutionMetadata): Promise<LoadResult> {
    const config = solution.config;
    const warnings = [...solution.warnings];

    // Step 1: Ensure tenant exists
    const tenantId = await this.ensureTenant(config, warnings);

    // Step 2: Register skills
    const skillResults = await this.registerSkills(
      tenantId,
      config,
      solution.solutionPath,
      warnings,
    );

    // Step 3: Register MCP servers
    const mcpResults = await this.registerMcpServers(
      tenantId,
      config,
      warnings,
    );

    this.logger.log(
      `Loaded "${solution.name}": ` +
      `${skillResults.filter((s) => s.action === 'created').length} skills created, ` +
      `${skillResults.filter((s) => s.action === 'updated').length} updated, ` +
      `${mcpResults.filter((m) => m.action === 'created').length} MCP servers created, ` +
      `${mcpResults.filter((m) => m.action === 'updated').length} updated`,
    );

    return {
      slug: solution.slug,
      name: solution.name,
      tenantId,
      skills: skillResults,
      mcpServers: mcpResults,
      warnings,
    };
  }

  // --------------------------------------------------------------------------
  // Tenant Registration
  // --------------------------------------------------------------------------

  /**
   * Ensure the tenant exists, creating it if necessary.
   * Returns the tenant ID.
   */
  private async ensureTenant(
    config: SolutionConfigV2,
    warnings: string[],
  ): Promise<string> {
    const { name, slug, description } = config.ccaas.tenant;

    const existing = await this.tenants.findOne(slug);
    if (existing) {
      this.logger.debug(`Tenant "${slug}" already exists (${existing.id})`);
      return existing.id;
    }

    const result = await this.tenants.create({
      name,
      slug,
      description,
    });

    warnings.push(`Created new tenant: ${slug}`);
    this.logger.log(`Created tenant "${slug}" (${result.tenant.id})`);
    return result.tenant.id;
  }

  // --------------------------------------------------------------------------
  // Skill Registration
  // --------------------------------------------------------------------------

  /**
   * Register all skills defined in the solution config.
   * Uses upsert logic: create if new, update if exists.
   */
  private async registerSkills(
    tenantId: string,
    config: SolutionConfigV2,
    solutionPath: string,
    warnings: string[],
  ): Promise<SkillLoadResult[]> {
    const skillDefs = config.ccaas.discovery.skills;
    const results: SkillLoadResult[] = [];

    for (const skillDef of skillDefs) {
      try {
        const result = await this.registerOneSkill(
          tenantId,
          skillDef,
          config,
          solutionPath,
          warnings,
        );
        results.push(result);
      } catch (err) {
        const error = (err as Error).message;
        this.logger.warn(`Failed to register skill "${skillDef.slug}": ${error}`);
        results.push({
          slug: skillDef.slug,
          name: skillDef.name,
          action: 'skipped',
          error,
        });
      }
    }

    return results;
  }

  /**
   * Register a single skill with upsert logic.
   */
  private async registerOneSkill(
    tenantId: string,
    skillDef: SkillDefinition,
    config: SolutionConfigV2,
    solutionPath: string,
    warnings: string[],
  ): Promise<SkillLoadResult> {
    // Load skill content from SKILL.md if available
    const content = await this.loadSkillContent(
      skillDef,
      config,
      solutionPath,
      warnings,
    );

    const existing = await this.skills.findOne(tenantId, skillDef.slug);

    if (existing) {
      // Update existing skill
      await this.skills.update(tenantId, existing.id, {
        name: skillDef.name,
        description: skillDef.description,
        content,
        allowedTools: skillDef.allowedTools ?? [],
        triggers: (skillDef.triggers ?? []).map((t) => ({
          type: t.type,
          value: t.value,
          priority: t.priority,
          description: t.description,
        })),
        scope: skillDef.scope ?? 'tenant',
      });

      return {
        slug: skillDef.slug,
        name: skillDef.name,
        action: 'updated',
        skillId: existing.id,
      };
    }

    // Create new skill
    const created = await this.skills.create(tenantId, {
      slug: skillDef.slug,
      name: skillDef.name,
      description: skillDef.description,
      content,
      type: 'skill',
      allowedTools: skillDef.allowedTools ?? [],
      triggers: (skillDef.triggers ?? []).map((t) => ({
        type: t.type,
        value: t.value,
        priority: t.priority,
        description: t.description,
      })),
      scope: skillDef.scope ?? 'tenant',
    });

    // Publish immediately (auto-discovered skills should be available)
    try {
      await this.skills.publish(tenantId, created.id);
    } catch {
      // Publish failure is non-fatal (e.g., WebSocket not available in script context)
      warnings.push(`Skill "${skillDef.slug}" created but publish notification failed`);
    }

    return {
      slug: skillDef.slug,
      name: skillDef.name,
      action: 'created',
      skillId: created.id,
    };
  }

  /**
   * Load skill content from SKILL.md file, with fallback to generated content.
   */
  private async loadSkillContent(
    skillDef: SkillDefinition,
    config: SolutionConfigV2,
    solutionPath: string,
    warnings: string[],
  ): Promise<string> {
    if (skillDef.skillFile) {
      const skillFilePath = path.resolve(solutionPath, skillDef.skillFile);

      try {
        const metadata = await this.parser.parseSkillFile(
          skillFilePath,
          config,
          skillDef.slug,
        );
        let content = metadata.content;

        // Append instructions if present in skill definition
        if (skillDef.instructions) {
          content += `\n\n## Additional Instructions\n\n${skillDef.instructions}`;
        }

        if (metadata.warnings.length > 0) {
          warnings.push(...metadata.warnings);
        }

        return content || this.generateFallbackContent(skillDef);
      } catch (err) {
        warnings.push(
          `Failed to read skill file "${skillDef.skillFile}": ${(err as Error).message}`,
        );
      }
    }

    return this.generateFallbackContent(skillDef);
  }

  private generateFallbackContent(skillDef: SkillDefinition): string {
    return `# ${skillDef.name}\n\n${skillDef.description || ''}${
      skillDef.instructions ? `\n\n## Instructions\n\n${skillDef.instructions}` : ''
    }`;
  }

  // --------------------------------------------------------------------------
  // MCP Server Registration
  // --------------------------------------------------------------------------

  /**
   * Register all MCP servers defined in the solution config.
   * Uses upsert logic: create if new, skip if exists.
   */
  private async registerMcpServers(
    tenantId: string,
    config: SolutionConfigV2,
    warnings: string[],
  ): Promise<McpServerLoadResult[]> {
    const serverDefs = config.ccaas.discovery.mcpServers;
    const results: McpServerLoadResult[] = [];

    for (const [slug, serverDef] of Object.entries(serverDefs)) {
      try {
        const result = await this.registerOneMcpServer(
          tenantId,
          slug,
          serverDef,
          warnings,
        );
        results.push(result);
      } catch (err) {
        const error = (err as Error).message;
        this.logger.warn(`Failed to register MCP server "${slug}": ${error}`);
        results.push({
          slug,
          name: serverDef.description || slug,
          action: 'skipped',
          error,
        });
      }
    }

    return results;
  }

  /**
   * Register a single MCP server with upsert logic.
   */
  private async registerOneMcpServer(
    tenantId: string,
    slug: string,
    serverDef: McpServerDefinition,
    warnings: string[],
  ): Promise<McpServerLoadResult> {
    const existing = await this.mcpPool.findOne(tenantId, slug);

    if (existing) {
      // MCP server already exists - update config
      await this.mcpPool.update(tenantId, existing.id, {
        name: serverDef.description || slug,
        description: serverDef.description,
        config: {
          command: serverDef.command,
          args: serverDef.args,
          env: serverDef.env,
        },
      });

      return {
        slug,
        name: serverDef.description || slug,
        action: 'updated',
        serverId: existing.id,
      };
    }

    // Create new MCP server
    const dto: CreateMcpServerDto = {
      name: serverDef.description || slug,
      slug,
      description: serverDef.description,
      type: serverDef.type === 'rest-adapter' ? 'rest-adapter' : 'custom',
      config: {
        command: serverDef.command,
        args: serverDef.args,
        env: serverDef.env,
      },
    };

    const created = await this.mcpPool.create(tenantId, dto);

    return {
      slug,
      name: serverDef.description || slug,
      action: 'created',
      serverId: created.id,
    };
  }
}
