/**
 * Tests for `checkBoundary` — the four op kinds and the role lookup.
 * Precondition-specific coverage lives in
 * `boundary-check.preconditions.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ManifestDef } from '../../manifest/index.js';
import type { ActionDef } from '../../schema/index.js';
import { checkBoundary } from '../boundary-check.js';

// Minimal manifest reused across tests. Two roles: agent (scoped),
// admin (wildcard). One action (`flagForIntervention`) referenced in
// agent.actions; one stream (`events`) referenced in agent.subscribes.
const M: ManifestDef = {
  name: 'LessonSession',
  displayName: '课堂会话',
  schemaVersion: '0.1.0',
  semantic: 'test fixture',
  slots: [],
  state: [],
  boundaries: [
    {
      role: 'agent',
      readable: ['plan', 'students'],
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

describe('checkBoundary — role lookup', () => {
  it('denies when no boundary exists for role', () => {
    const d = checkBoundary({
      manifest: M,
      role: 'picker',
      op: { kind: 'read', path: 'plan' },
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toContain("'picker'");
  });
});

describe('checkBoundary — read', () => {
  it('allows exact-path match', () => {
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'read', path: 'plan' },
    });
    expect(d.allowed).toBe(true);
  });

  it('denies path outside readable list', () => {
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'read', path: 'secret' },
    });
    expect(d.allowed).toBe(false);
  });

  it("allows '*' wildcard", () => {
    const d = checkBoundary({
      manifest: M,
      role: 'admin',
      op: { kind: 'read', path: 'anything' },
    });
    expect(d.allowed).toBe(true);
  });

  it('allows dot-path prefix (plan in list → plan.objective allowed)', () => {
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'read', path: 'plan.objective' },
    });
    expect(d.allowed).toBe(true);
  });

  it('denies dot-path when head is also absent', () => {
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'read', path: 'secret.something' },
    });
    expect(d.allowed).toBe(false);
  });

  it('allows deep dot-path when only head is in allowlist (plan → plan.steps.objective)', () => {
    // Documents Phase 1 behavior: dot-path matching is head-based, not
    // progressive. 'plan' authorizes ANY depth under 'plan' — not just
    // one segment deep. If/when we want stricter scoping ('plan' OK
    // but 'plan.privateMetadata' denied), this test pins the behavior
    // that would need to change.
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'read', path: 'plan.steps.objective.text' },
    });
    expect(d.allowed).toBe(true);
  });

  it('denies multi-segment dot-path when head is not in allowlist (no progressive walk)', () => {
    // Documents Phase 1 behavior: matching only looks at the FIRST
    // segment. If 'students.id' is in the allowlist but 'students' is
    // not, a request for 'students.id.suffix' would NOT match
    // 'students.id' — we don't try `students.id`, only `students`.
    // This is intentional simplicity; lifted in Phase 4 if needed.
    const tighter: ManifestDef = {
      ...M,
      boundaries: [
        {
          role: 'agent',
          readable: ['students.id'], // explicit nested path; head 'students' NOT separately listed
          writable: [],
          actions: [],
        },
      ],
    };
    const d = checkBoundary({
      manifest: tighter,
      role: 'agent',
      op: { kind: 'read', path: 'students.id.suffix' },
    });
    expect(d.allowed).toBe(false);
  });
});

describe('checkBoundary — write', () => {
  it('allows exact-path match', () => {
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'write', path: 'phase' },
    });
    expect(d.allowed).toBe(true);
  });

  it('denies write to readable-but-not-writable path', () => {
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'write', path: 'plan' },
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toContain('writable');
  });

  it("admin '*' covers any write", () => {
    const d = checkBoundary({
      manifest: M,
      role: 'admin',
      op: { kind: 'write', path: 'whatever' },
    });
    expect(d.allowed).toBe(true);
  });
});

describe('checkBoundary — subscribe', () => {
  it('allows declared stream', () => {
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'subscribe', streamApiName: 'events' },
    });
    expect(d.allowed).toBe(true);
  });

  it('denies undeclared stream', () => {
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'subscribe', streamApiName: 'audit' },
    });
    expect(d.allowed).toBe(false);
  });

  it("admin '*' covers any stream", () => {
    const d = checkBoundary({
      manifest: M,
      role: 'admin',
      op: { kind: 'subscribe', streamApiName: 'anything' },
    });
    expect(d.allowed).toBe(true);
  });

  it('denies when boundary has no subscribes field', () => {
    const m: ManifestDef = {
      ...M,
      boundaries: [
        {
          role: 'agent',
          readable: [],
          writable: [],
          actions: [],
          // subscribes intentionally absent
        },
      ],
    };
    const d = checkBoundary({
      manifest: m,
      role: 'agent',
      op: { kind: 'subscribe', streamApiName: 'events' },
    });
    expect(d.allowed).toBe(false);
  });
});

describe('checkBoundary — action (gate A only, no ActionDef)', () => {
  it('allows when action listed in boundary.actions', () => {
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'action', actionApiName: 'flagForIntervention' },
    });
    expect(d.allowed).toBe(true);
  });

  it('denies when action not in boundary.actions', () => {
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'action', actionApiName: 'deleteEverything' },
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toContain('AccessBoundary.actions');
  });

  it("admin '*' covers any action", () => {
    const d = checkBoundary({
      manifest: M,
      role: 'admin',
      op: { kind: 'action', actionApiName: 'anything' },
    });
    expect(d.allowed).toBe(true);
  });
});

describe('checkBoundary — action (gate B, ActionDef provided)', () => {
  const baseAction: ActionDef = {
    apiName: 'flagForIntervention',
    displayName: '标记需要介入',
    params: z.object({ reason: z.string() }),
    sideEffects: ['emits:InterventionFlag'],
    allowedRoles: ['agent'],
    auditLevel: 'log',
    semantic: 'Flag the lesson for teacher intervention.',
  };

  it('allows when role is in allowedRoles', () => {
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'action', actionApiName: 'flagForIntervention', actionDef: baseAction },
    });
    expect(d.allowed).toBe(true);
  });

  it('denies when role not in allowedRoles', () => {
    const adminOnly: ActionDef = { ...baseAction, allowedRoles: ['admin'] };
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'action', actionApiName: 'flagForIntervention', actionDef: adminOnly },
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toContain('ActionDef.allowedRoles');
  });

  it('skips allowedRoles check when list is empty (defer to boundary.actions only)', () => {
    const openAction: ActionDef = { ...baseAction, allowedRoles: [] };
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'action', actionApiName: 'flagForIntervention', actionDef: openAction },
    });
    expect(d.allowed).toBe(true);
  });
});
