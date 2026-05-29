/**
 * Tests for the three projection adapters + the `projectManifest`
 * dispatcher.
 *
 * Fixture: a tiny ontology with one ObjectType (LessonPlan) that
 * carries one Action (flagForIntervention), one slot-bound Student
 * type, one stream (events), one state field (phase), one function
 * (computeProgress). Two roles: agent (scoped) and admin (wildcard).
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { OntologyRegistry } from '../../registry/index.js';
import type { ManifestDef } from '../../manifest/index.js';
import type { ObjectTypeDef, FunctionDef } from '../../schema/index.js';
import {
  projectAsAnthropicTools,
  projectAsMcpTools,
  projectAsSystemPrompt,
} from '../formats/index.js';
import { projectManifest } from '../project.js';

function setup(): { registry: OntologyRegistry; manifest: ManifestDef } {
  const lessonPlan: ObjectTypeDef = {
    apiName: 'LessonPlan',
    displayName: 'LessonPlan',
    semantic: 'A plan.',
    schema: z.object({ id: z.string(), objective: z.string() }),
    links: [],
    actions: [
      {
        apiName: 'flagForIntervention',
        displayName: 'flag',
        params: z.object({ reason: z.string() }),
        sideEffects: ['emits:Flag'],
        allowedRoles: ['agent', 'admin'],
        auditLevel: 'log',
        semantic: 'Flag for teacher attention.',
      },
      {
        apiName: 'deletePlan',
        displayName: 'delete',
        params: z.object({}),
        sideEffects: ['mutates:LessonPlan'],
        allowedRoles: ['admin'],
        auditLevel: 'full_diff',
        semantic: 'Delete the plan.',
      },
    ],
  };

  const student: ObjectTypeDef = {
    apiName: 'Student',
    displayName: 'Student',
    semantic: 's',
    schema: z.object({ id: z.string() }),
    links: [],
    actions: [],
  };

  const computeProgress: FunctionDef = {
    apiName: 'computeProgress',
    displayName: 'compute',
    params: z.object({ studentId: z.string() }),
    returnType: z.number(),
    semantic: 'Pure progress calculator.',
    allowedRoles: ['agent'],
  };

  const manifest: ManifestDef = {
    name: 'LessonSession',
    displayName: 'LessonSession',
    schemaVersion: '0.1.0',
    semantic: 'A lesson run.',
    slots: [
      {
        apiName: 'plan',
        displayName: 'plan',
        target: { kind: 'objectType', apiName: 'LessonPlan' },
        semantic: 'The plan.',
      },
      {
        apiName: 'students',
        displayName: 'students',
        target: { kind: 'objectType', apiName: 'Student' },
        collection: true,
        semantic: 'Enrolled students.',
      },
    ],
    streams: [
      {
        apiName: 'events',
        displayName: 'events',
        payloadSchema: z.object({ kind: z.string() }),
        semantic: 'Classroom events.',
      },
    ],
    state: [
      {
        apiName: 'phase',
        displayName: 'phase',
        schema: z.enum(['waiting', 'practice']),
        initial: 'waiting',
        semantic: 'Current phase.',
      },
    ],
    boundaries: [
      {
        role: 'agent',
        readable: ['plan', 'students', 'phase'],
        writable: ['phase'],
        actions: ['flagForIntervention'],
        subscribes: ['events'],
      },
      {
        role: 'admin',
        readable: ['*'],
        writable: ['*'],
        actions: ['*'],
        subscribes: ['*'],
      },
    ],
  };

  const registry = new OntologyRegistry();
  registry.registerObjectType(lessonPlan);
  registry.registerObjectType(student);
  registry.registerFunction(computeProgress);
  registry.registerManifest(manifest);
  registry.validate();

  return { registry, manifest };
}

describe('projectAsAnthropicTools', () => {
  it('returns visible actions for the agent role', () => {
    const { registry, manifest } = setup();
    const tools = projectAsAnthropicTools(manifest, registry, 'agent');
    const names = tools.map((t) => t.name);
    expect(names).toContain('flagForIntervention');
    expect(names).toContain('computeProgress'); // function with agent role
    expect(names).not.toContain('deletePlan'); // admin-only action
  });

  it('uses input_schema (snake_case) and includes JSON Schema shape', () => {
    const { registry, manifest } = setup();
    const tools = projectAsAnthropicTools(manifest, registry, 'agent');
    const flag = tools.find((t) => t.name === 'flagForIntervention');
    expect(flag).toBeDefined();
    expect(flag).toHaveProperty('input_schema');
    const schema = flag!.input_schema as { properties?: Record<string, unknown> };
    expect(schema.properties).toHaveProperty('reason');
  });

  it('admin sees all actions including admin-only', () => {
    const { registry, manifest } = setup();
    const tools = projectAsAnthropicTools(manifest, registry, 'admin');
    const names = tools.map((t) => t.name);
    expect(names).toContain('flagForIntervention');
    expect(names).toContain('deletePlan');
  });
});

describe('projectAsMcpTools', () => {
  it('uses inputSchema (camelCase)', () => {
    const { registry, manifest } = setup();
    const tools = projectAsMcpTools(manifest, registry, 'agent');
    const flag = tools.find((t) => t.name === 'flagForIntervention');
    expect(flag).toHaveProperty('inputSchema');
    expect(flag).not.toHaveProperty('input_schema');
  });

  it('has same visibility rules as Anthropic projection', () => {
    const { registry, manifest } = setup();
    const a = projectAsAnthropicTools(manifest, registry, 'agent').map((t) => t.name).sort();
    const m = projectAsMcpTools(manifest, registry, 'agent').map((t) => t.name).sort();
    expect(a).toEqual(m);
  });
});

describe('projectAsSystemPrompt', () => {
  it('renders Markdown sections', () => {
    const { registry, manifest } = setup();
    const text = projectAsSystemPrompt(manifest, registry, 'agent');
    expect(text).toContain('# LessonSession (LessonSession)');
    expect(text).toContain('A lesson run.');
    expect(text).toContain('## Slots');
    expect(text).toContain('## State');
    expect(text).toContain('## What you can do');
    expect(text).toContain('## What you can subscribe to');
    expect(text).toContain('## What you can compute');
  });

  it('filters slot list by role readable', () => {
    const { registry, manifest } = setup();
    const text = projectAsSystemPrompt(manifest, registry, 'agent');
    expect(text).toContain('**plan**');
    expect(text).toContain('**students**');
  });

  it('marks writable state fields', () => {
    const { registry, manifest } = setup();
    const text = projectAsSystemPrompt(manifest, registry, 'agent');
    // 'phase' is in both readable and writable
    expect(text).toMatch(/\*\*phase\*\*\s*\(writable\)/);
  });

  it('only lists actions the role can structurally invoke', () => {
    const { registry, manifest } = setup();
    const text = projectAsSystemPrompt(manifest, registry, 'agent');
    expect(text).toContain('flagForIntervention');
    expect(text).not.toContain('deletePlan');
  });

  it('renders parameter field names in action signatures', () => {
    const { registry, manifest } = setup();
    const text = projectAsSystemPrompt(manifest, registry, 'agent');
    // Markdown emits **flagForIntervention**(reason) — bold-name then params
    expect(text).toMatch(/\*\*flagForIntervention\*\*\(reason\)/);
  });

  it('omits sections that are empty for the role', () => {
    const { registry, manifest } = setup();
    // Build a tightly-scoped role that sees nothing
    const restricted: ManifestDef = {
      ...manifest,
      boundaries: [
        ...manifest.boundaries,
        { role: 'picker', readable: [], writable: [], actions: [], subscribes: [] },
      ],
    };
    const text = projectAsSystemPrompt(restricted, registry, 'picker');
    // Header + semantic remain; no sections
    expect(text).toContain('# LessonSession');
    expect(text).not.toContain('## Slots');
    expect(text).not.toContain('## State');
    expect(text).not.toContain('## What you can subscribe to');
    // computeProgress function won't be listed for 'picker' (not in allowedRoles)
    expect(text).not.toContain('computeProgress');
  });
});

describe('projection edge cases', () => {
  function emptyManifest(): ManifestDef {
    return {
      name: 'Empty',
      displayName: 'Empty',
      schemaVersion: '0.1.0',
      semantic: 'no slots, no actions, no streams',
      slots: [],
      state: [],
      boundaries: [
        { role: 'agent', readable: [], writable: [], actions: [] },
      ],
    };
  }

  it('Anthropic projection returns [] when no actions visible', () => {
    const r = new OntologyRegistry();
    const m = emptyManifest();
    r.registerManifest(m);
    r.validate();
    expect(projectAsAnthropicTools(m, r, 'agent')).toEqual([]);
  });

  it('MCP projection returns [] when no actions visible', () => {
    const r = new OntologyRegistry();
    const m = emptyManifest();
    r.registerManifest(m);
    r.validate();
    expect(projectAsMcpTools(m, r, 'agent')).toEqual([]);
  });

  it('system-prompt for empty manifest is header + semantic only (no section headers)', () => {
    const r = new OntologyRegistry();
    const m = emptyManifest();
    r.registerManifest(m);
    r.validate();
    const text = projectAsSystemPrompt(m, r, 'agent');
    expect(text).toContain('# Empty (Empty)');
    expect(text).toContain('no slots, no actions, no streams');
    // No section headers when every section is empty for this role
    expect(text).not.toContain('## Slots');
    expect(text).not.toContain('## State');
    expect(text).not.toContain('## What you can do');
    expect(text).not.toContain('## What you can subscribe to');
    expect(text).not.toContain('## What you can compute');
  });

  it('Anthropic projection includes role-allowed functions even with no manifest actions', () => {
    // Pure function-only scenario: registry has functions but the
    // manifest binds no slot whose ObjectType has actions. The
    // projection still lists the functions since they're
    // registry-scoped, not slot-bound.
    const r = new OntologyRegistry();
    r.registerFunction({
      apiName: 'pureCompute',
      displayName: 'pure',
      params: z.object({ x: z.number() }),
      returnType: z.number(),
      semantic: 'compute',
      allowedRoles: ['agent'],
    });
    const m = emptyManifest();
    r.registerManifest(m);
    r.validate();
    const tools = projectAsAnthropicTools(m, r, 'agent');
    expect(tools.map((t) => t.name)).toEqual(['pureCompute']);
  });

  it('function with empty allowedRoles is visible to every role', () => {
    // Documents the contract: allowedRoles=[] means "anyone allowed,"
    // not "no one allowed." Mirrors the same allowedRoles semantics
    // for ActionDef in checkBoundary.
    const r = new OntologyRegistry();
    r.registerFunction({
      apiName: 'globalCompute',
      displayName: 'global',
      params: z.object({}),
      returnType: z.number(),
      semantic: 'visible to all',
      allowedRoles: [], // empty
    });
    const m = emptyManifest();
    r.registerManifest(m);
    r.validate();
    expect(projectAsAnthropicTools(m, r, 'agent').map((t) => t.name)).toContain('globalCompute');
    expect(projectAsAnthropicTools(m, r, 'picker' as 'agent').map((t) => t.name)).toContain('globalCompute');
  });
});

describe('projectManifest dispatcher', () => {
  it('dispatches to anthropic-tools format', () => {
    const { registry, manifest } = setup();
    const r = projectManifest({
      manifest, registry, role: 'agent', format: 'anthropic-tools',
    });
    expect(r.format).toBe('anthropic-tools');
    if (r.format === 'anthropic-tools') {
      expect(r.tools.length).toBeGreaterThan(0);
    }
  });

  it('dispatches to mcp-tools format', () => {
    const { registry, manifest } = setup();
    const r = projectManifest({
      manifest, registry, role: 'agent', format: 'mcp-tools',
    });
    expect(r.format).toBe('mcp-tools');
  });

  it('dispatches to system-prompt format', () => {
    const { registry, manifest } = setup();
    const r = projectManifest({
      manifest, registry, role: 'agent', format: 'system-prompt',
    });
    expect(r.format).toBe('system-prompt');
    if (r.format === 'system-prompt') {
      expect(r.text).toContain('# LessonSession');
    }
  });
});
