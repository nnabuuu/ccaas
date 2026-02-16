/**
 * Solution Scanner Service
 *
 * Scans the `solutions/` directory for valid solution configurations,
 * loads and validates solution.json files, and filters by auto-discovery settings.
 *
 * Handles both v1 (flat) and v2 (structured) solution.json formats
 * via the SolutionConfigAdapter.
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { type SolutionConfigV2 } from './dto/solution-config.dto';
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
  /** Parsed and validated v2 config */
  config: SolutionConfigV2;
  /** Whether config was migrated from v1 */
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

      // Skip if no solution.json
      try {
        await fs.access(configPath);
      } catch {
        this.logger.debug(`No solution.json in ${entry}, skipping`);
        continue;
      }

      // Load and validate
      try {
        const metadata = await this.loadSolutionMetadata(entry, solutionPath, configPath);
        if (!metadata) continue;

        // Filter by discovery.enabled
        if (!metadata.config.ccaas.discovery.enabled) {
          this.logger.log(`Solution "${metadata.name}" has discovery disabled, skipping`);
          continue;
        }

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
   * Load and validate a single solution.json file, returning a v2 config.
   *
   * Handles both v1 and v2 formats via the adapter.
   *
   * @param configPath - Absolute path to solution.json.
   * @returns Validated v2 config.
   * @throws Error if file cannot be read, parsed, or validated.
   */
  async loadSolutionConfig(configPath: string): Promise<SolutionConfigV2> {
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
      slug: config.ccaas.tenant.slug,
      name: config.ccaas.tenant.name,
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
