/**
 * Skill Metadata Parser Service
 *
 * Reads SKILL.md files, extracts YAML frontmatter, validates against the
 * SkillFrontmatter schema, and provides a two-path fallback:
 *
 *   SKILL.md frontmatter (preferred)
 *     -> sensible defaults (last resort)
 *
 * The skill slug is always inferred from the containing directory name,
 * never from frontmatter.
 *
 * Usage:
 *   const metadata = await parser.parseSkillFile(
 *     '/abs/path/to/skills/my-skill/SKILL.md',
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

// ============================================================================
// Types
// ============================================================================

/**
 * The parsed result returned by parseSkillFile.
 */
export interface SkillMetadata {
  /** Validated frontmatter (from SKILL.md or defaults) */
  frontmatter: SkillFrontmatter;
  /** Skill slug inferred from the containing directory name */
  slug: string;
  /** Raw markdown body (without frontmatter) from SKILL.md */
  content: string;
  /** Where the frontmatter data came from */
  source: 'frontmatter' | 'defaults';
  /** Absolute path to the SKILL.md file */
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
   */
  async parseSkillFile(skillPath: string): Promise<SkillMetadata> {
    const resolvedPath = path.resolve(skillPath);
    const warnings: string[] = [];

    // Slug is always inferred from the containing directory name
    const slug = this.toSlug(path.basename(path.dirname(resolvedPath)));

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
            slug,
            content,
            source: 'frontmatter',
            filePath: resolvedPath,
            warnings,
          };
        }

        // Frontmatter present but invalid
        this.logValidationErrors(resolvedPath, validation.errors, warnings);
      }

      if (!frontmatterData || Object.keys(frontmatterData).length === 0) {
        warnings.push(`No YAML frontmatter found in ${resolvedPath}`);
      }

      // Fall through to defaults
      const defaults = this.buildDefaults(resolvedPath, slug, warnings);
      return {
        frontmatter: defaults,
        slug,
        content,
        source: 'defaults',
        filePath: resolvedPath,
        warnings,
      };
    }

    // SKILL.md file not found
    warnings.push(`SKILL.md not found at ${resolvedPath}`);
    const defaults = this.buildDefaults(resolvedPath, slug, warnings);
    return {
      frontmatter: defaults,
      slug,
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
  // Defaults
  // --------------------------------------------------------------------------

  /**
   * Build sensible defaults when frontmatter is unavailable.
   */
  private buildDefaults(
    filePath: string,
    slug: string,
    warnings: string[],
  ): SkillFrontmatter {
    const dirName = path.basename(path.dirname(filePath));
    const name = dirName || 'unknown-skill';

    warnings.push(
      `Using default metadata for skill (inferred slug="${slug}" from path)`,
    );

    return {
      name,
      description: `Auto-discovered skill: ${name}`,
    };
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

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
