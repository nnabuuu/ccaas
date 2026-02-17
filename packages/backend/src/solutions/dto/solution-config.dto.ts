/**
 * Solution Configuration v2 Schema & DTOs
 *
 * Zod schemas for validating solution.json configuration files.
 * Supports both v1 (flat) and v2 (structured ccaas/internal sections) formats.
 *
 * v2 separates platform-facing config (ccaas) from solution-internal config (internal),
 * enabling auto-discovery of skills and MCP servers by the CCAAS backend.
 */

import { z } from 'zod';

// ============================================================================
// Shared Sub-Schemas (used in both v1 and v2)
// ============================================================================

/**
 * Skill trigger configuration
 */
export const SkillTriggerSchema = z.object({
  type: z.enum(['keyword', 'intent', 'pattern', 'context']),
  value: z.string().min(1),
  priority: z.number().int().min(0).max(100).optional(),
  description: z.string().optional(),
});

/**
 * Chained skill configuration
 */
export const ChainedSkillSchema = z.object({
  description: z.string().optional(),
  triggerPhrase: z.string().optional(),
  inputFrom: z.string().optional(),
  outputTo: z.string().optional(),
});

/**
 * Skill definition used in solution.json
 */
export const SkillDefinitionSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().optional(),
  skillFile: z.string().optional(),
  scope: z.enum(['tenant', 'personal']).default('tenant'),
  instructions: z.string().optional(),
  triggers: z.array(SkillTriggerSchema).optional(),
  allowedTools: z.array(z.string()).optional(),
  relatedSkills: z.array(z.string()).optional(),
  chainedSkills: z.record(ChainedSkillSchema).optional(),
  outputFormat: z.string().optional(),
});

/**
 * MCP server configuration in solution.json
 */
export const McpServerDefinitionSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  description: z.string().optional(),
  type: z.enum(['stdio', 'rest-adapter']).default('stdio'),
  env: z.record(z.string()).optional(),
});

/**
 * Database configuration for solution backends
 */
export const DatabaseConfigSchema = z.object({
  type: z.enum(['sqlite', 'postgres']).default('sqlite'),
  path: z.string().optional(),
  url: z.string().optional(),
});

/**
 * Setup/lifecycle scripts configuration
 */
export const SetupConfigSchema = z.object({
  skipSteps: z.array(z.string()).default([]),
  customScripts: z.object({
    preInstall: z.string().optional(),
    customInit: z.string().optional(),
    postInstall: z.string().optional(),
  }).optional(),
});

// ============================================================================
// V2 Schema: Structured with ccaas + internal sections
// ============================================================================

/**
 * Tenant configuration - identifies the solution on the platform
 */
export const TenantConfigSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().optional(),
});

/**
 * Discovery configuration - what CCAAS auto-discovers
 */
export const DiscoveryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  mode: z.enum(['auto', 'manual']).default('auto'),
  skills: z.array(SkillDefinitionSchema).default([]),
  mcpServers: z.record(McpServerDefinitionSchema).default({}),
});

/**
 * The ccaas section - platform-facing configuration
 * This is what the CCAAS backend reads for auto-discovery
 */
export const CcaasConfigSchema = z.object({
  tenant: TenantConfigSchema,
  discovery: DiscoveryConfigSchema.default({
    enabled: true,
    mode: 'auto',
    skills: [],
    mcpServers: {},
  }),
});

/**
 * Backend configuration (internal to solution)
 */
export const BackendConfigSchema = z.object({
  port: z.number().int().min(1).max(65535),
  ccaasUrl: z.string().url().default('http://localhost:3001'),
  database: DatabaseConfigSchema.optional(),
});

/**
 * Frontend configuration (internal to solution)
 */
export const FrontendConfigSchema = z.object({
  port: z.number().int().min(1).max(65535),
  apiBaseUrl: z.string().optional(),
});

/**
 * Internal section - solution-private configuration
 * Not used by CCAAS backend, only by the solution itself
 */
export const InternalConfigSchema = z.object({
  backend: BackendConfigSchema.optional(),
  frontend: FrontendConfigSchema.optional(),
  syncFields: z.union([
    z.array(z.string()),
    z.record(z.array(z.string())),
  ]).optional(),
  setup: SetupConfigSchema.optional(),
});

