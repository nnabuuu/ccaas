/**
 * Bundle Service
 *
 * Resolves active bundles for a session, merging tenant-enabled bundles
 * with session template bundle references.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { BundleDefinition, McpServerConfig, ToolEventTrigger } from '@kedge-agentic/common';
import { BUILTIN_BUNDLES, getAllBundles, getBundle } from './bundle-registry';
import * as path from 'path';

/**
 * Result of resolving active bundles for a session.
 */
export interface ResolvedBundles {
  /** MCP servers to inject (keyed by bundle:<id>) */
  mcpServers: Record<string, McpServerConfig>;
  /** Tool event triggers from all active bundles */
  toolEventTriggers: ToolEventTrigger[];
  /** System prompt additions from active bundles */
  appendSystemPrompts: string[];
  /** Active bundle IDs */
  activeBundleIds: string[];
}

@Injectable()
export class BundleService {
  private readonly logger = new Logger(BundleService.name);

  /**
   * Get all available bundle definitions.
   */
  getAvailableBundles(): BundleDefinition[] {
    return getAllBundles();
  }

  /**
   * Get a single bundle by ID.
   */
  getBundle(bundleId: string): BundleDefinition | undefined {
    return getBundle(bundleId);
  }

  /**
   * Validate that requested bundle IDs are a subset of tenant-enabled bundles.
   * Returns invalid IDs (those not enabled at tenant level).
   */
  validateBundleSubset(
    requestedBundles: string[],
    tenantEnabledBundles: string[],
  ): string[] {
    const enabledSet = new Set(tenantEnabledBundles);
    return requestedBundles.filter(id => !enabledSet.has(id));
  }

  /**
   * Resolve active bundles for a session.
   *
   * Priority: template bundles (if specified) → tenant enabledBundles.
   * Template bundles are filtered to only include tenant-enabled ones.
   *
   * @param templateBundles - Bundle IDs from session template (optional)
   * @param tenantEnabledBundles - Bundle IDs enabled at tenant level
   * @returns Resolved MCP servers, triggers, and prompts from active bundles
   */
  resolveActiveBundles(
    templateBundles: string[] | undefined,
    tenantEnabledBundles: string[],
  ): ResolvedBundles {
    const result: ResolvedBundles = {
      mcpServers: {},
      toolEventTriggers: [],
      appendSystemPrompts: [],
      activeBundleIds: [],
    };

    // Determine which bundles to activate:
    // If template specifies bundles, use those (filtered by tenant-enabled)
    // Otherwise, use all tenant-enabled bundles
    const candidateIds = templateBundles ?? tenantEnabledBundles;
    const enabledSet = new Set(tenantEnabledBundles);

    for (const bundleId of candidateIds) {
      // Skip if not enabled at tenant level
      if (!enabledSet.has(bundleId)) {
        this.logger.warn(
          `Bundle "${bundleId}" referenced in template but not enabled at tenant level — skipping`,
        );
        continue;
      }

      const bundle = BUILTIN_BUNDLES[bundleId];
      if (!bundle) {
        this.logger.warn(`Unknown bundle "${bundleId}" — skipping`);
        continue;
      }

      result.activeBundleIds.push(bundleId);

      // Inject MCP server (resolve ${CORE_MCP_DIR} placeholder)
      if (bundle.mcpServer) {
        const resolvedServer = this.resolveMcpServerPaths(bundle.mcpServer);
        result.mcpServers[`bundle:${bundleId}`] = resolvedServer;
      }

      // Collect triggers
      result.toolEventTriggers.push(...bundle.toolEventTriggers);

      // Collect system prompt additions
      if (bundle.appendSystemPrompt) {
        result.appendSystemPrompts.push(bundle.appendSystemPrompt);
      }
    }

    if (result.activeBundleIds.length > 0) {
      this.logger.debug(
        `Resolved ${result.activeBundleIds.length} active bundle(s): ${result.activeBundleIds.join(', ')}`,
      );
    }

    return result;
  }

  /**
   * Resolve ${CORE_MCP_DIR} placeholder in MCP server args and env values.
   */
  private resolveMcpServerPaths(config: McpServerConfig): McpServerConfig {
    const coreMcpDir = process.env.CORE_MCP_DIR
      || path.resolve(__dirname, '..', '..', '..', 'mcp');
    const resolve = (s: string) => s.replace(/\$\{CORE_MCP_DIR\}/g, coreMcpDir);
    return {
      ...config,
      args: config.args.map(resolve),
      ...(config.env && {
        env: Object.fromEntries(
          Object.entries(config.env).map(([k, v]) => [k, resolve(v)]),
        ),
      }),
    };
  }
}
