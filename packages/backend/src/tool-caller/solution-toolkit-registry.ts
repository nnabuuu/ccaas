/**
 * In-process registry of solution-scoped tool toolkits.
 *
 * Solutions register their toolkit at import time (see
 * SolutionLoaderService). The registry is the single source of truth
 * for "what tools does solution X expose, with what schemas". The
 * engine adapter queries this at session-spawn to build the
 * model-facing tool list, and the ToolCallerProxy looks up the
 * handler when a tool call comes in.
 *
 * Keyed by `solutionId` — tools are isolated per-solution. A tool
 * name like `lessonplan.generate` collides only within a single
 * solution; two solutions can both register `lessonplan.generate`
 * with different schemas and they won't see each other.
 */

import { Injectable, Logger } from '@nestjs/common';
import type {
  SolutionToolkit,
  ToolDefinition,
} from './types';

interface ResolvedTool {
  solutionId: string;
  namespace: string;
  /** Fully-qualified name, e.g. `lessonplan.generate`. */
  qualifiedName: string;
  definition: ToolDefinition;
}

@Injectable()
export class SolutionToolkitRegistry {
  private readonly logger = new Logger(SolutionToolkitRegistry.name);

  /**
   * Two-level map: solutionId → qualifiedName → ResolvedTool.
   * Each toolkit is registered atomically — re-registering a namespace
   * overwrites all its tools (matches solution-import re-run behavior).
   */
  private readonly bySolution = new Map<string, Map<string, ResolvedTool>>();

  /**
   * Register a toolkit. Idempotent per (solutionId, namespace):
   * a second call with the same namespace replaces previous tools.
   *
   * Tool names are qualified with the namespace at registration
   * time, so callers (proxy, adapter) look up by qualified name.
   */
  registerToolkit(toolkit: SolutionToolkit): void {
    const { solutionId, namespace, tools } = toolkit;
    if (!solutionId || !namespace) {
      throw new Error(
        `Toolkit registration requires non-empty solutionId + namespace ` +
        `(got solutionId="${solutionId}", namespace="${namespace}")`,
      );
    }
    let tenantMap = this.bySolution.get(solutionId);
    if (!tenantMap) {
      tenantMap = new Map();
      this.bySolution.set(solutionId, tenantMap);
    }
    // Remove any prior entries for this namespace (idempotent re-register).
    const prefix = `${namespace}.`;
    for (const key of tenantMap.keys()) {
      if (key.startsWith(prefix)) tenantMap.delete(key);
    }
    for (const def of tools) {
      const qualified = `${namespace}.${def.name}`;
      tenantMap.set(qualified, {
        solutionId,
        namespace,
        qualifiedName: qualified,
        definition: def,
      });
    }
    this.logger.debug(
      `Registered toolkit "${namespace}" for solution ${solutionId}: ${tools.length} tool(s)`,
    );
  }

  /**
   * Look up a tool by (solutionId, qualifiedName). Returns null if
   * not registered — the proxy turns this into a `tool_not_found`
   * ToolResult.
   */
  resolveTool(
    solutionId: string,
    qualifiedName: string,
  ): ResolvedTool | null {
    const tenantMap = this.bySolution.get(solutionId);
    if (!tenantMap) return null;
    return tenantMap.get(qualifiedName) ?? null;
  }

  /**
   * List every tool registered for a solution. Used by the engine
   * adapter to build the tool list exposed to the model at session
   * spawn. Order is registration order within each toolkit.
   */
  listToolsForSolution(solutionId: string): ResolvedTool[] {
    const tenantMap = this.bySolution.get(solutionId);
    if (!tenantMap) return [];
    return [...tenantMap.values()];
  }

  /**
   * Test helper — remove a solution's toolkits entirely. Production
   * code goes through `registerToolkit` (idempotent overwrite).
   */
  clearSolution(solutionId: string): void {
    this.bySolution.delete(solutionId);
  }

  /** Test helper — full reset between specs. */
  reset(): void {
    this.bySolution.clear();
  }
}