/**
 * Complete solution.json v2 schema
 */
export const SolutionConfigV2Schema = z.object({
  $schema: z.string().optional(),
  schemaVersion: z.literal('2.0'),
  ccaas: CcaasConfigSchema,
  internal: InternalConfigSchema.optional(),
});

// ============================================================================
// V1 Schema: Flat structure (existing format)
// ============================================================================

/**
 * V1 skill definition - supports both array and single-object format
 */
const V1SkillSingleSchema = z.object({
  name: z.string(),
  slug: z.string().optional(),
  description: z.string().optional(),
  skillFile: z.string().optional(),
  scope: z.enum(['tenant', 'personal']).optional(),
  instructions: z.string().optional(),
  triggers: z.union([
    z.array(SkillTriggerSchema),
    z.array(z.string()),
  ]).optional(),
  allowedTools: z.array(z.string()).optional(),
  relatedSkills: z.array(z.string()).optional(),
  chainedSkills: z.record(ChainedSkillSchema).optional(),
  outputFormat: z.string().optional(),
});

/**
 * Complete solution.json v1 schema (flat, legacy format)
 */
export const SolutionConfigV1Schema = z.object({
  $schema: z.string().optional(),
  name: z.string().min(1),
  slug: z.string().min(1),
  version: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),

  backend: z.object({
    port: z.number(),
    ccaasUrl: z.string().optional(),
    database: DatabaseConfigSchema.optional(),
  }).optional(),

  frontend: z.object({
    port: z.number(),
    apiBaseUrl: z.string().optional(),
  }).optional(),

  mcpServers: z.record(McpServerDefinitionSchema).optional(),

  // Skills can be an array or a single object
  skills: z.array(V1SkillSingleSchema).optional(),
  skill: V1SkillSingleSchema.optional(),

  syncFields: z.union([
    z.array(z.string()),
    z.record(z.array(z.string())),
  ]).optional(),

  chainedSkills: z.record(ChainedSkillSchema).optional(),
  workflow: z.record(z.unknown()).optional(),
  subjects: z.array(z.record(z.unknown())).optional(),
  setup: SetupConfigSchema.optional(),
  mcpServer: z.record(z.unknown()).optional(),
});

// ============================================================================
// Version Detection & Unified Parsing
// ============================================================================

export type SchemaVersion = '1.0' | '2.0' | '3.0';

/**
 * Detect schema version from raw config object.
 *
 * Detection logic:
 * 1. Explicit schemaVersion field ('3.0', '2.0') -> use that version
 * 2. Presence of 'ccaas' top-level key -> v2
 * 3. Everything else -> v1 (legacy)
 */
export function detectSchemaVersion(config: unknown): SchemaVersion {
  if (config === null || typeof config !== 'object') {
    return '1.0';
  }

  const obj = config as Record<string, unknown>;

  if (obj.schemaVersion === '3.0') {
    return '3.0';
  }

  if (obj.schemaVersion === '2.0') {
    return '2.0';
  }

  if ('ccaas' in obj && typeof obj.ccaas === 'object' && obj.ccaas !== null) {
    return '2.0';
  }

  return '1.0';
}

/**
 * Result of validating a solution config
 */
export type SolutionConfigValidationResult =
  | { success: true; version: '1.0'; data: SolutionConfigV1 }
  | { success: true; version: '2.0'; data: SolutionConfigV2 }
  | { success: true; version: '3.0'; data: SolutionConfigV3 }
  | { success: false; version: SchemaVersion; errors: z.ZodError };

/**
 * Validate a raw config object against the appropriate schema version.
 * Automatically detects the version and validates accordingly.
 */
export function validateSolutionConfig(config: unknown): SolutionConfigValidationResult {
  const version = detectSchemaVersion(config);

  if (version === '3.0') {
    const result = SolutionConfigV3Schema.safeParse(config);
    if (result.success) {
      return { success: true, version: '3.0', data: result.data };
    }
    return { success: false, version: '3.0', errors: result.error };
  }

  if (version === '2.0') {
    const result = SolutionConfigV2Schema.safeParse(config);
    if (result.success) {
      return { success: true, version: '2.0', data: result.data };
    }
    return { success: false, version: '2.0', errors: result.error };
  }

  const result = SolutionConfigV1Schema.safeParse(config);
  if (result.success) {
    return { success: true, version: '1.0', data: result.data };
  }
  return { success: false, version: '1.0', errors: result.error };
}

