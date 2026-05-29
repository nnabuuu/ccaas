/**
 * End-to-end integration test for `@kedge-agentic/ontology`.
 *
 * Unit tests cover each layer in isolation. This file exists to catch
 * integration bugs that show up only when every layer composes:
 *
 *   helpers (define*)
 *     → schema primitives (ObjectTypeDef, ActionDef, FunctionDef)
 *     → manifest composition (Slots, State, AccessBoundary)
 *     → registry registration + seal()
 *     → checkBoundary against multiple roles
 *     → distribution (serialize + digest)
 *     → semantic projection (all three formats)
 *
 * The fixture is a `LessonSession` shape — close enough to the
 * canonical Phase 1 example that any future spec drift between docs
 * and code is likely to surface here before it lands somewhere
 * harder to debug.
 *
 * Tests are intentionally chunky — each one stresses one
 * end-to-end concern (read path, write path, action visibility,
 * digest stability under reordering). The fixture itself is the
 * shared substrate; the goal is to keep the setup costs amortized
 * while still keeping individual assertions meaningful.
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { z } from 'zod';
import {
  defineAction,
  defineFunction,
  defineManifest,
  defineObjectType,
  defineStateField,
} from '../../helpers/index.js';
import { OntologyRegistry } from '../../registry/index.js';
import { checkBoundary } from '../../accessor/index.js';
import { computeSchemaDigest, serializeRegistry } from '../../distribution/index.js';
import {
  projectAsAnthropicTools,
  projectAsMcpTools,
  projectAsSystemPrompt,
} from '../../semantic/index.js';
import type { ManifestDef } from '../../manifest/index.js';

// ────────────────────────────────────────────────────────────────────
// Fixture: a small but realistic LessonSession ontology
// ────────────────────────────────────────────────────────────────────

function buildOntology(): {
  registry: OntologyRegistry;
  manifest: ManifestDef;
} {
  // ObjectTypes
  const Student = defineObjectType({
    apiName: 'Student',
    displayName: { en: 'Student', zh: '学生' },
    semantic: 'A learner enrolled in a class.',
    schema: z.object({
      id: z.string().describe('Student ID'),
      name: z.string().describe('Display name'),
      mastery: z.number().min(0).max(100).describe('Mastery score 0-100'),
    }),
    meta: {
      name: { searchable: true, displayRole: 'title' },
      mastery: { displayRole: 'badge' },
    },
    links: [],
    actions: [],
    picker: {
      icon: 'user',
      searchFields: ['name'],
      titleField: 'name',
      subtitleField: 'id',
    },
  });

  const LessonPlan = defineObjectType({
    apiName: 'LessonPlan',
    displayName: 'Lesson Plan',
    semantic: 'A pedagogical plan with structured steps.',
    schema: z.object({
      id: z.string(),
      objective: z.string(),
      stepCount: z.number().int().positive(),
    }),
    links: [],
    actions: [
      defineAction({
        apiName: 'advancePhase',
        displayName: 'advance phase',
        params: z.object({ to: z.enum(['practice', 'discuss']) }),
        sideEffects: ['mutates:LessonSession.state.phase'],
        allowedRoles: ['agent', 'teacher', 'admin'],
        auditLevel: 'log',
        semantic: 'Move the session to the next teaching phase.',
        preconditions: [
          { kind: 'stateEquals', path: 'phase', value: 'waiting' },
        ],
      }),
      defineAction({
        apiName: 'flagForIntervention',
        displayName: 'flag for intervention',
        params: z.object({
          studentId: z.string(),
          reason: z.string(),
        }),
        sideEffects: ['emits:InterventionFlag'],
        allowedRoles: ['agent', 'teacher', 'admin'],
        auditLevel: 'full_diff',
        semantic: 'Mark a student as needing teacher attention.',
        preconditions: [{ kind: 'slotBound', slot: 'students' }],
      }),
    ],
  });

  // Function (pure read computation)
  const computeProgress = defineFunction({
    apiName: 'computeProgress',
    displayName: 'compute progress',
    params: z.object({ studentId: z.string() }),
    returnType: z.number().min(0).max(1),
    semantic: 'Compute a 0-1 progress score for a student.',
    allowedRoles: ['agent', 'teacher', 'admin'],
  });

  // Manifest
  const LessonSession = defineManifest({
    name: 'LessonSession',
    displayName: { en: 'Lesson Session', zh: '课堂会话' },
    schemaVersion: '0.1.0',
    semantic: 'One run of a LessonPlan with a specific cohort of students.',
    slots: [
      {
        apiName: 'plan',
        displayName: 'plan',
        target: { kind: 'objectType', apiName: 'LessonPlan' },
        required: true,
        semantic: 'The lesson plan being executed.',
      },
      {
        apiName: 'students',
        displayName: 'students',
        target: { kind: 'objectType', apiName: 'Student' },
        collection: true,
        semantic: 'Enrolled students.',
      },
    ],
    state: [
      defineStateField({
        apiName: 'phase',
        displayName: 'phase',
        schema: z.enum(['waiting', 'practice', 'discuss', 'ended']),
        initial: 'waiting',
        semantic: 'Current teaching phase.',
      }),
    ],
    boundaries: [
      {
        role: 'agent',
        readable: ['plan', 'students', 'phase'],
        writable: ['phase'],
        actions: ['advancePhase', 'flagForIntervention'],
      },
      {
        role: 'teacher',
        readable: ['plan', 'students', 'phase'],
        writable: ['phase'],
        actions: ['advancePhase', 'flagForIntervention'],
      },
      {
        role: 'admin',
        readable: ['*'],
        writable: ['*'],
        actions: ['*'],
      },
    ],
  });

  const registry = new OntologyRegistry();
  registry.registerObjectType(Student);
  registry.registerObjectType(LessonPlan);
  registry.registerFunction(computeProgress);
  registry.registerManifest(LessonSession);
  registry.seal(); // strict — any cross-def issue throws here

  return { registry, manifest: LessonSession };
}

// ────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────

describe('full ontology — register + seal', () => {
  it('builds and seals without error', () => {
    expect(() => buildOntology()).not.toThrow();
  });

  it('seal flips the sealed flag', () => {
    const { registry } = buildOntology();
    expect(registry.isSealed()).toBe(true);
  });

  it('subsequent register* after seal throws', () => {
    const { registry } = buildOntology();
    expect(() =>
      registry.registerObjectType({
        apiName: 'Late',
        displayName: 'Late',
        semantic: 's',
        schema: z.object({ id: z.string() }),
        links: [],
        actions: [],
      }),
    ).toThrow(/sealed/);
  });
});

describe('full ontology — read API', () => {
  let registry: OntologyRegistry;
  beforeAll(() => {
    registry = buildOntology().registry;
  });

  it('getAllObjectTypes returns the two registered types', () => {
    expect(registry.getAllObjectTypes().map((t) => t.apiName).sort()).toEqual([
      'LessonPlan',
      'Student',
    ]);
  });

  it('getPickableTypes returns only types with a picker config', () => {
    // Only Student has picker; LessonPlan does not
    expect(registry.getPickableTypes().map((t) => t.apiName)).toEqual([
      'Student',
    ]);
  });

  it('getManifestsForType resolves slot bindings', () => {
    expect(registry.getManifestsForType('Student').map((m) => m.name)).toEqual([
      'LessonSession',
    ]);
    expect(registry.getManifestsForType('LessonPlan').map((m) => m.name)).toEqual([
      'LessonSession',
    ]);
  });

  it('getDisplayName resolves through localized displayName', () => {
    expect(registry.getDisplayName('Student', 'en')).toBe('Student');
    expect(registry.getDisplayName('Student', 'zh')).toBe('学生');
    expect(registry.getDisplayName('LessonSession', 'zh')).toBe('课堂会话');
  });
});

describe('full ontology — checkBoundary across roles', () => {
  let registry: OntologyRegistry;
  let manifest: ManifestDef;
  beforeAll(() => {
    const out = buildOntology();
    registry = out.registry;
    manifest = out.manifest;
  });

  it('agent can read plan but not write to it', () => {
    expect(
      checkBoundary({ manifest, role: 'agent', op: { kind: 'read', path: 'plan' } })
        .allowed,
    ).toBe(true);
    expect(
      checkBoundary({ manifest, role: 'agent', op: { kind: 'write', path: 'plan' } })
        .allowed,
    ).toBe(false);
  });

  it('agent can both read and write phase', () => {
    expect(
      checkBoundary({ manifest, role: 'agent', op: { kind: 'read', path: 'phase' } })
        .allowed,
    ).toBe(true);
    expect(
      checkBoundary({ manifest, role: 'agent', op: { kind: 'write', path: 'phase' } })
        .allowed,
    ).toBe(true);
  });

  it('admin wildcard covers an arbitrary path', () => {
    expect(
      checkBoundary({
        manifest,
        role: 'admin',
        op: { kind: 'read', path: 'never.declared.path' },
      }).allowed,
    ).toBe(true);
  });

  it('unknown role is denied (no AccessBoundary)', () => {
    expect(
      checkBoundary({
        manifest,
        role: 'picker',
        op: { kind: 'read', path: 'plan' },
      }).allowed,
    ).toBe(false);
  });

  it('action precondition stateEquals fires when state mismatches', () => {
    const advance = registry
      .getObjectType('LessonPlan')!
      .actions.find((a) => a.apiName === 'advancePhase')!;
    const denied = checkBoundary({
      manifest,
      role: 'agent',
      op: { kind: 'action', actionApiName: 'advancePhase', actionDef: advance },
      state: { phase: 'practice' }, // doesn't match precondition 'waiting'
    });
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) {
      expect(denied.unmetPreconditions).toHaveLength(1);
    }
  });

  it('action precondition stateEquals passes when state matches', () => {
    const advance = registry
      .getObjectType('LessonPlan')!
      .actions.find((a) => a.apiName === 'advancePhase')!;
    const allowed = checkBoundary({
      manifest,
      role: 'agent',
      op: { kind: 'action', actionApiName: 'advancePhase', actionDef: advance },
      state: { phase: 'waiting' },
    });
    expect(allowed.allowed).toBe(true);
  });

  it('action precondition slotBound fails when slot absent', () => {
    const flag = registry
      .getObjectType('LessonPlan')!
      .actions.find((a) => a.apiName === 'flagForIntervention')!;
    const denied = checkBoundary({
      manifest,
      role: 'agent',
      op: { kind: 'action', actionApiName: 'flagForIntervention', actionDef: flag },
      boundSlots: new Set(), // no slots bound
    });
    expect(denied.allowed).toBe(false);
  });
});

describe('full ontology — semantic projection in three formats', () => {
  let registry: OntologyRegistry;
  let manifest: ManifestDef;
  beforeAll(() => {
    const out = buildOntology();
    registry = out.registry;
    manifest = out.manifest;
  });

  it('Anthropic tools format exposes role-visible actions + functions', () => {
    const tools = projectAsAnthropicTools(manifest, registry, 'agent');
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(['advancePhase', 'computeProgress', 'flagForIntervention']);
    // input_schema is JSON Schema, not Zod
    const advance = tools.find((t) => t.name === 'advancePhase');
    expect(advance?.input_schema).toMatchObject({
      type: 'object',
      properties: expect.objectContaining({ to: expect.anything() }),
    });
  });

  it('MCP tools format matches Anthropic in name set, differs in key casing', () => {
    const a = projectAsAnthropicTools(manifest, registry, 'agent')
      .map((t) => t.name)
      .sort();
    const m = projectAsMcpTools(manifest, registry, 'agent')
      .map((t) => t.name)
      .sort();
    expect(a).toEqual(m);
    const advance = projectAsMcpTools(manifest, registry, 'agent').find(
      (t) => t.name === 'advancePhase',
    );
    expect(advance).toHaveProperty('inputSchema');
    expect(advance).not.toHaveProperty('input_schema');
  });

  it('system-prompt projection renders sections in canonical order', () => {
    const text = projectAsSystemPrompt(manifest, registry, 'agent');
    const slotsIdx = text.indexOf('## Slots');
    const stateIdx = text.indexOf('## State');
    const actionsIdx = text.indexOf('## What you can do');
    const computeIdx = text.indexOf('## What you can compute');
    expect(slotsIdx).toBeGreaterThan(-1);
    expect(stateIdx).toBeGreaterThan(slotsIdx);
    expect(actionsIdx).toBeGreaterThan(stateIdx);
    expect(computeIdx).toBeGreaterThan(actionsIdx);
  });

  it('admin sees a strictly superset of agent capabilities', () => {
    const agentNames = new Set(
      projectAsAnthropicTools(manifest, registry, 'agent').map((t) => t.name),
    );
    const adminNames = new Set(
      projectAsAnthropicTools(manifest, registry, 'admin').map((t) => t.name),
    );
    // Every agent-visible tool is also admin-visible
    for (const name of agentNames) {
      expect(adminNames.has(name)).toBe(true);
    }
  });
});

describe('full ontology — digest determinism', () => {
  it('two independently-built registries produce identical digests', () => {
    const r1 = buildOntology().registry;
    const r2 = buildOntology().registry;
    expect(r1.getSchemaDigest()).toBe(r2.getSchemaDigest());
  });

  it('digest is sensitive to a single field change', () => {
    const before = buildOntology().registry.getSchemaDigest();
    // Build a fresh registry with one ActionDef.semantic tweaked
    const ot = buildOntology()
      .registry.getObjectType('LessonPlan')!;
    const r = new OntologyRegistry();
    r.registerObjectType({
      ...ot,
      actions: ot.actions.map((a) =>
        a.apiName === 'advancePhase'
          ? { ...a, semantic: 'CHANGED: ' + a.semantic }
          : a,
      ),
    });
    // Re-register the rest as-is so the rest of the registry matches
    r.registerObjectType(buildOntology().registry.getObjectType('Student')!);
    r.registerFunction(buildOntology().registry.getFunction('computeProgress')!);
    r.registerManifest(buildOntology().registry.getManifest('LessonSession')!);
    r.seal();
    expect(r.getSchemaDigest()).not.toBe(before);
  });

  it('serializeRegistry output round-trips through canonical JSON deterministically', () => {
    const r1 = buildOntology().registry;
    const r2 = buildOntology().registry;
    const j1 = JSON.stringify(serializeRegistry(r1.context()));
    const j2 = JSON.stringify(serializeRegistry(r2.context()));
    expect(j1).toBe(j2);
    expect(computeSchemaDigest(serializeRegistry(r1.context()))).toBe(
      computeSchemaDigest(serializeRegistry(r2.context())),
    );
  });
});
