/**
 * Skill Management Service
 *
 * Handles skill-related operations for session management.
 *
 * Responsibilities:
 * - Generate skill system prompts for CLI --append-system-prompt
 * - Create CLAUDE.md files in workspace with skill instructions
 * - Load and filter published skills for tenants
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SkillsService } from '../../skills/skills.service';

/**
 * Simplified skill info for prompt generation
 */
export interface SkillInfo {
  slug: string;
  name: string;
  description?: string;
}

@Injectable()
export class SkillManagementService {
  private readonly logger = new Logger(SkillManagementService.name);

  constructor(private readonly skillsService: SkillsService) {}

  /**
   * Generate skill system prompt for --append-system-prompt CLI parameter
   *
   * Creates a critical instruction block that forces Claude to read SKILL.md
   * files before responding to skill-related requests.
   *
   * @param skills - Array of skill metadata
   * @returns Formatted system prompt string
   */
  generateSkillSystemPrompt(skills: SkillInfo[]): string {
    if (skills.length === 0) return '';

    const skillList = skills
      .map((s) => `  - **${s.name}** (\`${s.slug}\`)${s.description ? `: ${s.description}` : ''}`)
      .join('\n');

    return `
SKILL USAGE PROTOCOL:

Available skills (${skills.length}):
${skillList}

Required workflow when using any skill:
1. Read(".claude/skills/{skill-slug}/SKILL.md") first
2. Follow the workflow steps specified in SKILL.md (e.g., call read_context)
3. Use provided tools to access existing data

Skills contain domain expertise and data access tools (read_context, read_form_state, etc.) to prevent re-asking for information users already provided.

Example:
WRONG: Ask "What's your subject? Grade level?"
CORRECT: Read(".claude/skills/lesson-plan-designer/SKILL.md") → use read_context → respond with data

Always consult SKILL.md before responding to skill-related requests.
`.trim();
  }

  /**
   * Create CLAUDE.md with skill loading instructions
   *
   * This method creates a CLAUDE.md file in the workspace that instructs
   * Claude Code to load and use the synced skills.
   *
   * @param workspaceDir - Path to session workspace directory
   * @param skills - Array of skill metadata
   */
  async createClaudeMd(workspaceDir: string, skills: SkillInfo[]): Promise<void> {
    const claudeMdPath = path.join(workspaceDir, 'CLAUDE.md');

    const content = `# Session Skills Configuration

Available skills in \`.claude/skills/\`:

${skills.map(s => `- **${s.name}** (\`${s.slug}\`)${s.description ? `: ${s.description}` : ''}`).join('\n')}

## CRITICAL: Read SKILL.md Before Using Any Skill

\`\`\`
Read(".claude/skills/{skill-slug}/SKILL.md")
\`\`\`

Each SKILL.md contains:
- Required workflow steps and execution order
- Available tools and data sources (read_context, read_form_state, etc.)
- Domain-specific requirements and output formats

These are execution requirements, not optional suggestions. Skills provide context to prevent re-asking for data users already provided.

## Example: Lesson Planning

**Correct approach**:
1. Read(".claude/skills/lesson-plan-designer/SKILL.md")
2. SKILL.md instructs: call read_context first
3. read_context returns { subject: "数学", gradeLevel: 7, ... }
4. Use this data in response

**Wrong approach**:
Ask "你的学科是什么？" (user already provided this)

## Multiple Skills

When coordinating multiple skills:
- Read each SKILL.md before use
- Follow each skill's workflow requirements
- Coordinate execution as specified

SKILL.md files are the authoritative source for skill usage.
`;

