/**
 * Solution Scanner Service
 *
 * Scans the `solutions/` directory for valid solution configurations,
 * loads and validates solution.json files, and filters by auto-discovery settings.
 *
 * Handles v1 (flat), v2 (structured), and v3 (simplified) solution.json formats
 * via the SolutionConfigAdapter. Always returns v3 format.
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { type SolutionConfigV3 } from './dto/solution-config.dto';
import {
  SolutionConfigAdapter,
  type AdaptResult,
} from './solution-config-adapter';
import { resolveSolutionsDir } from '../common/find-monorepo-root';

// ============================================================================
// Types
// ============================================================================

/**
 * Metadata for a discovered solution, returned by scanSolutions().
 */
export interface SolutionMetadata {
  /** Directory name (e.g., 'lesson-plan-designer') */
  slug: string;
  /** Display name from config (e.g., 'Lesson Plan Designer') */
  name: string;
  /** Absolute path to the solution directory */
  solutionPath: string;
  /** Absolute path to solution.json */
  configPath: string;
  /** Parsed and validated v3 config */
  config: SolutionConfigV3;
  /** Whether config was migrated from older version */
  migrated: boolean;
  /** Warnings from parsing/migration */
  warnings: string[];
}

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class SolutionScannerService {
  private readonly logger = new Logger(SolutionScannerService.name);
  private readonly adapter = new SolutionConfigAdapter();

  /**
   * Scan the solutions directory for valid, discovery-enabled solutions.
   *
   * @param solutionsDir - Absolute path to the solutions directory.
   *                       Defaults to `<project-root>/solutions/`.
   * @returns Array of solution metadata for enabled solutions.
   */
  async scanSolutions(solutionsDir?: string): Promise<SolutionMetadata[]> {
    const dir = solutionsDir ?? this.getDefaultSolutionsDir();

    // Check if directory exists
    try {
      const stat = await fs.stat(dir);
      if (!stat.isDirectory()) {
        this.logger.warn(`Solutions path is not a directory: ${dir}`);
        return [];
      }
    } catch {
      this.logger.warn(`Solutions directory not found: ${dir}`);
      return [];
    }

    // Read subdirectories
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch (err) {
      this.logger.error(`Failed to read solutions directory: ${dir}`, (err as Error).stack);
      return [];
    }

    const results: SolutionMetadata[] = [];

    for (const entry of entries) {
      const solutionPath = path.join(dir, entry);
      const configPath = path.join(solutionPath, 'solution.json');

      // Skip non-directories
      try {
        const stat = await fs.stat(solutionPath);
        if (!stat.isDirectory()) continue;
      } catch {
        continue;
      }

      // Skip if no solution.json — may be a group directory
      let hasSolutionJson = true;
      try {
        await fs.access(configPath);
      } catch {
        hasSolutionJson = false;
      }

      if (!hasSolutionJson) {
        // Treat as a group directory: scan one level deeper
        const subEntries = await fs.readdir(solutionPath).catch(() => [] as string[]);
        let foundAny = false;
        for (const subEntry of subEntries) {
          const subSolutionPath = path.join(solutionPath, subEntry);
          const subConfigPath = path.join(subSolutionPath, 'solution.json');

          try {
            const subStat = await fs.stat(subSolutionPath);
            if (!subStat.isDirectory()) continue;
          } catch {
            continue;
          }

          try {
            await fs.access(subConfigPath);
          } catch {
            continue;
          }

          try {
            const metadata = await this.loadSolutionMetadata(subEntry, subSolutionPath, subConfigPath);
            if (!metadata) continue;
            results.push(metadata);
            foundAny = true;
          } catch (err) {
            this.logger.warn(
              `Failed to load solution "${entry}/${subEntry}": ${(err as Error).message}`,
            );
          }
        }
        if (!foundAny) {
          this.logger.debug(`No solution.json in ${entry} (not a group directory either), skipping`);
        }
        continue;
      }

      // Load and validate
      try {
        const metadata = await this.loadSolutionMetadata(entry, solutionPath, configPath);
        if (!metadata) continue;

        // Scanner returns all solutions with valid configs.
        // Filtering by discovery.enabled is done in SolutionLoaderService.loadAll().
        results.push(metadata);
      } catch (err) {
        this.logger.warn(
          `Failed to load solution "${entry}": ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Scan complete: ${results.length} solution(s) enabled out of ${entries.length} directories`,
    );

    return results;
  }

  /**
   * Load and validate a single solution.json file, returning a v3 config.
   *
   * Handles v1, v2, and v3 formats via the adapter (always returns v3).
   *
   * @param configPath - Absolute path to solution.json.
   * @returns Validated v3 config.
   * @throws Error if file cannot be read, parsed, or validated.
   */
  async loadSolutionConfig(configPath: string): Promise<SolutionConfigV3> {
    const raw = await this.readJsonFile(configPath);
    const outcome = this.adapter.adapt(raw);

    if (!outcome.success) {
      throw new Error(
        `Invalid solution config at ${configPath}: ${outcome.errors.join('; ')}`,
      );
    }

    if (outcome.warnings.length > 0) {
      this.logger.warn(
        `Solution config warnings for ${configPath}: ${outcome.warnings.join('; ')}`,
      );
    }

    return outcome.data;
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  /**
   * Load a single solution's metadata from its directory.
   */
  private async loadSolutionMetadata(
    dirName: string,
    solutionPath: string,
    configPath: string,
  ): Promise<SolutionMetadata | null> {
    const raw = await this.readJsonFile(configPath);
    const outcome = this.adapter.adapt(raw);

    if (!outcome.success) {
      this.logger.warn(
        `Invalid config in "${dirName}": ${outcome.errors.join('; ')}`,
      );
      return null;
    }

    const result = outcome as AdaptResult;
    const config = result.data;

    return {
      slug: config.tenant.slug,
      name: config.tenant.name,
      solutionPath,
      configPath,
      config,
      migrated: result.migrated,
      warnings: result.warnings,
    };
  }

  /**
   * Read and parse a JSON file.
   */
  private async readJsonFile(filePath: string): Promise<unknown> {
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (err) {
      throw new Error(`Cannot read file ${filePath}: ${(err as Error).message}`);
    }

    try {
      return JSON.parse(content);
    } catch (err) {
      throw new Error(`Invalid JSON in ${filePath}: ${(err as Error).message}`);
    }
  }

  /**
   * Get the default solutions directory path.
   *
   * Delegates to `resolveSolutionsDir()` which uses a robust resolution strategy:
   *   1. SOLUTIONS_DIR environment variable (absolute path)
   *   2. Walk up from __dirname to find monorepo root (has package.json with "workspaces")
   *   3. Fallback: <cwd>/solutions
   */
  private getDefaultSolutionsDir(): string {
    const dir = resolveSolutionsDir(__dirname);
    this.logger.debug(`Resolved solutions directory: ${dir}`);
    return dir;
  }
}
