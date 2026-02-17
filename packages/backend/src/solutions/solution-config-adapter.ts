/**
 * Solution Config Adapter - Multi-Version Migration
 *
 * Migrates solution.json configurations across versions (v1 → v2 → v3).
 * Handles all known v1 variations and v2 structured format.
 * Always returns normalized v3 format (simplified, flattened).
 *
 * Usage:
 *   const adapter = new SolutionConfigAdapter();
 *   const v3Config = adapter.adapt(rawJsonConfig);
 */

import { Logger } from '@nestjs/common';
import {
  detectSchemaVersion,
  SolutionConfigV3Schema,
  SolutionConfigV2Schema,
  SolutionConfigV1Schema,
  type SolutionConfigV3,
  type SolutionConfigV2,
  type SolutionConfigV1,
  type SkillDefinition,
  type McpServerDefinition,
} from './dto/solution-config.dto';

// ============================================================================
// Types
// ============================================================================

export interface AdaptResult {
  success: true;
  data: SolutionConfigV3;
  migrated: boolean;
  warnings: string[];
}

export interface AdaptError {
  success: false;
  errors: string[];
}

export type AdaptOutcome = AdaptResult | AdaptError;

// ============================================================================
// Adapter
// ============================================================================

export class SolutionConfigAdapter {
  private readonly logger = new Logger(SolutionConfigAdapter.name);

  /**
   * Main entry point. Accepts a raw parsed JSON object and returns a v3 config.
   *
   * - If already v3, validates and returns as-is.
   * - If v2, migrates to v3 and validates the result.
   * - If v1, migrates to v2, then v3, and validates the result.
   * - If invalid, returns structured errors.
   */
  adapt(raw: unknown): AdaptOutcome {
    if (raw === null || raw === undefined || typeof raw !== 'object') {
      return {
        success: false,
        errors: ['Config must be a non-null object'],
      };
    }

    const version = detectSchemaVersion(raw);

    if (version === '3.0') {
      return this.validateV3(raw);
    }

    if (version === '2.0') {
      return this.migrateV2ToV3(raw);
    }

    return this.migrateV1ToV3(raw);
  }

  // --------------------------------------------------------------------------
  // V3 pass-through validation
  // --------------------------------------------------------------------------

  private validateV3(raw: unknown): AdaptOutcome {
    const result = SolutionConfigV3Schema.safeParse(raw);
    if (result.success) {
      return {
        success: true,
        data: result.data,
        migrated: false,
        warnings: [],
      };
    }

    return {
      success: false,
      errors: result.error.issues.map(
        (i) => `${i.path.join('.')}: ${i.message}`,
      ),
    };
  }

  // --------------------------------------------------------------------------
  // V2 -> V3 Migration
  // --------------------------------------------------------------------------

  /**
   * Migrate a v2 config to v3.
   *
   * Key changes:
   * - Flatten ccaas/internal structure to top-level
   * - Convert skills from detailed objects to folder paths
   * - Remove discovery.mode (unused)
   * - Set default skills: ['skills/*'] if no skills defined
   */
  private migrateV2ToV3(raw: unknown): AdaptOutcome {
    const warnings: string[] = [];
    const v2Result = SolutionConfigV2Schema.safeParse(raw);

    if (!v2Result.success) {
      return {
        success: false,
        errors: v2Result.error.issues.map(
          (i) => `Invalid v2 config: ${i.path.join('.')}: ${i.message}`,
        ),
      };
    }

    const v2 = v2Result.data;

    // Extract skill folder paths from v2 skill definitions
    const skills = v2.ccaas.discovery.skills
      .map((s) => {
        if (s.skillFile) {
          // Extract folder from skillFile path (e.g., "skills/analyzer/SKILL.md" -> "skills/analyzer")
          return s.skillFile.replace(/\/SKILL\.md$/i, '');
        }
        // Fallback: construct path from slug
        warnings.push(
          `Skill "${s.slug}" has no skillFile, using default path "skills/${s.slug}"`,
        );
        return `skills/${s.slug}`;
      })
      .filter((path, index, arr) => arr.indexOf(path) === index); // Remove duplicates

    // Build v3 config
    const v3: SolutionConfigV3 = {
      schemaVersion: '3.0',
      tenant: v2.ccaas.tenant,
      skills: skills.length > 0 ? skills : ['skills/*'], // Default to wildcard if no skills
      mcpServers: v2.ccaas.discovery.mcpServers,
    };

    // Migrate internal config (flatten to top-level)
    if (v2.internal) {
      if (v2.internal.backend) v3.backend = v2.internal.backend;
      if (v2.internal.frontend) v3.frontend = v2.internal.frontend;
      if (v2.internal.syncFields) v3.syncFields = v2.internal.syncFields;
      if (v2.internal.setup) v3.setup = v2.internal.setup;
    }

    // Validate the migrated config
    const validation = SolutionConfigV3Schema.safeParse(v3);
    if (!validation.success) {
      return {
        success: false,
        errors: validation.error.issues.map(
          (i) => `Migration produced invalid v3: ${i.path.join('.')}: ${i.message}`,
        ),
      };
    }

    if (warnings.length > 0) {
      this.logger.log(
        `Migrated "${v2.ccaas.tenant.name}" from v2 to v3 with ${warnings.length} warning(s): ${warnings.join('; ')}`,
      );
    }

    return {
      success: true,
      data: validation.data,
      migrated: true,
      warnings,
    };
  }