    await fs.promises.writeFile(claudeMdPath, content, 'utf-8');
    this.logger.log(`Created CLAUDE.md with ${skills.length} skills`);
  }

  /**
   * Load enabled skills for a tenant
   *
   * Queries published skills and filters for enabled ones.
   *
   * @param tenantId - Tenant UUID
   * @param enabledSkillSlugs - Optional filter for specific skill slugs
   * @returns Array of enabled skill info
   */
  async loadEnabledSkills(
    tenantId: string,
    enabledSkillSlugs?: string[],
  ): Promise<SkillInfo[]> {
    // Query all published skills for tenant
    const allSkills = await this.skillsService.findPublished(tenantId);

    // Filter by enabled status and optional slug list
    let filteredSkills = allSkills.filter(skill => skill.enabled);

    if (enabledSkillSlugs && enabledSkillSlugs.length > 0) {
      filteredSkills = filteredSkills.filter(skill =>
        enabledSkillSlugs.includes(skill.slug)
      );
    }

    // Map to simplified info
    return filteredSkills.map(skill => ({
      slug: skill.slug,
      name: skill.name,
      description: skill.description || undefined,
    }));
  }

  /**
   * Generate inline skill prompt by reading SKILL.md content directly
   *
   * Instead of instructing the agent to read SKILL.md at runtime (which causes
   * visible "Let me read the skill definition" messages), this method reads
   * SKILL.md files from the workspace and inlines their content into the system
   * prompt. The agent starts with full skill knowledge — no file reads needed.
   *
   * @param workspaceDir - Path to session workspace directory
   * @param skills - Array of skill metadata
   * @returns Inline system prompt with SKILL.md content, or undefined if no content
   */
  async generateInlineSkillPrompt(
    workspaceDir: string,
    skills: SkillInfo[],
  ): Promise<string | undefined> {
    if (skills.length === 0) return undefined;

    const sections: string[] = [];

    for (const skill of skills) {
      const skillMdPath = path.join(
        workspaceDir,
        '.claude',
        'skills',
        skill.slug,
        'SKILL.md',
      );

      try {
        const content = await fs.promises.readFile(skillMdPath, 'utf-8');
        sections.push(`## Skill: ${skill.name}\n\n${content.trim()}`);
        this.logger.debug(`Inlined SKILL.md for ${skill.slug} (${content.length} chars)`);
      } catch (error) {
        this.logger.warn(
          `Failed to read SKILL.md for ${skill.slug} at ${skillMdPath}: ${error}`,
        );
      }
    }

    if (sections.length === 0) return undefined;

    return sections.join('\n\n---\n\n');
  }

  /**
   * Generate mixed-mode skill prompt combining inline and protocol skills.
   *
   * Skills in the promptModeMap with 'inline' mode get their SKILL.md content
   * inlined; 'protocol' skills get the standard "read SKILL.md" instruction.
   * Skills not in the map fall back to defaultMode.
   *
   * @param workspaceDir - Path to session workspace directory
   * @param skills - Array of skill metadata
   * @param promptModeMap - Per-skill promptMode overrides
   * @param defaultMode - Fallback mode for skills not in promptModeMap
   * @returns Combined prompt string, or undefined if no content
   */
  async generateMixedSkillPrompt(
    workspaceDir: string,
    skills: SkillInfo[],
    promptModeMap: Record<string, 'protocol' | 'inline'>,
    defaultMode: 'protocol' | 'inline',
  ): Promise<string | undefined> {
    const inlineSkills = skills.filter(
      (s) => (promptModeMap[s.slug] ?? defaultMode) === 'inline',
    );
    const protocolSkills = skills.filter(
      (s) => (promptModeMap[s.slug] ?? defaultMode) === 'protocol',
    );

    this.logger.debug(
      `Mixed prompt: ${inlineSkills.length} inline [${inlineSkills.map(s => s.slug).join(',')}], ` +
      `${protocolSkills.length} protocol [${protocolSkills.map(s => s.slug).join(',')}]`,
    );

    const sections: string[] = [];
    if (inlineSkills.length > 0) {
      const p = await this.generateInlineSkillPrompt(workspaceDir, inlineSkills);
      if (p) sections.push(p);
    }
    if (protocolSkills.length > 0) {
      const p = this.generateSkillSystemPrompt(protocolSkills);
      if (p) sections.push(p);
    }
    return sections.length > 0 ? sections.join('\n\n---\n\n') : undefined;
  }

  /**
   * Generate MCP tool registry prompt for system prompt injection.
   *
   * Maps short tool names to their full `select:mcp__<slug>__<tool>` queries,
   * so the AI agent can load tools with a single ToolSearch call instead of
   * doing a keyword search first.
   *
   * @param entries - Array of { toolName, mcpPrefixedName } pairs
   * @returns Formatted markdown prompt, or empty string if no entries
   */
  generateToolRegistryPrompt(
    entries: Array<{ toolName: string; mcpPrefixedName: string }>,
  ): string {
    if (entries.length === 0) return '';

    const rows = entries
      .map((e) => `| ${e.toolName} | ToolSearch("select:${e.mcpPrefixedName}") |`)
      .join('\n');

    return `## MCP Tool Registry

Before first use, load each tool with ToolSearch using the exact select: query:

| Tool | Load command |
|------|-------------|
${rows}

Load all needed tools proactively at session start to avoid latency on first use.
After loading, call tools directly — no further ToolSearch needed.`;
  }

  /**
   * Generate system prompt for session from skill slugs
   *
   * Convenience method that loads skills and generates prompt in one call.
   *
   * @param tenantId - Tenant UUID
   * @param enabledSkillSlugs - Skill slugs to include
   * @returns System prompt string or undefined if no skills
   */
  async generateSystemPromptForSession(
    tenantId: string,
    enabledSkillSlugs?: string[],
  ): Promise<string | undefined> {
    if (!enabledSkillSlugs || enabledSkillSlugs.length === 0) {
      return undefined;
    }

    const skills = await this.loadEnabledSkills(tenantId, enabledSkillSlugs);

    if (skills.length === 0) {
      return undefined;
    }

    return this.generateSkillSystemPrompt(skills);
  }
}
