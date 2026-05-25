/**
 * Solution Loader Service
 *
 * Imports solution configuration from a request body (not filesystem).
 * Orchestrates:
 *   1. Ensure tenant exists (via TenantsService)
 *   2. Register MCP servers with upsert logic (via McpPoolService)
 *   3. Sync enabled bundles
 *   4. Register tool event triggers (via EventMapperService)
 *   5. Apply session templates
 *   6. Stamp solutionAppliedAt
 *
 * Skills are registered separately via the Skills API.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TenantsService } from '../tenants/tenants.service';
import { SkillsService } from '../skills/skills.service';
import { McpPoolService, type CreateMcpServerDto } from '../mcp/mcp-pool.service';
import { EventMapperService } from '../sessions/event-mapper.service';
import { BundleService } from '../bundles/bundle.service';
import type {
  McpServerDefinition,
  SessionTemplateConfig,
} from './dto/solution-config.dto';
import { validateSolutionConfig } from './dto/solution-config.dto';

// ============================================================================
// Types
// ============================================================================

/** Input config for body-based import. */
export interface ImportSolutionConfig {
  tenant: { name: string; slug: string; description?: string };
  mode?: 'simple' | 'advanced';
  mcpServers?: Record<string, McpServerDefinition>;
  sessionTemplates?: Record<string, SessionTemplateConfig>;
  /**
   * agent-runtime sync layer — REST base URL ccaas calls back to for
   * artifact load/save. Persisted to `tenant.config.artifactUrl`
   * via `tenants.update()`; read at sync time by
   * `ProjectArtifactSourceRegistry`. Optional — solutions without
   * bidirectional artifact sync omit it.
   */
  artifactUrl?: string;
}

export interface LoadResult {
  slug: string;
  name: string;
  tenantId: string;
  mcpServers: McpServerLoadResult[];
  warnings: string[];
  templateCount?: number;
}

export interface McpServerLoadResult {
  slug: string;
  name: string;
  action: 'created' | 'updated' | 'skipped';
  serverId?: string;
  error?: string;
}

