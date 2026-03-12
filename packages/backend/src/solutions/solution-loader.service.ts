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
import { EventMapperService } from '../sessions/event-mapper.service';
import { BundleService } from '../bundles/bundle.service';
import type {
  SolutionConfigV3,
  SkillReferenceV3,
  McpServerDefinition,
  SessionTemplateConfig,
} from './dto/solution-config.dto';

/** Resolved MCP server config for session template injection (no toolEventTriggers, no type). */
type ResolvedMcpServerConfig = {
  command: string;
  args: string[];
  env?: Record<string, string>;
};

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
  templateCount?: number;
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
    private readonly eventMapper: EventMapperService,
    private readonly bundleService: BundleService,
  ) {}

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Scan and register all discovery-enabled solutions.
   */
  async loadAll(solutionsDir?: string): Promise<LoadAllResult> {
    this.logger.log('Starting auto-discovery of solutions...');

    // Clear stale trigger registrations before re-registering from current solution set
    this.eventMapper.clearAllTenantToolTriggers();

    const allSolutions = await this.scanner.scanSolutions(solutionsDir);
    // Filter out solutions with discovery.enabled = false before processing
    const solutions = allSolutions.filter((s) => s.config.discovery.enabled !== false);

    if (allSolutions.length !== solutions.length) {
      const skipped = allSolutions.length - solutions.length;
      this.logger.log(`Skipping ${skipped} solution(s) with discovery.enabled = false`);
    }

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
   * Note: intentionally bypasses discovery.enabled — loadOne() is a manual override
   * for cases like re-importing a specific solution regardless of its discovery setting.
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
    // In simple mode, filter out MCP servers that are already provided by bundles
    const mode: 'simple' | 'advanced' = config.mode ?? 'simple';
    const filteredMcpServers = this.filterBundleProvidedServers(
      config.mcpServers || {},
      mode,
    );
    const filteredConfig = { ...config, mcpServers: filteredMcpServers };
    const mcpResults = await this.registerMcpServers(
      tenantId,
      filteredConfig,
      warnings,
    );

    // Step 3b: Auto-sync enabledBundles to tenant config
    let bundleIdsToSync: string[];
    if (mode === 'simple') {
      bundleIdsToSync = this.bundleService.getAvailableBundles().map(b => b.id);
    } else {
      const templateBundleIds = new Set<string>();
      if (config.sessionTemplates) {
        for (const tmpl of Object.values(config.sessionTemplates)) {
          if (tmpl.bundles) {
            tmpl.bundles.forEach((id) => templateBundleIds.add(id));
          }
        }
      }
      bundleIdsToSync = [...templateBundleIds];
    }

    const syncedBundles = await this.syncEnabledBundles(
      tenantId,
      bundleIdsToSync,
      mode === 'simple'
        ? 'simple mode — auto-enabled all built-in bundles'
        : 'synced enabledBundles from session templates',
    );

    // Step 4: Register tool event triggers with EventMapperService
    // Merge solution triggers (from filtered mcpServers) + bundle triggers (from tenant config)
    const solutionTriggers = Object.values(filteredMcpServers).flatMap(
      (serverDef) => serverDef.toolEventTriggers ?? [],
    );

    // Use the syncedBundles from Step 3b directly (no re-read needed)
    const bundleResolution = this.bundleService.resolveActiveBundles(undefined, syncedBundles);
    const bundleTriggers = bundleResolution.toolEventTriggers;

    const allTriggers = [...bundleTriggers, ...solutionTriggers];
    if (allTriggers.length > 0) {
      this.eventMapper.registerTenantToolTriggers(tenantId, allTriggers);
    }

    // Step 5: Apply session templates (upsert — merge with existing)
    // Inject resolved MCP servers so sessions get MCP tools without manual setup.sh
    let templateCount = 0;
    if (config.sessionTemplates && Object.keys(config.sessionTemplates).length > 0) {
      const resolvedMcpServers = this.resolveMcpServerAbsolutePaths(
        filteredMcpServers,
        solution.solutionPath,
      );
      await this.applySessionTemplates(tenantId, config.sessionTemplates, warnings, resolvedMcpServers);
      templateCount = Object.keys(config.sessionTemplates).length;
    }

    // Step 6: Stamp solutionAppliedAt so callers can confirm this run completed
    await this.tenants.update(tenantId, {
      config: { solutionAppliedAt: new Date().toISOString() },
    });

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
      templateCount,
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
      // Resolve reference to a folder pattern:
      //   "skills/*"            → wildcard glob
      //   "skills/my-skill"     → specific folder
      //   { folder: "..." }     → explicit folder
      //   { slug: "my-skill" }  → convention: skills/my-skill
      const pattern = typeof ref === 'string'
        ? ref
        : 'folder' in ref
          ? ref.folder
          : `skills/${ref.slug}`;

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
   * Slug is always inferred from the directory name, not frontmatter.
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

    // Parse SKILL.md frontmatter
    const metadata = await this.parser.parseSkillFile(skillFilePath);

    if (metadata.source === 'defaults') {
      warnings.push(
        `Skill in "${skillFolder}" has no frontmatter, using defaults`,
      );
    }

    const { frontmatter, slug, content } = metadata;

    // Check if skill already exists
    const existing = await this.skills.findOne(tenantId, slug);

    // Discover additional files (references/, etc.) excluding SKILL.md
    const skillDir = path.resolve(solutionPath, skillFolder);
    const additionalFiles = await this.discoverSkillFiles(skillDir);

    if (existing) {
      // Update existing skill
      await this.skills.update(tenantId, existing.id, {
        name: frontmatter.name,
        description: frontmatter.description,
        content,
        allowedTools: [],
        triggers: [],
        scope: 'tenant',
        files: additionalFiles,
      });

      return {
        slug,
        name: frontmatter.name,
        action: 'updated',
        skillId: existing.id,
      };
    }

    // Create new skill
    const created = await this.skills.create(tenantId, {
      slug,
      name: frontmatter.name,
      description: frontmatter.description,
      content,
      type: 'skill',
      allowedTools: [],
      triggers: [],
      scope: 'tenant',
      files: additionalFiles,
    });

    // Publish immediately
    try {
      await this.skills.publish(tenantId, created.id);
    } catch {
      warnings.push(`Skill "${slug}" created but publish notification failed`);
    }

    return {
      slug,
      name: frontmatter.name,
      action: 'created',
      skillId: created.id,
    };
  }


  /** Text-safe file extensions that can be stored in DB text columns */
  private static readonly TEXT_EXTENSIONS = new Set([
    '.md', '.txt', '.json', '.yaml', '.yml', '.xml', '.csv',
    '.html', '.js', '.ts', '.py', '.sh', '.toml', '.ini',
  ]);

  /**
   * Discover additional text files in a skill directory (excluding SKILL.md).
   * Only imports files with known text extensions to avoid corrupting binary data.
   */
  private async discoverSkillFiles(
    skillDir: string,
  ): Promise<Array<{ relativePath: string; content: string }>> {
    try {
      const entries = await fg('**/*', {
        cwd: skillDir,
        ignore: ['SKILL.md'],
        dot: false,
      });

      const textEntries = entries.filter((e) =>
        SolutionLoaderService.TEXT_EXTENSIONS.has(
          path.extname(e).toLowerCase(),
        ),
      );

      if (textEntries.length < entries.length) {
        const skipped = entries.length - textEntries.length;
        this.logger.debug(
          `Skipped ${skipped} non-text file(s) in ${skillDir}`,
        );
      }

      return Promise.all(
        textEntries.map(async (entry) => ({
          relativePath: entry,
          content: await fs.readFile(path.join(skillDir, entry), 'utf-8'),
        })),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to discover skill files in ${skillDir}: ${(error as Error).message}`,
      );
      return [];
    }
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
          tools: serverDef.tools,
          toolEventTriggers: serverDef.toolEventTriggers,
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
        tools: serverDef.tools,
        toolEventTriggers: serverDef.toolEventTriggers,
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

  // --------------------------------------------------------------------------
  // Session Template Registration
  // --------------------------------------------------------------------------

  /**
   * Apply session templates from solution.json to the tenant config.
   * Uses upsert logic: merges declared templates with any existing ones.
   * Injects resolvedMcpServers into templates that have no mcpServers defined.
   */
  private async applySessionTemplates(
    tenantId: string,
    templates: Record<string, SessionTemplateConfig>,
    warnings: string[],
    resolvedMcpServers?: Record<string, ResolvedMcpServerConfig>,
  ): Promise<void> {
    const tenant = await this.tenants.findOne(tenantId);
    if (!tenant) {
      warnings.push(`Cannot apply session templates: tenant "${tenantId}" not found`);
      this.logger.warn(`Cannot apply session templates: tenant "${tenantId}" not found`);
      return;
    }

    const existing = (tenant.config?.sessionTemplates ?? {}) as Record<string, SessionTemplateConfig>;
    let merged: Record<string, SessionTemplateConfig> = { ...existing, ...templates };

    // Inject MCP servers into templates that don't have their own mcpServers.
    // Uses spread to avoid mutating the original config objects from solution.json.
    if (resolvedMcpServers && Object.keys(resolvedMcpServers).length > 0) {
      const mcpToInject = { ...resolvedMcpServers } as SessionTemplateConfig['mcpServers'];
      merged = Object.fromEntries(
        Object.entries(merged).map(([name, template]) => {
          if (!template.mcpServers || Object.keys(template.mcpServers).length === 0) {
            this.logger.debug(
              `Injected MCP servers [${Object.keys(resolvedMcpServers).join(', ')}] into template "${name}"`,
            );
            return [name, { ...template, mcpServers: mcpToInject }];
          }
          return [name, template];
        }),
      );
    }

    // Validate that every enabledSkills entry is registered for this tenant
    for (const [templateName, template] of Object.entries(templates)) {
      for (const entry of template.enabledSkills ?? []) {
        const slug = typeof entry === 'string' ? entry : entry.slug;
        const skill = await this.skills.findOne(tenantId, slug);
        if (!skill) {
          warnings.push(
            `Session template "${templateName}": skill slug "${slug}" not found in tenant — ` +
            `template saved but enabledSkills may not work until skill is registered`,
          );
        }
      }
    }

    await this.tenants.update(tenantId, {
      config: { sessionTemplates: merged },
    });

    warnings.push(
      `Applied ${Object.keys(templates).length} session template(s): ${Object.keys(templates).join(', ')}`,
    );
    this.logger.log(`Applied session templates for tenant "${tenantId}"`);
  }

  /**
   * Merge bundleIdsToSync into tenant's existing enabledBundles (no duplicates).
   * Skips the update if all IDs are already present.
   * Returns the final merged list of enabled bundle IDs.
   */
  private async syncEnabledBundles(
    tenantId: string,
    bundleIdsToSync: string[],
    logMessage: string,
  ): Promise<string[]> {
    if (bundleIdsToSync.length === 0) {
      const tenant = await this.tenants.findOne(tenantId);
      return tenant?.config?.enabledBundles ?? [];
    }

    const tenant = await this.tenants.findOne(tenantId);
    const existing = new Set(tenant?.config?.enabledBundles ?? []);
    const merged = [...new Set([...existing, ...bundleIdsToSync])];

    if (merged.length > existing.size) {
      await this.tenants.update(tenantId, {
        config: { enabledBundles: merged },
      });
      this.logger.log(`Tenant ${tenantId}: ${logMessage}: [${merged.join(', ')}]`);
    }
    return merged;
  }

  /**
   * In simple mode, filter out MCP servers that are already provided by built-in bundles.
   * Detects bundle-provided servers by matching args against bundle MCP server paths.
   * This prevents duplicate tools (e.g., two read_context or two attach_file).
   */
  private filterBundleProvidedServers(
    mcpServers: Record<string, McpServerDefinition>,
    mode: 'simple' | 'advanced',
  ): Record<string, McpServerDefinition> {
    if (mode !== 'simple') return mcpServers;

    // Collect server directory names from all bundle MCP server definitions
    // e.g. '${CORE_MCP_DIR}/shared-context-server/dist/index.js' → 'shared-context-server'
    const bundleServerDirNames = this.bundleService.getAvailableBundles()
      .filter(b => b.mcpServer)
      .map(b => {
        const lastArg = b.mcpServer!.args[b.mcpServer!.args.length - 1];
        const match = lastArg.match(/\/([^/]+)\/dist\/index\.js$/);
        return match ? match[1] : null;
      })
      .filter((name): name is string => name !== null);

    const filtered: Record<string, McpServerDefinition> = {};
    for (const [slug, def] of Object.entries(mcpServers)) {
      const argsStr = (def.args || []).join(' ');
      const matchedBundle = bundleServerDirNames.find(dir => argsStr.includes(`${dir}/`));
      if (matchedBundle) {
        this.logger.log(
          `Simple mode: skipping MCP server "${slug}" (provided by ${matchedBundle} bundle)`,
        );
        continue;
      }
      filtered[slug] = def;
    }
    return filtered;
  }

  /**
   * Resolve relative MCP server args to absolute paths using the solution directory.
   * Only resolves args that look like relative JS/TS file paths.
   * Paths resolving outside the solution directory are left unchanged (path traversal guard).
   * toolEventTriggers are excluded — they are handled by EventMapperService, not the CLI.
   */
  private resolveMcpServerAbsolutePaths(
    mcpServers: Record<string, McpServerDefinition>,
    solutionPath: string,
  ): Record<string, ResolvedMcpServerConfig> {
    const resolved: Record<string, ResolvedMcpServerConfig> = {};
    const solutionBoundary = solutionPath + path.sep;

    for (const [slug, def] of Object.entries(mcpServers)) {
      const resolvedArgs = (def.args || []).map(arg => {
        if (!path.isAbsolute(arg) && /\.(js|ts)$/.test(arg)) {
          const absolute = path.resolve(solutionPath, arg);
          if (!absolute.startsWith(solutionBoundary)) {
            this.logger.warn(
              `MCP server "${slug}": arg "${arg}" resolves outside solution directory — left as-is`,
            );
            return arg;
          }
          return absolute;
        }
        return arg;
      });

      resolved[slug] = {
        command: def.command,
        args: resolvedArgs,
        ...(def.env ? { env: def.env } : {}),
      };
    }

    return resolved;
  }
}
