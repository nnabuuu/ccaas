/**
 * Solution Loader Service
 *
 * Imports solution configuration from a request body (not filesystem).
 * Orchestrates:
 *   1. Ensure tenant exists (via SolutionsService)
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
import matter from 'gray-matter';
import { SolutionsService } from '../solutions/solutions.service';
import { SkillsService } from '../skills/skills.service';
import { McpPoolService, type CreateMcpServerDto } from '../mcp/mcp-pool.service';
import { EventMapperService } from '../sessions/event-mapper.service';
import { BundleService } from '../bundles/bundle.service';
import { SolutionToolkitRegistry } from '../tool-caller/solution-toolkit-registry';
import {
  StdioMcpToolkit,
  type StdioToolSpec,
  sanitizeEnvForSolutionSubprocess,
} from '../tool-caller/toolkits/stdio-mcp-toolkit';
import { z } from 'zod';
import { spawn } from 'node:child_process';
import type {
  McpServerDefinition,
  SessionTemplateConfig,
  SkillReferenceV3,
} from './dto/solution-config.dto';
import { validateSolutionConfig } from './dto/solution-config.dto';
import { validateSkillFrontmatter } from './dto/skill-frontmatter.dto';

// ============================================================================
// Skill walk safety limits
// ============================================================================

/**
 * Per-skill file count cap during auto-import. A solution can legitimately
 * have dozens of skill files (tools/, examples/, scripts/), but thousands
 * almost always means the operator pointed the walk at the wrong dir.
 */
const MAX_SKILL_FILES = 200;

/**
 * Per-skill aggregate-bytes cap. Per-file is already capped at 1MB; this
 * keeps total RAM + DB write volume bounded during boot.
 */
const MAX_SKILL_BYTES = 10 * 1024 * 1024;

/**
 * Extension allowlist for skill_files content. Only text/source formats
 * a SKILL.md would legitimately reference. Refuses .env / .pem / .key /
 * .pfx / binary blobs / anything not on this list.
 */
const SKILL_FILE_EXTENSIONS = new Set<string>([
  '.md', '.mdx', '.markdown',
  '.txt', '.csv', '.tsv',
  '.json', '.json5', '.jsonc',
  '.yaml', '.yml', '.toml',
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.py', '.rb', '.go', '.rs',
  '.sh', '.bash', '.zsh',
  '.sql', '.html', '.htm', '.css',
]);

/** Mutable budget threaded through the recursive walk. */
interface WalkBudget {
  bytes: number;
  count: number;
  /** Absolute path of the skill's root dir (resolved once, used to detect symlink escapes). */
  root: string;
}

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
   * `WorkspaceArtifactSourceRegistry`. Optional — solutions without
   * bidirectional artifact sync omit it.
   */
  artifactUrl?: string;
  /**
   * Skill references — typically `["skills/*"]` glob. Only honoured when
   * importFromConfig() is invoked with a solutionDir (i.e. via filesystem
   * auto-discovery). Body-only admin imports lack the source tree so
   * skills get skipped with a warning.
   */
  skills?: SkillReferenceV3[];
}

export interface SkillImportResult {
  slug: string;
  action: 'created' | 'skipped' | 'error';
  error?: string;
}