  // --------------------------------------------------------------------------
  // V1 -> V3 Migration (via V2)
  // --------------------------------------------------------------------------

  /**
   * Migrate v1 to v3 by first migrating to v2, then to v3.
   */
  private migrateV1ToV3(raw: unknown): AdaptOutcome {
    // First migrate v1 -> v2
    const v2Outcome = this.migrateV1ToV2Internal(raw);
    if (!v2Outcome.success) {
      return v2Outcome as AdaptError;
    }

    // Then migrate v2 -> v3
    const v3Outcome = this.migrateV2ToV3(v2Outcome.data);
    if (!v3Outcome.success) {
      return v3Outcome;
    }

    // Combine warnings from both migrations
    return {
      success: true,
      data: v3Outcome.data,
      migrated: true,
      warnings: [...v2Outcome.warnings, ...v3Outcome.warnings],
    };
  }

  // --------------------------------------------------------------------------
  // V1 -> V2 Migration (Internal)
  // --------------------------------------------------------------------------

  /**
   * Internal method: Migrate a v1 config to v2.
   *
   * Returns v2 config (not v3) for use in v1->v3 migration chain.
   *
   * Strategy:
   *  1. Loosely parse v1 (collecting warnings for deviations)
   *  2. Map v1 fields to v2 structure
   *  3. Validate the resulting v2 object
   */
  private migrateV1ToV2Internal(raw: unknown): { success: true; data: SolutionConfigV2; warnings: string[] } | { success: false; errors: string[] } {
    const warnings: string[] = [];
    const obj = raw as Record<string, unknown>;

    // --- Extract tenant info ---
    const name = this.extractString(obj, 'name', 'Unnamed Solution', warnings);
    const slug = this.extractString(
      obj,
      'slug',
      this.slugify(name),
      warnings,
    );
    const description = this.extractOptionalString(obj, 'description');

    // --- Extract skills ---
    const skills = this.extractSkills(obj, warnings);

    // --- Extract MCP servers ---
    const mcpServers = this.extractMcpServers(obj, warnings);

    // --- Extract internal config ---
    const internal = this.extractInternalConfig(obj, warnings);

    // --- Build v2 ---
    const v2: SolutionConfigV2 = {
      schemaVersion: '2.0',
      ccaas: {
        tenant: {
          name,
          slug,
          ...(description ? { description } : {}),
        },
        discovery: {
          enabled: true,
          mode: 'auto',
          skills,
          mcpServers,
        },
      },
      ...(Object.keys(internal).length > 0 ? { internal } : {}),
    };

    // --- Validate the migrated config ---
    const validation = SolutionConfigV2Schema.safeParse(v2);
    if (!validation.success) {
      return {
        success: false,
        errors: validation.error.issues.map(
          (i) => `Migration produced invalid v2: ${i.path.join('.')}: ${i.message}`,
        ),
      };
    }

    if (warnings.length > 0) {
      this.logger.warn(
        `Migrated "${name}" from v1 to v2 with ${warnings.length} warning(s): ${warnings.join('; ')}`,
      );
    }

    return {
      success: true,
      data: validation.data,
      warnings,
    };
  }

  // --------------------------------------------------------------------------
  // Skill Extraction
  // --------------------------------------------------------------------------

