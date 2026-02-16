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
 * Supports v1, v2, and v3 solution.json formats:
 * - v3: Folder-based skills with wildcard support (e.g., "skills/*")
 * - v2: Detailed skill definitions (backward compatible)
 * - v1: Flat structure (migrated to v3 via adapter)
 *
 * Provides:
 *   - loadAll()  - Auto-discover and register all enabled solutions
 *   - loadOne()  - Register a single solution by slug
 *   - getStatus() - Health check / registration status
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import fg from 'fast-glob';
import { SolutionScannerService, type SolutionMetadata } from './solution-scanner.service';
import { SkillMetadataParserService } from './skill-metadata-parser.service';
import { TenantsService } from '../tenants/tenants.service';
import { SkillsService } from '../skills/skills.service';
import { McpPoolService, type CreateMcpServerDto } from '../mcp/mcp-pool.service';
import type {
  SolutionConfigV3,
  SkillReferenceV3,
  McpServerDefinition,
} from './dto/solution-config.dto';

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
   * Supports both v3 (folder-based) and v2 (detailed) skill formats.
   */
  private async loadSolution(solution: SolutionMetadata): Promise<LoadResult> {
    const config = solution.config;
    const warnings = [...solution.warnings];

    // Step 1: Ensure tenant exists
    const tenantId = await this.ensureTenant(config, warnings);

    // Step 2: Register skills (v3 uses folder-based, all configs are v3 now)
    const skillResults = await this.loadSkillsV3(
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
    config: SolutionConfigV3,
    warnings: string[],
  ): Promise<string> {
    const { name, slug, description } = config.tenant;

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
  // Skill Registration (V3 - Folder-based with wildcard support)
  // --------------------------------------------------------------------------

  /**
   * Load skills from folder paths (v3 format).
   * Supports wildcard patterns like "skills/*" or "custom-skills/analyzer".
   */
  private async loadSkillsV3(
    tenantId: string,
    config: SolutionConfigV3,
    solutionPath: string,
    warnings: string[],
  ): Promise<SkillLoadResult[]> {
    const skillRefs = config.skills || ['skills/*']; // Default to wildcard
    const results: SkillLoadResult[] = [];

    for (const ref of skillRefs) {
      const pattern = typeof ref === 'string' ? ref : ref.folder;

      if (pattern.includes('*')) {
        // Wildcard pattern - scan for SKILL.md files
        const skillDirs = await this.globSkillDirectories(solutionPath, pattern);

        if (skillDirs.length === 0) {
          warnings.push(`No skills found matching pattern "${pattern}"`);
          continue;
        }

        for (const dir of skillDirs) {
          try {
            const result = await this.registerSkillFromFolder(
              tenantId,
              solutionPath,
              dir,
              warnings,
            );
            results.push(result);
          } catch (err) {
            const error = (err as Error).message;
            this.logger.warn(`Failed to register skill from "${dir}": ${error}`);
            results.push({
              slug: path.basename(dir),
              name: path.basename(dir),
              action: 'skipped',
              error,
            });
          }
        }
      } else {
        // Specific path - register single skill
        try {
          const result = await this.registerSkillFromFolder(
            tenantId,
            solutionPath,
            pattern,
            warnings,
          );
          results.push(result);
        } catch (err) {
          const error = (err as Error).message;
          this.logger.warn(`Failed to register skill from "${pattern}": ${error}`);
          results.push({
            slug: path.basename(pattern),
            name: path.basename(pattern),
            action: 'skipped',
            error,
          });
        }
      }
    }

    return results;
  }

  /**
   * Scan directories matching a wildcard pattern for SKILL.md files.
   * Returns relative paths (e.g., ["skills/analyzer", "skills/generator"]).
   */
  private async globSkillDirectories(
    basePath: string,
    pattern: string,
  ): Promise<string[]> {
    // Convert pattern to glob format: "skills/*" -> "skills/*/SKILL.md"
    const globPattern = path.join(basePath, pattern, 'SKILL.md');

    try {
      const matches = await fg(globPattern, {
        absolute: false,
        cwd: basePath,
        onlyFiles: true,
      });

      // Extract directory paths relative to basePath
      // Note: fast-glob returns absolute paths when pattern is absolute,
      // even with absolute: false. Don't join with basePath again!
      return matches.map((match) => {
        const relativePath = path.relative(basePath, match);
        return path.dirname(relativePath);
      });
    } catch (err) {
      this.logger.warn(
        `Glob failed for pattern "${pattern}": ${(err as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Register a single skill from a folder containing SKILL.md.
   * Uses SKILL.md frontmatter as the primary metadata source.
   */
  private async registerSkillFromFolder(
    tenantId: string,
    solutionPath: string,
    skillFolder: string,
    warnings: string[],
  ): Promise<SkillLoadResult> {
    const skillFilePath = path.resolve(solutionPath, skillFolder, 'SKILL.md');

    // Check if SKILL.md exists
    try {
      await fs.access(skillFilePath);
    } catch {
      throw new Error(`SKILL.md not found in ${skillFolder}`);
    }

    // Parse SKILL.md frontmatter (no fallback to solution.json in v3)
    const metadata = await this.parser.parseSkillFile(skillFilePath);

    if (metadata.source === 'defaults') {
      warnings.push(
        `Skill in "${skillFolder}" has no frontmatter, using defaults`,
      );
    }

    const { frontmatter, content } = metadata;

    // Check if skill already exists
    const existing = await this.skills.findOne(tenantId, frontmatter.slug);

    if (existing) {
      // Update existing skill
      await this.skills.update(tenantId, existing.id, {
        name: frontmatter.name,
        description: frontmatter.description,
        content,
        allowedTools: frontmatter.allowedTools ?? [],
        triggers: (frontmatter.triggers ?? []).map((t) => ({
          type: t.type,
          value: t.value,
          priority: t.priority,
          description: t.description,
        })),
        scope: frontmatter.scope ?? 'tenant',
      });

      return {
        slug: frontmatter.slug,
        name: frontmatter.name,
        action: 'updated',
        skillId: existing.id,
      };
    }

    // Create new skill
    const created = await this.skills.create(tenantId, {
      slug: frontmatter.slug,
      name: frontmatter.name,
      description: frontmatter.description,
      content,
      type: 'skill',
      allowedTools: frontmatter.allowedTools ?? [],
      triggers: (frontmatter.triggers ?? []).map((t) => ({
        type: t.type,
        value: t.value,
        priority: t.priority,
        description: t.description,
      })),
      scope: frontmatter.scope ?? 'tenant',
    });

    // Publish immediately
    try {
      await this.skills.publish(tenantId, created.id);
    } catch {
      warnings.push(`Skill "${frontmatter.slug}" created but publish notification failed`);
    }

    return {
      slug: frontmatter.slug,
      name: frontmatter.name,
      action: 'created',
      skillId: created.id,
    };
  }


  // --------------------------------------------------------------------------
  // MCP Server Registration
  // --------------------------------------------------------------------------

  /**
   * Register all MCP servers defined in the solution config.
   * Uses upsert logic: create if new, update if exists.
   */
  private async registerMcpServers(
    tenantId: string,
    config: SolutionConfigV3,
    warnings: string[],
  ): Promise<McpServerLoadResult[]> {
    const serverDefs = config.mcpServers || {};
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
