/**
 * Skill Metadata Parser Service
 *
 * Reads SKILL.md files, extracts YAML frontmatter, validates against the
 * SkillFrontmatter schema, and provides a fallback chain:
 *
 *   SKILL.md frontmatter (preferred)
 *     -> solution.json skill definition (fallback)
 *       -> sensible defaults (last resort)
 *
 * Usage:
 *   const metadata = await parser.parseSkillFile(
 *     '/abs/path/to/skills/my-skill/SKILL.md',
 *     solutionConfig,  // optional fallback source
 *     'my-skill',      // optional slug for fallback lookup
 *   );
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import matter from 'gray-matter';
import {
  validateSkillFrontmatter,
  type SkillFrontmatter,
  type SkillFrontmatterValidationError,
} from './dto/skill-frontmatter.dto';
import type {
  SolutionConfigV2,
  SkillDefinition,
} from './dto/solution-config.dto';

// ============================================================================
// Types
// ============================================================================

/**
 * The merged result returned by parseSkillFile.
 */
export interface SkillMetadata {
  /** Validated frontmatter (from SKILL.md, fallback, or defaults) */
  frontmatter: SkillFrontmatter;
  /** Raw markdown body (without frontmatter) from SKILL.md */
  content: string;
  /** Where the frontmatter data came from */
  source: 'frontmatter' | 'solution-json' | 'defaults';
  /** Absolute path to the SKILL.md file (may not exist if source != 'frontmatter') */
  filePath: string;
  /** Warnings collected during parsing */
  warnings: string[];
}

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class SkillMetadataParserService {
  private readonly logger = new Logger(SkillMetadataParserService.name);

  /**
   * Parse a SKILL.md file and return validated metadata.
   *
   * @param skillPath - Path to the SKILL.md file (absolute or relative to cwd)
   * @param solutionConfig - Optional v2 config to use as fallback
   * @param skillSlug - Optional slug to locate the skill definition in solutionConfig
   */
  async parseSkillFile(
    skillPath: string,
    solutionConfig?: SolutionConfigV2,
    skillSlug?: string,
  ): Promise<SkillMetadata> {
    const resolvedPath = path.resolve(skillPath);
    const warnings: string[] = [];

    // Step 1: Try reading and parsing the SKILL.md file
    const fileResult = await this.readSkillFile(resolvedPath);

    if (fileResult) {
      // Step 2: Extract frontmatter
      const { frontmatterData, content } = this.extractFrontmatter(
        fileResult,
        resolvedPath,
        warnings,
      );

      // Step 3: Validate frontmatter
      if (frontmatterData && Object.keys(frontmatterData).length > 0) {
        const validation = validateSkillFrontmatter(frontmatterData);

        if (validation.success) {
          this.logger.debug(
            `Parsed valid frontmatter from ${resolvedPath}`,
          );
          return {
            frontmatter: validation.data,
            content,
            source: 'frontmatter',
            filePath: resolvedPath,
            warnings,
          };
        }

        // Frontmatter present but invalid - try merging with fallback
        this.logValidationErrors(resolvedPath, validation.errors, warnings);

        const merged = this.mergeFrontmatterWithFallback(
          frontmatterData,
          solutionConfig,
          skillSlug,
          warnings,
        );

        if (merged) {
          return {
            frontmatter: merged,
            content,
            source: 'frontmatter',
            filePath: resolvedPath,
            warnings,
          };
        }
      }

      // Frontmatter missing or completely invalid - try solution.json fallback
      if (!frontmatterData || Object.keys(frontmatterData).length === 0) {
        warnings.push(
          `No YAML frontmatter found in ${resolvedPath}`,
        );
      }

      const fallback = this.buildFromSolutionConfig(
        solutionConfig,
        skillSlug,
        warnings,
      );

      if (fallback) {
        return {
          frontmatter: fallback,
          content,
          source: 'solution-json',
          filePath: resolvedPath,
          warnings,
        };
      }

      // Last resort: defaults with whatever info we can infer
      const defaults = this.buildDefaults(resolvedPath, warnings);
      return {
        frontmatter: defaults,
        content,
        source: 'defaults',
        filePath: resolvedPath,
        warnings,
      };
    }

    // SKILL.md file not found
    warnings.push(`SKILL.md not found at ${resolvedPath}`);

    const fallback = this.buildFromSolutionConfig(
      solutionConfig,
      skillSlug,
      warnings,
    );

    if (fallback) {
      return {
        frontmatter: fallback,
        content: '',
        source: 'solution-json',
        filePath: resolvedPath,
        warnings,
      };
    }

    const defaults = this.buildDefaults(resolvedPath, warnings);
    return {
      frontmatter: defaults,
      content: '',
      source: 'defaults',
      filePath: resolvedPath,
      warnings,
    };
  }

  // --------------------------------------------------------------------------
  // File I/O
  // --------------------------------------------------------------------------

  /**
   * Read a SKILL.md file, returning null if not found.
   */
  private async readSkillFile(
    resolvedPath: string,
  ): Promise<string | null> {
    try {
      const content = await fs.readFile(resolvedPath, 'utf-8');
      return content;
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT') {
        return null;
      }
      this.logger.error(
        `Error reading ${resolvedPath}: ${error.message}`,
      );
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Frontmatter Extraction
  // --------------------------------------------------------------------------

  /**
   * Extract YAML frontmatter from raw file content using gray-matter.
   */
  private extractFrontmatter(
    rawContent: string,
    filePath: string,
    warnings: string[],
  ): { frontmatterData: Record<string, unknown> | null; content: string } {
    try {
      const parsed = matter(rawContent);
      const data =
        parsed.data && typeof parsed.data === 'object'
          ? (parsed.data as Record<string, unknown>)
          : null;
      return { frontmatterData: data, content: parsed.content };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : String(err);
      warnings.push(
        `Failed to parse frontmatter in ${filePath}: ${message}`,
      );
      return { frontmatterData: null, content: rawContent };
    }
  }

  // --------------------------------------------------------------------------
  // Merge / Fallback
  // --------------------------------------------------------------------------

  /**
   * Attempt to merge partial/invalid frontmatter with solution.json skill data.
   * Returns a valid SkillFrontmatter or null if merge still fails validation.
   */
  private mergeFrontmatterWithFallback(
    partial: Record<string, unknown>,
    solutionConfig?: SolutionConfigV2,
    skillSlug?: string,
    warnings?: string[],
  ): SkillFrontmatter | null {
    const skillDef = this.findSkillDefinition(solutionConfig, skillSlug);
    if (!skillDef) return null;

    const merged = {
      name: partial.name ?? skillDef.name,
      slug: partial.slug ?? skillDef.slug,
      description: partial.description ?? skillDef.description ?? '',
      scope: partial.scope ?? (skillDef.scope === 'personal' ? 'tenant' : skillDef.scope) ?? 'tenant',
      triggers: partial.triggers ?? this.convertTriggers(skillDef.triggers),
      allowedTools: partial.allowedTools ?? skillDef.allowedTools ?? [],
    };

    const validation = validateSkillFrontmatter(merged);
    if (validation.success) {
      warnings?.push(
        `Merged frontmatter with solution.json fallback for slug="${skillSlug}"`,
      );
      return validation.data;
    }

    return null;
  }

  /**
   * Build SkillFrontmatter entirely from a solution.json skill definition.
   */
  private buildFromSolutionConfig(
    solutionConfig?: SolutionConfigV2,
    skillSlug?: string,
    warnings?: string[],
  ): SkillFrontmatter | null {
    const skillDef = this.findSkillDefinition(solutionConfig, skillSlug);
    if (!skillDef) return null;

    const candidate = {
      name: skillDef.name,
      slug: skillDef.slug,
      description: skillDef.description ?? `Skill: ${skillDef.name}`,
      scope: skillDef.scope === 'personal' ? 'tenant' as const : (skillDef.scope ?? 'tenant') as 'tenant' | 'global',
      triggers: this.convertTriggers(skillDef.triggers),
      allowedTools: skillDef.allowedTools ?? [],
    };

    const validation = validateSkillFrontmatter(candidate);
    if (validation.success) {
      this.logger.debug(
        `Using solution.json fallback for skill "${skillDef.slug}"`,
      );
      warnings?.push(
        `Using solution.json as metadata source for skill "${skillDef.slug}"`,
      );
      return validation.data;
    }

    warnings?.push(
      `solution.json skill definition for "${skillSlug}" also failed validation`,
    );
    return null;
  }

  /**
   * Build sensible defaults when both frontmatter and solution.json are unavailable.
   * Infers the skill name from the directory structure.
   */
  private buildDefaults(
    filePath: string,
    warnings: string[],
  ): SkillFrontmatter {
    const dirName = path.basename(path.dirname(filePath));
    const slug = this.toSlug(dirName);
    const name = dirName || 'unknown-skill';

    warnings.push(
      `Using default metadata for skill (inferred slug="${slug}" from path)`,
    );

    return {
      name,
      slug,
      description: `Auto-discovered skill: ${name}`,
      scope: 'tenant',
      triggers: [],
      allowedTools: [],
    };
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  /**
   * Find a SkillDefinition in the v2 config by slug.
   */
  private findSkillDefinition(
    config?: SolutionConfigV2,
    slug?: string,
  ): SkillDefinition | undefined {
    if (!config || !slug) return undefined;

    const skills = config.ccaas?.discovery?.skills ?? [];
    return skills.find((s) => s.slug === slug);
  }

  /**
   * Convert solution.json triggers (which may have optional priority) to
   * the format expected by the frontmatter schema.
   */
  private convertTriggers(
    triggers?: Array<{
      type: string;
      value: string;
      priority?: number;
      description?: string;
    }>,
  ): Array<{
    type: 'keyword' | 'pattern' | 'intent' | 'context';
    value: string;
    priority: number;
    description?: string;
  }> {
    if (!triggers) return [];
    return triggers
      .filter(
        (t) =>
          ['keyword', 'pattern', 'intent', 'context'].includes(t.type) &&
          t.value.length > 0,
      )
      .map((t) => ({
        type: t.type as 'keyword' | 'pattern' | 'intent' | 'context',
        value: t.value,
        priority: t.priority ?? 5,
        ...(t.description ? { description: t.description } : {}),
      }));
  }

  /**
   * Convert a directory name to a valid slug.
   */
  private toSlug(name: string): string {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'unknown'
    );
  }

  /**
   * Log validation errors and add to warnings.
   */
  private logValidationErrors(
    filePath: string,
    errors: SkillFrontmatterValidationError[],
    warnings: string[],
  ): void {
    const summary = errors
      .map((e) => `${e.path}: ${e.message}`)
      .join('; ');
    this.logger.warn(
      `Invalid frontmatter in ${filePath}: ${summary}`,
    );
    warnings.push(
      `Invalid frontmatter in ${filePath}: ${summary}`,
    );
  }
}