  private extractSkills(
    obj: Record<string, unknown>,
    warnings: string[],
  ): SkillDefinition[] {
    const skills: SkillDefinition[] = [];

    // v1 format 1: "skills" array (quiz-analyzer, lesson-plan-designer, problem-explainer)
    if (Array.isArray(obj.skills)) {
      for (const s of obj.skills) {
        const skill = this.normalizeSkill(s, warnings);
        if (skill) skills.push(skill);
      }
    }

    // v1 format 2: "skill" single object (edu-agent, lego-playground)
    if (obj.skill && typeof obj.skill === 'object' && !Array.isArray(obj.skill)) {
      const skill = this.normalizeSkill(obj.skill, warnings);
      if (skill) skills.push(skill);
    }

    if (skills.length === 0 && (obj.skills || obj.skill)) {
      warnings.push('Skills defined but none could be parsed');
    }

    return skills;
  }

  /**
   * Normalize a single skill object from v1 to v2 SkillDefinition shape.
   */
  private normalizeSkill(
    raw: unknown,
    warnings: string[],
  ): SkillDefinition | null {
    if (!raw || typeof raw !== 'object') {
      warnings.push('Skipping non-object skill entry');
      return null;
    }

    const s = raw as Record<string, unknown>;

    const name = typeof s.name === 'string' && s.name.length > 0
      ? s.name
      : undefined;

    if (!name) {
      warnings.push('Skipping skill with missing name');
      return null;
    }

    const slug = typeof s.slug === 'string' && s.slug.length > 0
      ? s.slug
      : this.slugify(name);

    const skill: SkillDefinition = {
      name,
      slug,
      scope: (s.scope === 'tenant' || s.scope === 'personal') ? s.scope : 'tenant',
    };

    if (typeof s.description === 'string') skill.description = s.description;
    if (typeof s.skillFile === 'string') skill.skillFile = s.skillFile;
    if (typeof s.instructions === 'string') skill.instructions = s.instructions;
    if (typeof s.outputFormat === 'string') skill.outputFormat = s.outputFormat;

    // Triggers
    if (Array.isArray(s.triggers)) {
      skill.triggers = this.normalizeTriggers(s.triggers, warnings);
    }

    // Allowed tools
    if (Array.isArray(s.allowedTools)) {
      skill.allowedTools = s.allowedTools.filter(
        (t): t is string => typeof t === 'string' && t.length > 0,
      );
    }

    // Related skills
    if (Array.isArray(s.relatedSkills)) {
      skill.relatedSkills = s.relatedSkills.filter(
        (r): r is string => typeof r === 'string',
      );
    }

    // Chained skills - can be on skill or top-level
    if (s.chainedSkills && typeof s.chainedSkills === 'object') {
      skill.chainedSkills = this.normalizeChainedSkills(
        s.chainedSkills as Record<string, unknown>,
      );
    }

    return skill;
  }

  private normalizeTriggers(
    triggers: unknown[],
    warnings: string[],
  ): Array<{ type: 'keyword' | 'intent' | 'pattern' | 'context'; value: string; priority?: number; description?: string }> {
    const result: Array<{ type: 'keyword' | 'intent' | 'pattern' | 'context'; value: string; priority?: number; description?: string }> = [];

    for (const t of triggers) {
      if (typeof t === 'string') {
        // Some v1 configs might have string-only triggers
        result.push({ type: 'keyword', value: t });
        continue;
      }

      if (t && typeof t === 'object') {
        const trigger = t as Record<string, unknown>;
        const type = trigger.type;
        const value = trigger.value;

        if (
          typeof value === 'string' &&
          value.length > 0 &&
          (type === 'keyword' || type === 'intent' || type === 'pattern' || type === 'context')
        ) {
          const normalized: { type: 'keyword' | 'intent' | 'pattern' | 'context'; value: string; priority?: number; description?: string } = {
            type,
            value,
          };
          if (typeof trigger.priority === 'number') {
            normalized.priority = trigger.priority;
          }
          if (typeof trigger.description === 'string') {
            normalized.description = trigger.description;
          }
          result.push(normalized);
        } else {
          warnings.push(`Skipping invalid trigger: type=${String(type)}, value=${String(value)}`);
        }
      }
    }

    return result;
  }