export interface LoaderStatus {
  lastLoadAt: Date | null;
  solutionsLoaded: number;
  mcpServersRegistered: number;
  errors: string[];
}

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class SolutionLoaderService implements OnModuleInit {
  private readonly logger = new Logger(SolutionLoaderService.name);
  private status: LoaderStatus = {
    lastLoadAt: null,
    solutionsLoaded: 0,
    mcpServersRegistered: 0,
    errors: [],
  };

  constructor(
    private readonly tenants: TenantsService,
    private readonly skills: SkillsService,
    private readonly mcpPool: McpPoolService,
    private readonly eventMapper: EventMapperService,
    private readonly bundleService: BundleService,
    private readonly cfg: ConfigService,
  ) {}

  /**
   * Boot auto-discovery: walk `SOLUTIONS_DIR/<slug>/solution.json` and
   * import each into ccaas at backend startup. Sibling solution backends declare
   * their config + artifactUrl in their source tree; ccaas picks them up
   * with zero env vars, zero REST calls, zero admin keys.
   *
   * Per-file try/catch so one malformed `solution.json` doesn't block
   * other solutions from importing. Logs the error and continues.
   *
   * In prod, leave `SOLUTIONS_DIR` unset to opt out — solutions are
   * imported explicitly via `POST /api/v1/admin/solutions/import`.
   *
   * Ordering: this runs AFTER `TenantsService.onModuleInit` (which seeds
   * the default tenant) because Nest resolves modules in import-graph
   * order and `SolutionsModule` depends on `TenantsModule`.
   */
  async onModuleInit(): Promise<void> {
    const dir = this.cfg.get<string>('solutions.dir');
    if (!dir) return;
    if (!fs.existsSync(dir)) {
      this.logger.warn(`SOLUTIONS_DIR=${dir} does not exist; skipping auto-import`);
      return;
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let imported = 0;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const file = path.join(dir, entry.name, 'solution.json');
      if (!fs.existsSync(file)) continue;
      try {
        const raw = fs.readFileSync(file, 'utf8');
        const parsed = JSON.parse(raw) as unknown;
        // Run Zod validation BEFORE handing to importFromConfig so a
        // malformed solution.json fails fast with a field-level error
        // rather than deep inside ensureTenant / TypeORM.
        const validated = validateSolutionConfig(parsed);
        if (!validated.success) {
          const issues = validated.errors.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ');
          this.logger.error(
            `auto-import failed for ${file}: schema v${validated.version} validation: ${issues}`,
          );
          continue;
        }
        // v3 / v2 / v1 all have a compatible subset for importFromConfig
        // (tenant + mode + mcpServers + sessionTemplates + artifactUrl).
        // Cast through unknown — we've validated the shape via Zod.
        const config = validated.data as unknown as ImportSolutionConfig;
        await this.importFromConfig(config);
        imported++;
        this.logger.log(
          `auto-imported solution from ${file} (tenant=${config.tenant?.slug})`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`auto-import failed for ${file}: ${msg}`);
        // continue — one bad file shouldn't halt boot
      }
    }
    if (imported > 0) {
      this.logger.log(`auto-discovery complete: ${imported} solution(s) imported`);
    }
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Import a solution from config body.
   * Ensures tenant → registers MCP servers → syncs bundles →
   * registers triggers → applies session templates.
   */
  async importFromConfig(config: ImportSolutionConfig): Promise<LoadResult> {
    const warnings: string[] = [];
    const mode: 'simple' | 'advanced' = config.mode ?? 'simple';

    // Step 1: Ensure tenant exists
    const tenantId = await this.ensureTenant(config, warnings);

    // Step 2: Register MCP servers
    // In simple mode, filter out MCP servers that are already provided by bundles
    const filteredMcpServers = this.filterBundleProvidedServers(
      config.mcpServers || {},
      mode,
    );
    const mcpResults = await this.registerMcpServers(
      tenantId,
      filteredMcpServers,
      warnings,
    );

    // Step 3: Auto-sync enabledBundles to tenant config
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
    const solutionTriggers = Object.values(filteredMcpServers).flatMap(
      (serverDef) => serverDef.toolEventTriggers ?? [],
    );

    const bundleResolution = this.bundleService.resolveActiveBundles(undefined, syncedBundles);
    const bundleTriggers = bundleResolution.toolEventTriggers;

    const allTriggers = [...bundleTriggers, ...solutionTriggers];
    if (allTriggers.length > 0) {
      this.eventMapper.registerTenantToolTriggers(tenantId, allTriggers);
    }

    // Step 5: Apply session templates (upsert — merge with existing)
    let templateCount = 0;
    if (config.sessionTemplates && Object.keys(config.sessionTemplates).length > 0) {
      await this.applySessionTemplates(tenantId, config.sessionTemplates, warnings);
      templateCount = Object.keys(config.sessionTemplates).length;
    }

    // Step 6: Stamp solutionAppliedAt + persist artifactUrl in a single
    // update. The partial-merge semantics on tenants.update preserve
    // other config keys (webhookUrl, customSystemPrompt, etc.); re-import
    // is idempotent. A single update also means only one
    // `tenant.config.changed` event fires (registry evicts once).
    const tenantConfigPatch: Record<string, unknown> = {
      solutionAppliedAt: new Date().toISOString(),
    };
    if (config.artifactUrl) {
      tenantConfigPatch.artifactUrl = config.artifactUrl;
    }
    await this.tenants.update(tenantId, { config: tenantConfigPatch });

    // Update status
    const mcpRegistered = mcpResults.filter(
      (m) => m.action !== 'skipped' && !m.error,
    ).length;
    this.status = {
      lastLoadAt: new Date(),
      solutionsLoaded: this.status.solutionsLoaded + 1,
      mcpServersRegistered: this.status.mcpServersRegistered + mcpRegistered,
      errors: [],
    };

    this.logger.log(
      `Imported "${config.tenant.name}": ` +
      `${mcpResults.filter((m) => m.action === 'created').length} MCP servers created, ` +
      `${mcpResults.filter((m) => m.action === 'updated').length} updated, ` +
      `${templateCount} session template(s)`,
    );

    return {
      slug: config.tenant.slug,
      name: config.tenant.name,
      tenantId,
      mcpServers: mcpResults,
      warnings,
      templateCount,
    };
  }

  /**
   * Get loader health/status information.
   */
  getStatus(): LoaderStatus {
    return { ...this.status };
  }

  // --------------------------------------------------------------------------
  // Tenant Registration
  // --------------------------------------------------------------------------

  /**
   * Ensure the tenant exists, creating it if necessary.
   * Returns the tenant ID.
   */
  private async ensureTenant(
    config: ImportSolutionConfig,
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
  // MCP Server Registration
  // --------------------------------------------------------------------------

  /**
   * Register all MCP servers defined in the config.
   * Uses upsert logic: create if new, update if exists.
   */
  private async registerMcpServers(
    tenantId: string,
    mcpServers: Record<string, McpServerDefinition>,
    warnings: string[],
  ): Promise<McpServerLoadResult[]> {
    const results: McpServerLoadResult[] = [];

    for (const [slug, serverDef] of Object.entries(mcpServers)) {
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
   * Apply session templates from config body to the tenant config.
   * Uses upsert logic: merges declared templates with any existing ones.
   */
  private async applySessionTemplates(
    tenantId: string,
    templates: Record<string, SessionTemplateConfig>,
    warnings: string[],
  ): Promise<void> {
    const tenant = await this.tenants.findOne(tenantId);
    if (!tenant) {
      warnings.push(`Cannot apply session templates: tenant "${tenantId}" not found`);
      this.logger.warn(`Cannot apply session templates: tenant "${tenantId}" not found`);
      return;
    }

    const existing = (tenant.config?.sessionTemplates ?? {}) as Record<string, SessionTemplateConfig>;
    const merged: Record<string, SessionTemplateConfig> = { ...existing, ...templates };

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

  // --------------------------------------------------------------------------
  // Bundle Management
  // --------------------------------------------------------------------------

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
   */
  private filterBundleProvidedServers(
    mcpServers: Record<string, McpServerDefinition>,
    mode: 'simple' | 'advanced',
  ): Record<string, McpServerDefinition> {
    if (mode !== 'simple') return mcpServers;

    // Collect server directory names from all bundle MCP server definitions
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
}
