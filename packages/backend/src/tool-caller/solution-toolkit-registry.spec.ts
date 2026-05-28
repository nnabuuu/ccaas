/**
 * Registry behavior tests — isolation across solutions, idempotent
 * re-registration, qualified-name lookups.
 */

import { z } from 'zod';
import { SolutionToolkitRegistry } from './solution-toolkit-registry';
import type { ToolDefinition } from './types';

function makeTool(name: string): ToolDefinition {
  return {
    name,
    description: `desc-${name}`,
    argsSchema: z.object({ q: z.string() }),
    handler: async () => ({
      ok: true as const,
      content: [{ type: 'text' as const, text: name }],
    }),
  };
}

describe('SolutionToolkitRegistry', () => {
  let registry: SolutionToolkitRegistry;

  beforeEach(() => {
    registry = new SolutionToolkitRegistry();
  });

  it('qualifies tool names with the namespace', () => {
    registry.registerToolkit({
      solutionId: 'sol-1',
      namespace: 'lessonplan',
      tools: [makeTool('generate'), makeTool('validate')],
    });
    expect(registry.resolveTool('sol-1', 'lessonplan.generate')?.qualifiedName)
      .toBe('lessonplan.generate');
    expect(registry.resolveTool('sol-1', 'generate')).toBeNull(); // unqualified
  });

  it('isolates tools across solutions even with identical namespaces', () => {
    registry.registerToolkit({
      solutionId: 'sol-1',
      namespace: 'shared',
      tools: [makeTool('go')],
    });
    registry.registerToolkit({
      solutionId: 'sol-2',
      namespace: 'shared',
      tools: [makeTool('go')],
    });
    expect(registry.resolveTool('sol-1', 'shared.go')?.solutionId).toBe('sol-1');
    expect(registry.resolveTool('sol-2', 'shared.go')?.solutionId).toBe('sol-2');
  });

  it('re-registration of the same namespace replaces tools (not appends)', () => {
    registry.registerToolkit({
      solutionId: 'sol-1',
      namespace: 'lp',
      tools: [makeTool('old')],
    });
    registry.registerToolkit({
      solutionId: 'sol-1',
      namespace: 'lp',
      tools: [makeTool('fresh')],
    });
    expect(registry.resolveTool('sol-1', 'lp.old')).toBeNull();
    expect(registry.resolveTool('sol-1', 'lp.fresh')).not.toBeNull();
  });

  it('re-registering one namespace does NOT touch another namespace on the same solution', () => {
    registry.registerToolkit({
      solutionId: 'sol-1',
      namespace: 'a',
      tools: [makeTool('keep')],
    });
    registry.registerToolkit({
      solutionId: 'sol-1',
      namespace: 'b',
      tools: [makeTool('also')],
    });
    registry.registerToolkit({
      solutionId: 'sol-1',
      namespace: 'b',
      tools: [makeTool('refreshed')],
    });
    expect(registry.resolveTool('sol-1', 'a.keep')).not.toBeNull();
    expect(registry.resolveTool('sol-1', 'b.also')).toBeNull();
    expect(registry.resolveTool('sol-1', 'b.refreshed')).not.toBeNull();
  });

  it('listToolsForSolution returns every tool, all namespaces', () => {
    registry.registerToolkit({
      solutionId: 'sol-1',
      namespace: 'lp',
      tools: [makeTool('g'), makeTool('v')],
    });
    registry.registerToolkit({
      solutionId: 'sol-1',
      namespace: 'audit',
      tools: [makeTool('log')],
    });
    const names = registry
      .listToolsForSolution('sol-1')
      .map((t) => t.qualifiedName)
      .sort();
    expect(names).toEqual(['audit.log', 'lp.g', 'lp.v']);
  });

  it('listToolsForSolution returns [] for an unknown solution', () => {
    expect(registry.listToolsForSolution('nobody')).toEqual([]);
  });

  it('rejects registration with empty solutionId or namespace', () => {
    expect(() =>
      registry.registerToolkit({ solutionId: '', namespace: 'lp', tools: [] }),
    ).toThrow(/non-empty/);
    expect(() =>
      registry.registerToolkit({ solutionId: 'sol', namespace: '', tools: [] }),
    ).toThrow(/non-empty/);
  });

  it('clearSolution removes everything for one tenant only', () => {
    registry.registerToolkit({
      solutionId: 'sol-1',
      namespace: 'lp',
      tools: [makeTool('g')],
    });
    registry.registerToolkit({
      solutionId: 'sol-2',
      namespace: 'lp',
      tools: [makeTool('g')],
    });
    registry.clearSolution('sol-1');
    expect(registry.resolveTool('sol-1', 'lp.g')).toBeNull();
    expect(registry.resolveTool('sol-2', 'lp.g')).not.toBeNull();
  });
});