// ============================================================================
// V3 Schema: Flattened with skills as folder paths
// ============================================================================

/**
 * Skill reference in v3 - can be a string path or object with folder
 * Supports wildcard patterns: "skills/*", "custom-skills/analyzer"
 */
export const SkillReferenceV3Schema = z.union([
  z.string().min(1),  // "skills/*" or "skills/specific-skill"
  z.object({ folder: z.string().min(1) }),  // { folder: "skills/specific-skill" }
]);

/**
 * Complete solution.json v3 schema - simplified and flattened
 *
 * Key changes from v2:
 * - Flattened structure (no ccaas/internal nesting)
 * - Skills as folder paths with wildcard support
 * - Default skills: ['skills/*'] (convention over configuration)
 * - Removed discovery.mode (unused feature)
 * - Top-level fields for better readability
 */
export const SolutionConfigV3Schema = z.object({
  $schema: z.string().optional(),
  schemaVersion: z.literal('3.0'),

  // ============ CCAAS Core Configuration ============
  /** Tenant identification - required by CCAAS Core */
  tenant: TenantConfigSchema,

  /**
   * Skill folder paths (supports wildcards)
   * Default: ['skills/*'] - auto-discovers all skills in skills/ directory
   * Examples:
   *   - ['skills/*'] - all skills in skills/
   *   - ['skills/analyzer', 'skills/generator'] - specific skills
   *   - ['skills/*', 'custom-skills/special'] - multiple patterns
   */
  skills: z.array(SkillReferenceV3Schema).default(['skills/*']),

  /** MCP server configuration */
  mcpServers: z.record(McpServerDefinitionSchema).default({}),

  // ============ Solution Internal Configuration ============
  /** Backend configuration (not used by CCAAS Core) */
  backend: BackendConfigSchema.optional(),

  /** Frontend configuration (not used by CCAAS Core) */
  frontend: FrontendConfigSchema.optional(),

  /** Synchronized fields for real-time updates (not used by CCAAS Core) */
  syncFields: z.union([
    z.array(z.string()),
    z.record(z.array(z.string())),
  ]).optional(),

  /** Setup/lifecycle scripts (not used by CCAAS Core) */
  setup: SetupConfigSchema.optional(),
});

// ============================================================================
// Inferred TypeScript Types
// ============================================================================

/** v3 top-level config type */
export type SolutionConfigV3 = z.infer<typeof SolutionConfigV3Schema>;

/** v2 top-level config type */
export type SolutionConfigV2 = z.infer<typeof SolutionConfigV2Schema>;

/** v1 top-level config type */
export type SolutionConfigV1 = z.infer<typeof SolutionConfigV1Schema>;

/** Skill reference (v3) */
export type SkillReferenceV3 = z.infer<typeof SkillReferenceV3Schema>;

/** Tenant configuration */
export type TenantConfig = z.infer<typeof TenantConfigSchema>;

/** Discovery configuration */
export type DiscoveryConfig = z.infer<typeof DiscoveryConfigSchema>;

/** CCAAS platform-facing configuration */
export type CcaasConfig = z.infer<typeof CcaasConfigSchema>;

/** Internal solution configuration */
export type InternalConfig = z.infer<typeof InternalConfigSchema>;

/** Skill definition */
export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;

/** MCP server definition */
export type McpServerDefinition = z.infer<typeof McpServerDefinitionSchema>;

/** Skill trigger */
export type SkillTriggerConfig = z.infer<typeof SkillTriggerSchema>;

/** Backend configuration */
export type BackendConfig = z.infer<typeof BackendConfigSchema>;

/** Frontend configuration */
export type FrontendConfig = z.infer<typeof FrontendConfigSchema>;

/** Database configuration */
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

/** Setup configuration */
export type SetupConfig = z.infer<typeof SetupConfigSchema>;