  private normalizeChainedSkills(
    raw: Record<string, unknown>,
  ): Record<string, { description?: string; triggerPhrase?: string; inputFrom?: string; outputTo?: string }> {
    const result: Record<string, { description?: string; triggerPhrase?: string; inputFrom?: string; outputTo?: string }> = {};

    for (const [key, val] of Object.entries(raw)) {
      if (val && typeof val === 'object') {
        const cs = val as Record<string, unknown>;
        const entry: { description?: string; triggerPhrase?: string; inputFrom?: string; outputTo?: string } = {};
        if (typeof cs.description === 'string') entry.description = cs.description;
        if (typeof cs.triggerPhrase === 'string') entry.triggerPhrase = cs.triggerPhrase;
        if (typeof cs.inputFrom === 'string') entry.inputFrom = cs.inputFrom;
        if (typeof cs.outputTo === 'string') entry.outputTo = cs.outputTo;
        result[key] = entry;
      }
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // MCP Server Extraction
  // --------------------------------------------------------------------------

  private extractMcpServers(
    obj: Record<string, unknown>,
    warnings: string[],
  ): Record<string, McpServerDefinition> {
    const servers: Record<string, McpServerDefinition> = {};

    if (!obj.mcpServers || typeof obj.mcpServers !== 'object') {
      return servers;
    }

    const raw = obj.mcpServers as Record<string, unknown>;

    for (const [name, val] of Object.entries(raw)) {
      if (!val || typeof val !== 'object') {
        warnings.push(`Skipping non-object MCP server: ${name}`);
        continue;
      }

      const server = val as Record<string, unknown>;
      const command = typeof server.command === 'string' ? server.command : undefined;

      if (!command) {
        warnings.push(`MCP server "${name}" missing command, skipping`);
        continue;
      }

      const type = server.type === 'rest-adapter' ? 'rest-adapter' as const : 'stdio' as const;

      const def: McpServerDefinition = {
        command,
        args: Array.isArray(server.args)
          ? server.args.filter((a): a is string => typeof a === 'string')
          : [],
        type,
      };

      if (typeof server.description === 'string') def.description = server.description;
      if (server.env && typeof server.env === 'object') {
        const env: Record<string, string> = {};
        for (const [k, v] of Object.entries(server.env as Record<string, unknown>)) {
          if (typeof v === 'string') env[k] = v;
        }
        if (Object.keys(env).length > 0) def.env = env;
      }

      servers[name] = def;
    }

    return servers;
  }

  // --------------------------------------------------------------------------
  // Internal Config Extraction
  // --------------------------------------------------------------------------

  private extractInternalConfig(
    obj: Record<string, unknown>,
    warnings: string[],
  ): Record<string, unknown> {
    const internal: Record<string, unknown> = {};

    // Backend
    if (obj.backend && typeof obj.backend === 'object') {
      const b = obj.backend as Record<string, unknown>;
      const backend: Record<string, unknown> = {};

      if (typeof b.port === 'number') backend.port = b.port;
      if (typeof b.ccaasUrl === 'string') backend.ccaasUrl = b.ccaasUrl;
      if (b.database && typeof b.database === 'object') backend.database = b.database;

      if (backend.port) {
        internal.backend = backend;
      } else {
        warnings.push('Backend config missing port, skipping');
      }
    }

    // Frontend
    if (obj.frontend && typeof obj.frontend === 'object') {
      const f = obj.frontend as Record<string, unknown>;
      const frontend: Record<string, unknown> = {};

      if (typeof f.port === 'number') frontend.port = f.port;
      if (typeof f.apiBaseUrl === 'string') frontend.apiBaseUrl = f.apiBaseUrl;

      if (frontend.port) {
        internal.frontend = frontend;
      } else {
        warnings.push('Frontend config missing port, skipping');
      }
    }

    // SyncFields
    if (obj.syncFields) {
      internal.syncFields = obj.syncFields;
    }

    // Setup
    if (obj.setup && typeof obj.setup === 'object') {
      internal.setup = obj.setup;
    }

    return internal;
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  private extractString(
    obj: Record<string, unknown>,
    key: string,
    fallback: string,
    warnings: string[],
  ): string {
    const val = obj[key];
    if (typeof val === 'string' && val.length > 0) return val;
    warnings.push(`Missing or empty "${key}", using fallback: "${fallback}"`);
    return fallback;
  }

  private extractOptionalString(
    obj: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const val = obj[key];
    return typeof val === 'string' && val.length > 0 ? val : undefined;
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      || 'unnamed';
  }
}
