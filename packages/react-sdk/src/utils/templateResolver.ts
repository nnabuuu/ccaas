/**
 * @ccaas/react-sdk/utils/templateResolver
 *
 * Session Template resolution utilities for frontend clients.
 * Resolves named templates and merges parameters according to priority rules.
 */

import type { SessionTemplate, SessionTemplateMap } from '@ccaas/common'
import type { McpServerConfig } from '../types'

/**
 * Resolved template parameters ready for API consumption
 */
export interface ResolvedTemplateParams {
  enabledSkillSlugs?: string[]
  mcpServers?: Record<string, McpServerConfig>
  appendSystemPrompt?: string
  skillPath?: string
}

/**
 * Explicit parameters that can override template defaults
 */
export interface ExplicitParams {
  enabledSkillSlugs?: string[]
  mcpServers?: Record<string, McpServerConfig>
  appendSystemPrompt?: string
  skillPath?: string | null
}

/**
 * Solution-level defaults (from solution.json top-level config)
 */
export interface SolutionDefaults {
  mcpServers?: Record<string, McpServerConfig>
  skillPath?: string | null
}

/**
 * Resolves a session template by name from the templates map.
 *
 * @param templateName - Name of the template to resolve
 * @param templates - Available templates map
 * @returns The resolved template
 * @throws Error if template name is invalid or not found
 *
 * @example
 * ```typescript
 * const template = resolveSessionTemplate('teacher-analysis', config.sessionTemplates)
 * ```
 */
export function resolveSessionTemplate(
  templateName: string,
  templates: SessionTemplateMap | undefined,
): SessionTemplate {
  // Validate template name format (kebab-case)
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(templateName)) {
    throw new Error(
      `Invalid session template name: "${templateName}". ` +
      `Template names must match pattern: [a-z0-9][a-z0-9_-]*`
    )
  }

  // Check templates exist
  if (!templates || Object.keys(templates).length === 0) {
    throw new Error(
      `No session templates defined. Cannot resolve template "${templateName}"`
    )
  }

  // Look up template
  const template = templates[templateName]
  if (!template) {
    const available = Object.keys(templates).join(', ')
    throw new Error(
      `Session template "${templateName}" not found. Available templates: ${available}`
    )
  }

  return template
}

/**
 * Merges template parameters with explicit parameters and solution defaults.
 *
 * **Priority Rules** (highest to lowest):
 * 1. Explicit parameters (from hook options)
 * 2. Template configuration
 * 3. Solution defaults (top-level solution.json config)
 *
 * **Merge Strategies**:
 * - `enabledSkillSlugs`: **Replace** (not merged) - template defines complete skill set
 * - `mcpServers`: **Shallow merge** - allows adding extra MCP servers
 * - `appendSystemPrompt`: **Concatenate** - multi-layer prompt stacking
 * - `skillPath`: **Replace** - single path selection
 *
 * @param template - Template configuration (or undefined if no template)
 * @param explicit - Explicit parameters from hook options
 * @param solutionDefaults - Solution-level defaults
 * @returns Merged parameters ready for API consumption
 *
 * @example
 * ```typescript
 * const params = mergeTemplateParams(
 *   template,
 *   { enabledSkillSlugs: ['custom-skill'] }, // Override template skills
 *   { mcpServers: { 'shared-tool': {...} } } // Default MCP server
 * )
 * ```
 */
export function mergeTemplateParams(
  template: SessionTemplate | undefined,
  explicit: ExplicitParams,
  solutionDefaults?: SolutionDefaults,
): ResolvedTemplateParams {
  const result: ResolvedTemplateParams = {}

  // 1. enabledSkillSlugs - REPLACE strategy (highest priority wins)
  if (explicit.enabledSkillSlugs && explicit.enabledSkillSlugs.length > 0) {
    result.enabledSkillSlugs = explicit.enabledSkillSlugs
  } else if (template?.enabledSkillSlugs && template.enabledSkillSlugs.length > 0) {
    result.enabledSkillSlugs = template.enabledSkillSlugs
  }

  // 2. mcpServers - SHALLOW MERGE (solution defaults < template < explicit)
  const mergedMcpServers: Record<string, McpServerConfig> = {}

  // Start with solution defaults
  if (solutionDefaults?.mcpServers) {
    Object.assign(mergedMcpServers, solutionDefaults.mcpServers)
  }

  // Merge template servers
  if (template?.mcpServers) {
    Object.assign(mergedMcpServers, template.mcpServers)
  }

  // Merge explicit servers (highest priority)
  if (explicit.mcpServers) {
    Object.assign(mergedMcpServers, explicit.mcpServers)
  }

  if (Object.keys(mergedMcpServers).length > 0) {
    result.mcpServers = mergedMcpServers
  }

  // 3. appendSystemPrompt - CONCATENATE strategy (stack all prompts)
  const prompts: string[] = []

  if (template?.appendSystemPrompt) {
    prompts.push(template.appendSystemPrompt)
  }

  if (explicit.appendSystemPrompt) {
    prompts.push(explicit.appendSystemPrompt)
  }

  if (prompts.length > 0) {
    result.appendSystemPrompt = prompts.join('\n\n')
  }

  // 4. skillPath - REPLACE strategy (explicit > template > solution default)
  if (explicit.skillPath !== undefined) {
    if (explicit.skillPath !== null) {
      result.skillPath = explicit.skillPath
    }
    // else: explicit null means "no skill path"
  } else if (template?.skillPath !== undefined) {
    result.skillPath = template.skillPath
  } else if (solutionDefaults?.skillPath !== undefined && solutionDefaults.skillPath !== null) {
    result.skillPath = solutionDefaults.skillPath
  }

  return result
}