export interface LoadResult {
  slug: string;
  name: string;
  solutionId: string;
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
    private readonly tenants: SolutionsService,
    private readonly skills: SkillsService,
    private readonly mcpPool: McpPoolService,
    private readonly eventMapper: EventMapperService,
    private readonly bundleService: BundleService,
    private readonly cfg: ConfigService,
    private readonly toolkitRegistry: SolutionToolkitRegistry,
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
   * Ordering: this runs AFTER `SolutionsService.onModuleInit` (which seeds
   * the default tenant) because Nest resolves modules in import-graph
   * order and `SolutionLoaderModule` depends on `SolutionsModule`.
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
        // Pass solutionDir so filesystem-resolved skills get imported too.
        await this.importFromConfig(config, { solutionDir: path.join(dir, entry.name) });
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
  async importFromConfig(config: ImportSolutionConfig, opts?: { solutionDir?: string }): Promise<LoadResult> {
    const warnings: string[] = [];
    const mode: 'simple' | 'advanced' = config.mode ?? 'simple';

    // Step 1: Ensure tenant exists
    const solutionId = await this.ensureTenant(config, warnings);

    // Step 2: Register MCP servers
    // In simple mode, filter out MCP servers that are already provided by bundles
    const filteredMcpServers = this.filterBundleProvidedServers(
      config.mcpServers || {},
      mode,
    );
    const mcpResults = await this.registerMcpServers(
      solutionId,
      filteredMcpServers,
      warnings,
      opts?.solutionDir,
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
      solutionId,
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
      this.eventMapper.registerTenantToolTriggers(solutionId, allTriggers);
    }

    // Step 5: Apply session templates (upsert — merge with existing)
    let templateCount = 0;
    if (config.sessionTemplates && Object.keys(config.sessionTemplates).length > 0) {
      await this.applySessionTemplates(solutionId, config.sessionTemplates, warnings);
      templateCount = Object.keys(config.sessionTemplates).length;
    }

    // Step 5.5: Import skills from filesystem (only when we have a solutionDir;
    // body-only admin imports skip this and emit a warning so the operator
    // knows skill content didn't land).
    let skillResults: SkillImportResult[] = [];
    if (config.skills && config.skills.length > 0) {
      if (opts?.solutionDir) {
        skillResults = await this.importSkills(solutionId, opts.solutionDir, config.skills, warnings);
      } else {
        warnings.push(
          `Skipped ${config.skills.length} skill ref(s) — importFromConfig() ` +
          `called without solutionDir (body-only import). Register skills via ` +
          `POST /api/v1/skills or move the call to filesystem auto-discovery.`,
        );
      }
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
    await this.tenants.update(solutionId, { config: tenantConfigPatch });

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

    const skillsCreated = skillResults.filter((s) => s.action === 'created').length;
    const skillsSkipped = skillResults.filter((s) => s.action === 'skipped').length;
    const skillsErrored = skillResults.filter((s) => s.action === 'error').length;
    this.logger.log(
      `Imported "${config.tenant.name}": ` +
      `${mcpResults.filter((m) => m.action === 'created').length} MCP servers created, ` +
      `${mcpResults.filter((m) => m.action === 'updated').length} updated, ` +
      `${templateCount} session template(s), ` +
      `${skillsCreated} skill(s) created` +
      (skillsSkipped ? `, ${skillsSkipped} skipped (already exist)` : '') +
      (skillsErrored ? `, ${skillsErrored} skill(s) failed` : ''),
    );

    return {
      slug: config.tenant.slug,
      name: config.tenant.name,
      solutionId,
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
  // Skill Filesystem Import
  // --------------------------------------------------------------------------

  /**
   * Walk the `skills: [...]` references against the solution's source tree.
   * Each ref can be a `skills/*` glob (or `string` short form), a `{folder}`
   * object, or a `{slug, name}` object. For glob / folder forms, every dir
   * containing a `SKILL.md` becomes one skill in the DB; the SKILL.md
   * supplies name/description via YAML frontmatter; sibling files (tools/*,
   * examples/*, scripts/*) become skill_files rows.
   *
   * Idempotent: existing (solutionId, slug) is left untouched. The skill
   * upsert/version-bump path is the API's job (`PUT /api/v1/skills/:id` +
   * `POST :id/versions`) — auto-import doesn't try to upgrade in-place
   * because the body might include locally-edited content.
   *
   * Per-skill try/catch — one malformed SKILL.md doesn't block siblings.
   */
  private async importSkills(
    solutionId: string,
    solutionDir: string,
    refs: SkillReferenceV3[],
    warnings: string[],
  ): Promise<SkillImportResult[]> {
    const results: SkillImportResult[] = [];
    const seen = new Set<string>(); // dedupe (same slug imported by two refs)

    for (const ref of refs) {
      try {
        const skillDirs = this.resolveSkillRef(solutionDir, ref);
        for (const skillDir of skillDirs) {
          const slug = path.basename(skillDir);
          if (seen.has(slug)) continue;
          seen.add(slug);
          try {
            const result = await this.importOneSkill(solutionId, skillDir, slug);
            results.push(result);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            results.push({ slug, action: 'error', error: msg });
            warnings.push(`skill "${slug}": ${msg}`);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`skill ref ${JSON.stringify(ref)}: ${msg}`);
      }
    }

    return results;
  }

  /**
   * Resolve a single skill reference into a list of skill directories on disk.
   * Supports the three v3 forms: short string, `{folder}`, `{slug, name}`.
   * Glob support is limited to a trailing `/*` (e.g. `skills/*` →
   * every subdir of skills/) — full glob isn't worth dragging in a dep for.
   *
   * Security: `folder` comes from solution.json (potentially third-party
   * authored in a marketplace world). We resolve against `solutionDir`
   * and reject any path that escapes it via `..` — otherwise
   * `collectSkillFiles` would happily slurp `/etc/shadow` into the DB.
   * Also warns on unsupported glob shapes (`**`, brace expansion, mid-
   * path `*`) so the operator notices instead of seeing silent empty.
   */
  private resolveSkillRef(solutionDir: string, ref: SkillReferenceV3): string[] {
    const folder = typeof ref === 'string' ? ref : ('folder' in ref ? ref.folder : `skills/${ref.slug}`);
    const isGlob = folder.endsWith('/*');
    const baseRel = isGlob ? folder.slice(0, -2) : folder;
    // Reject unsupported glob shapes loudly — `**`, brace expansion, or
    // any `*` not at the trailing segment. Silent [] would mask config
    // typos for hours.
    const remaining = isGlob ? baseRel : folder;
    if (remaining.includes('*') || remaining.includes('{') || remaining.includes('?')) {
      this.logger.warn(
        `unsupported glob pattern "${folder}" — only trailing "/*" is supported; ` +
        `skipping`,
      );
      return [];
    }

    const solutionAbs = path.resolve(solutionDir);
    const baseAbs = path.resolve(solutionAbs, baseRel);
    // Boundary check: baseAbs must be solutionAbs itself or a descendant.
    if (baseAbs !== solutionAbs && !baseAbs.startsWith(solutionAbs + path.sep)) {
      this.logger.warn(
        `skill ref "${folder}" escapes solutionDir; refusing to import`,
      );
      return [];
    }

    if (!fs.existsSync(baseAbs)) return [];
    if (!isGlob) {
      // Single skill folder
      if (!fs.statSync(baseAbs).isDirectory()) return [];
      return [baseAbs];
    }
    // Glob — enumerate subdirs with a SKILL.md
    return fs.readdirSync(baseAbs, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join(baseAbs, e.name))
      .filter((dir) => fs.existsSync(path.join(dir, 'SKILL.md')));
  }

  /** Build CreateSkillDto from a skill dir + call SkillsService.create. */
  private async importOneSkill(
    solutionId: string,
    skillDir: string,
    slug: string,
  ): Promise<SkillImportResult> {
    // Skip if already registered — auto-import is bootstrap, not upgrade.
    const existing = await this.skills.findOne(solutionId, slug);
    if (existing) {
      return { slug, action: 'skipped' };
    }

    const skillMdPath = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
      throw new Error(`SKILL.md not found in ${skillDir}`);
    }

    const raw = fs.readFileSync(skillMdPath, 'utf8');
    const parsed = matter(raw);
    const fmResult = validateSkillFrontmatter(parsed.data);
    if (!fmResult.success) {
      const issues = fmResult.errors.map((e) => `${e.path}: ${e.message}`).join('; ');
      throw new Error(`invalid frontmatter: ${issues}`);
    }

    // Collect sibling files (everything under skillDir except SKILL.md itself)
    const budget: WalkBudget = { bytes: 0, count: 0, root: path.resolve(skillDir) };
    const files = this.collectSkillFiles(skillDir, skillDir, budget);

    await this.skills.create(solutionId, {
      slug,
      name: fmResult.data.name,
      description: fmResult.data.description,
      content: parsed.content, // SKILL.md body (markdown, no frontmatter)
      scope: 'solution',
      type: 'skill',
      files,
    });

    return { slug, action: 'created' };
  }

  /**
   * Recursively collect skill content files under skillDir. Returns
   * relative paths from skillDir root.
   *
   * Safety rails:
   *   - Per-file size cap (1MB) matches the SkillFile content column.
   *   - Per-skill aggregate caps (MAX_SKILL_FILES, MAX_SKILL_BYTES)
   *     prevent a hostile or accidental "every node_module" walk from
   *     OOMing boot.
   *   - Extension allowlist — only text/source files that a skill body
   *     could legitimately reference. Stops `secrets.json`, `id_rsa`,
   *     `*.env` etc. from getting persisted to the DB if someone drops
   *     them into a skill dir.
   *   - Path boundary — resolved absolute path of each candidate must
   *     stay inside the skill root (blocks symlink escapes; a `ln -s
   *     /etc /skills/manifest-editor/secrets` would otherwise be
   *     followed by readFileSync).
   *   - Skips dotfiles + node_modules.
   */
  private collectSkillFiles(
    skillDir: string,
    root: string,
    budget: WalkBudget,
  ): Array<{ relativePath: string; content: string }> {
    const out: Array<{ relativePath: string; content: string }> = [];
    const entries = fs.readdirSync(skillDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const abs = path.join(skillDir, entry.name);
      // Symlink-escape defence. The skill root was resolved once; every
      // descendant must be inside it.
      const resolved = path.resolve(abs);
      if (resolved !== budget.root && !resolved.startsWith(budget.root + path.sep)) {
        this.logger.warn(`skipping ${abs} — symlink escapes skill root`);
        continue;
      }
      if (entry.isDirectory()) {
        out.push(...this.collectSkillFiles(abs, root, budget));
        continue;
      }
      const rel = path.relative(root, abs);
      if (rel === 'SKILL.md') continue;
      // Extension allowlist. Anything outside this list gets dropped
      // with a debug log (not a warn — adding new types should be a
      // conscious decision, but skipping a stray .png isn't a problem).
      const ext = path.extname(entry.name).toLowerCase();
      if (!SKILL_FILE_EXTENSIONS.has(ext)) {
        this.logger.debug(`skipping ${rel} — extension "${ext}" not in skill allowlist`);
        continue;
      }
      if (budget.count >= MAX_SKILL_FILES) {
        this.logger.warn(
          `skill at ${root}: hit ${MAX_SKILL_FILES}-file cap; remaining files skipped`,
        );
        return out;
      }
      try {
        const stat = fs.statSync(abs);
        if (stat.size > 1024 * 1024) {
          this.logger.warn(`skipping ${abs} — exceeds 1MB per-file cap`);
          continue;
        }
        if (budget.bytes + stat.size > MAX_SKILL_BYTES) {
          this.logger.warn(
            `skill at ${root}: hit ${MAX_SKILL_BYTES}-byte aggregate cap; remaining files skipped`,
          );
          return out;
        }
        budget.bytes += stat.size;
        budget.count += 1;
        out.push({ relativePath: rel, content: fs.readFileSync(abs, 'utf8') });
      } catch (err) {
        this.logger.warn(`skipping ${abs} — ${err instanceof Error ? err.message : err}`);
      }
    }
    return out;
  }

  // --------------------------------------------------------------------------
  // Solution Registration
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
      this.logger.debug(`Solution "${slug}" already exists (${existing.id})`);
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
    solutionId: string,
    mcpServers: Record<string, McpServerDefinition>,
    warnings: string[],
    solutionDir?: string,
  ): Promise<McpServerLoadResult[]> {
    const results: McpServerLoadResult[] = [];

    for (const [slug, serverDef] of Object.entries(mcpServers)) {
      try {
        const result = await this.registerOneMcpServer(
          solutionId,
          slug,
          serverDef,
          warnings,
          solutionDir,
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
    solutionId: string,
    slug: string,
    serverDef: McpServerDefinition,
    warnings: string[],
    solutionDir?: string,
  ): Promise<McpServerLoadResult> {
    const existing = await this.mcpPool.findOne(solutionId, slug);

    if (existing) {
      // MCP server already exists - update config
      await this.mcpPool.update(solutionId, existing.id, {
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

      if (solutionDir) {
        this.materializeMcpServerBundle(solutionId, slug, serverDef, solutionDir, warnings);
      }

      if (serverDef.proxyEnabled && solutionDir) {
        await this.registerStdioToolkit(solutionId, slug, serverDef, solutionDir, warnings);
      }

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

    const created = await this.mcpPool.create(solutionId, dto);

    // Materialize the MCP server bundle into the tenant workspace tree so
    // per-session symlinks (WorkspaceService.createMcpSymlinks) resolve to
    // real files. Solutions that ship MCP servers in their source repo
    // (e.g., live-lesson/creator-mcp-server/) need this; without it the
    // symlink targets an empty dir and `node …/dist/index.js` ENOENTs,
    // leaving the MCP server invisible to the agent subprocess.
    if (solutionDir) {
      this.materializeMcpServerBundle(solutionId, slug, serverDef, solutionDir, warnings);
    } else {
      warnings.push(
        `MCP server "${slug}" registered without solutionDir — files not materialized; ` +
        `agent sessions will fail to spawn this server unless paths are absolute.`,
      );
    }

    if (serverDef.proxyEnabled && solutionDir) {
      await this.registerStdioToolkit(solutionId, slug, serverDef, solutionDir, warnings);
    }

    return {
      slug,
      name: serverDef.description || slug,
      action: 'created',
      serverId: created.id,
    };
  }

  /**
   * Materialize MCP server source files from the solution dir into the
   * tenant workspace tree at `<workspaceDir>/tenants/<solutionId>/mcp-servers/<slug>/`.
   *
   * Per-session WorkspaceService.createMcpSymlinks symlinks
   * `<session>/.claude/mcp-servers/<slug>` → that tenant path. Without
   * this step, the symlink target is empty and the MCP server fails to
   * spawn (ENOENT on `node <relative>/dist/index.js`).
   *
   * Strategy: write a single symlink from the tenant MCP root to the
   * solution dir. Yes, this exposes the whole solution dir, but the
   * agent subprocess can only invoke the exact dist/index.js path
   * declared in solution.json — the symlink is a routing convenience,
   * not an access boundary. Solutions that need stricter isolation
   * should ship MCP servers in a separate subdirectory and reference it
   * relative.
   *
   * Idempotent: removes any existing symlink first.
   */
  private materializeMcpServerBundle(
    solutionId: string,
    slug: string,
    serverDef: McpServerDefinition,
    solutionDir: string,
    warnings: string[],
  ): void {
    if (serverDef.type === 'rest-adapter') {
      // REST adapters are HTTP shims spawned in-process; no bundle to materialize.
      return;
    }
    const workspaceDir = this.cfg.get<string>('workspace.dir', '.agent-workspace');
    const workspaceRoot = path.resolve(workspaceDir);
    const tenantMcpRoot = path.join(workspaceRoot, 'tenants', solutionId, 'mcp-servers');
    const symlinkPath = path.join(tenantMcpRoot, slug);

    try {
      fs.mkdirSync(tenantMcpRoot, { recursive: true });
      if (fs.existsSync(symlinkPath) || fs.lstatSync(symlinkPath).isSymbolicLink?.()) {
        try { fs.unlinkSync(symlinkPath); } catch { /* missing is fine */ }
      }
      fs.symlinkSync(solutionDir, symlinkPath, 'dir');
      this.logger.debug(`Materialized MCP bundle: ${symlinkPath} → ${solutionDir}`);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' && !fs.existsSync(symlinkPath)) {
        // lstatSync threw because path doesn't exist; create the symlink fresh.
        try {
          fs.symlinkSync(solutionDir, symlinkPath, 'dir');
          this.logger.debug(`Materialized MCP bundle: ${symlinkPath} → ${solutionDir}`);
          return;
        } catch (err2) {
          warnings.push(`Failed to materialize MCP "${slug}": ${(err2 as Error).message}`);
          return;
        }
      }
      warnings.push(`Failed to materialize MCP "${slug}": ${(err as Error).message}`);
    }
  }

  // --------------------------------------------------------------------------
  // Session Template Registration
  // --------------------------------------------------------------------------

  /**
   * Apply session templates from config body to the tenant config.
   * Uses upsert logic: merges declared templates with any existing ones.
   */
  private async applySessionTemplates(
    solutionId: string,
    templates: Record<string, SessionTemplateConfig>,
    warnings: string[],
  ): Promise<void> {
    const tenant = await this.tenants.findOne(solutionId);
    if (!tenant) {
      warnings.push(`Cannot apply session templates: tenant "${solutionId}" not found`);
      this.logger.warn(`Cannot apply session templates: tenant "${solutionId}" not found`);
      return;
    }

    const existing = (tenant.config?.sessionTemplates ?? {}) as Record<string, SessionTemplateConfig>;
    const merged: Record<string, SessionTemplateConfig> = { ...existing, ...templates };

    // Validate that every enabledSkills entry is registered for this tenant
    for (const [templateName, template] of Object.entries(templates)) {
      for (const entry of template.enabledSkills ?? []) {
        const slug = typeof entry === 'string' ? entry : entry.slug;
        const skill = await this.skills.findOne(solutionId, slug);
        if (!skill) {
          warnings.push(
            `Session template "${templateName}": skill slug "${slug}" not found in tenant — ` +
            `template saved but enabledSkills may not work until skill is registered`,
          );
        }
      }
    }

    await this.tenants.update(solutionId, {
      config: { sessionTemplates: merged },
    });

    warnings.push(
      `Applied ${Object.keys(templates).length} session template(s): ${Object.keys(templates).join(', ')}`,
    );
    this.logger.log(`Applied session templates for tenant "${solutionId}"`);
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
    solutionId: string,
    bundleIdsToSync: string[],
    logMessage: string,
  ): Promise<string[]> {
    if (bundleIdsToSync.length === 0) {
      const tenant = await this.tenants.findOne(solutionId);
      return tenant?.config?.enabledBundles ?? [];
    }

    const tenant = await this.tenants.findOne(solutionId);
    const existing = new Set(tenant?.config?.enabledBundles ?? []);
    const merged = [...new Set([...existing, ...bundleIdsToSync])];

    if (merged.length > existing.size) {
      await this.tenants.update(solutionId, {
        config: { enabledBundles: merged },
      });
      this.logger.log(`Solution ${solutionId}: ${logMessage}: [${merged.join(', ')}]`);
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

  // --------------------------------------------------------------------------
  // ToolCallerProxy migration (Phase 4, docs/design-tool-caller-proxy.md §5.1)
  // --------------------------------------------------------------------------

  /**
   * Bootstrap a `StdioMcpToolkit` for an MCP server that declared
   * `proxyEnabled: true` and register it in the toolkit registry.
   *
   * To avoid drift between the stdio server's own `inputSchema` and a
   * hand-mirrored Zod schema in ccaas-core, we probe the running
   * subprocess at import time: spawn it, send `initialize` +
   * `tools/list`, capture each tool's name/description/inputSchema,
   * shut it down. The registered ToolDefinition uses `z.unknown()` for
   * `argsSchema` (the ToolCallerProxy's reserved-field strip still
   * runs; structural validation is delegated to the stdio server
   * itself which re-validates anyway), and exposes the captured JSON
   * Schema directly to Claude Code via `jsonSchemaOverride`.
   *
   * Failure modes are non-fatal: a missing entry point or a
   * misbehaving server adds a warning and skips registration. The
   * solution still loads — its tools just won't be available through
   * the proxy until the next reload.
   */
  private async registerStdioToolkit(
    solutionId: string,
    slug: string,
    serverDef: McpServerDefinition,
    solutionDir: string,
    warnings: string[],
  ): Promise<void> {
    if (serverDef.type === 'rest-adapter') {
      warnings.push(
        `MCP server "${slug}" has proxyEnabled=true but type=rest-adapter; ` +
        `proxy supports stdio servers only this round — skipping registration`,
      );
      return;
    }
    if (!serverDef.args || serverDef.args.length === 0) {
      warnings.push(`MCP server "${slug}" has proxyEnabled=true but no args — skipping registration`);
      return;
    }
    const solutionAbs = path.resolve(solutionDir);
    const serverEntry = path.resolve(solutionAbs, serverDef.args[0]);
    // Bound the entry path inside solutionDir. A solution.json declaring
    // `args: ["../../etc/passwd"]` resolves outside the dir; without this
    // check we'd spawn `node` against any reachable file. The skill
    // walker uses the same pattern.
    if (
      serverEntry !== solutionAbs &&
      !serverEntry.startsWith(solutionAbs + path.sep)
    ) {
      warnings.push(
        `MCP server "${slug}" entry path "${serverDef.args[0]}" escapes solution dir — refusing to register`,
      );
      return;
    }
    if (!fs.existsSync(serverEntry)) {
      warnings.push(
        `MCP server "${slug}" entry "${serverEntry}" does not exist — skipping toolkit registration`,
      );
      return;
    }

    let toolSpecs: StdioToolSpec[];
    try {
      toolSpecs = await this.probeStdioToolList(serverEntry, solutionDir, serverDef.env);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(
        `MCP server "${slug}" toolkit probe failed: ${msg} — proxy will not see this server's tools until next reload`,
      );
      return;
    }

    const toolkit = new StdioMcpToolkit({
      solutionId,
      namespace: slug,
      serverEntry,
      cwd: solutionDir,
      env: serverDef.env,
      tools: toolSpecs,
    });
    this.toolkitRegistry.registerToolkit(toolkit);
    this.logger.log(
      `Registered StdioMcpToolkit "${slug}" for solution ${solutionId} ` +
      `(${toolSpecs.length} tool(s) — proxy enabled)`,
    );
  }

  /**
   * Spawn the stdio MCP server briefly to probe its tool list +
   * inputSchema. Sends MCP `initialize` then `tools/list`, parses the
   * single response, and kills the subprocess. Uses raw spawn rather
   * than going through StdioMcpToolkit because we don't want to leak
   * an idle child after the probe.
   */
  private probeStdioToolList(
    serverEntry: string,
    cwd: string,
    extraEnv: Record<string, string> | undefined,
  ): Promise<StdioToolSpec[]> {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [serverEntry], {
        cwd,
        // Match runtime: untrusted solution code never sees the backend's
        // secret env (CCAAS_API_KEY, LLM keys, DATABASE_PATH, etc.).
        env: {
          ...sanitizeEnvForSolutionSubprocess(process.env),
          ...(extraEnv ?? {}),
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let buf = '';
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`probeStdioToolList timed out after 5s for ${serverEntry}`));
      }, 5000).unref();
      child.stdout!.setEncoding('utf8');
      child.stdout!.on('data', (chunk: string) => {
        buf += chunk;
        let nl: number;
        while ((nl = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let msg: { id?: number; result?: { tools?: unknown[] }; error?: { message: string } };
          try { msg = JSON.parse(line); } catch { continue; }
          if (msg.id !== 2) continue; // ignore init reply (id=1) + anything else
          clearTimeout(timeout);
          child.kill('SIGTERM');
          if (msg.error) {
            reject(new Error(`stdio MCP tools/list errored: ${msg.error.message}`));
            return;
          }
          const rawTools = msg.result?.tools;
          if (!Array.isArray(rawTools)) {
            reject(new Error('stdio MCP tools/list returned no tools[] array'));
            return;
          }
          const specs: StdioToolSpec[] = [];
          for (const t of rawTools as Array<{
            name?: unknown;
            description?: unknown;
            inputSchema?: unknown;
          }>) {
            if (typeof t.name !== 'string' || !t.name) continue;
            specs.push({
              name: t.name,
              description: typeof t.description === 'string' ? t.description : '',
              // Defer schema validation to the stdio server itself;
              // the proxy's reserved-field strip still runs upstream.
              // Stash the JSON Schema on the spec via a side-channel
              // (`jsonSchemaOverride` field on the resulting
              // ToolDefinition — supplied by StdioMcpToolkit when it
              // builds defs from these specs).
              argsSchema: z.unknown(),
              jsonSchemaOverride:
                t.inputSchema && typeof t.inputSchema === 'object'
                  ? (t.inputSchema as Record<string, unknown>)
                  : undefined,
            });
          }
          resolve(specs);
        }
      });
      child.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      child.on('exit', () => {
        clearTimeout(timeout);
      });
      // Send initialize + tools/list back to back. The server
      // queues the second until init completes, which is fine.
      const init = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'ccaas-solution-loader', version: '1.0.0' },
        },
      };
      const initialized = { jsonrpc: '2.0', method: 'notifications/initialized' };
      const list = { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} };
      child.stdin!.write(`${JSON.stringify(init)}\n`);
      child.stdin!.write(`${JSON.stringify(initialized)}\n`);
      child.stdin!.write(`${JSON.stringify(list)}\n`);
    });
  }
}
