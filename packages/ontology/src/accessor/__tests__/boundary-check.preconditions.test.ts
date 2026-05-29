/**
 * Tier 1 (gap-analysis G2) precondition coverage for `checkBoundary`.
 *
 * Three precondition kinds shipped in Phase 1:
 *   - stateEquals — evaluable when input.state present
 *   - slotBound   — evaluable when input.boundSlots present
 *   - named       — stub that always returns unmet (Phase 4)
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ActionDef, ActionPrecondition } from '../../schema/index.js';
import type { ManifestDef } from '../../manifest/index.js';
import { checkBoundary } from '../boundary-check.js';

const M: ManifestDef = {
  name: 'X',
  displayName: 'X',
  schemaVersion: '0.1.0',
  semantic: 's',
  slots: [],
  state: [],
  boundaries: [
    {
      role: 'agent',
      readable: [],
      writable: [],
      actions: ['adjust'],
    },
  ],
};

function action(preconditions: readonly ActionPrecondition[]): ActionDef {
  return {
    apiName: 'adjust',
    displayName: 'adjust',
    params: z.object({}),
    sideEffects: [],
    allowedRoles: ['agent'],
    auditLevel: 'log',
    semantic: 's',
    preconditions,
  };
}

describe('precondition: stateEquals', () => {
  const pc: ActionPrecondition = { kind: 'stateEquals', path: 'phase', value: 'practice' };

  it('passes when state matches', () => {
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'action', actionApiName: 'adjust', actionDef: action([pc]) },
      state: { phase: 'practice' },
    });
    expect(d.allowed).toBe(true);
  });

  it('fails when state mismatches; surfaces in unmetPreconditions', () => {
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'action', actionApiName: 'adjust', actionDef: action([pc]) },
      state: { phase: 'waiting' },
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      expect(d.unmetPreconditions).toHaveLength(1);
      expect(d.unmetPreconditions?.[0]).toEqual(pc);
    }
  });

  it('fails (fail-safe) when no state context provided', () => {
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'action', actionApiName: 'adjust', actionDef: action([pc]) },
      // state intentionally absent
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.unmetPreconditions).toHaveLength(1);
  });

  it('handles null value correctly (Object.is semantics)', () => {
    const nullPc: ActionPrecondition = { kind: 'stateEquals', path: 'stepId', value: null };
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'action', actionApiName: 'adjust', actionDef: action([nullPc]) },
      state: { stepId: null },
    });
    expect(d.allowed).toBe(true);
  });
});

describe('precondition: slotBound', () => {
  const pc: ActionPrecondition = { kind: 'slotBound', slot: 'students' };

  it('passes when slot is bound', () => {
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'action', actionApiName: 'adjust', actionDef: action([pc]) },
      boundSlots: new Set(['students', 'plan']),
    });
    expect(d.allowed).toBe(true);
  });

  it('fails when slot not bound', () => {
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'action', actionApiName: 'adjust', actionDef: action([pc]) },
      boundSlots: new Set(['plan']),
    });
    expect(d.allowed).toBe(false);
  });

  it('fails (fail-safe) when no boundSlots provided', () => {
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'action', actionApiName: 'adjust', actionDef: action([pc]) },
    });
    expect(d.allowed).toBe(false);
  });
});

describe('precondition: named (Phase 1 stub)', () => {
  const pc: ActionPrecondition = { kind: 'named', name: 'studentIsStruggling' };

  it('always returns unmet (named predicates land in Phase 4)', () => {
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'action', actionApiName: 'adjust', actionDef: action([pc]) },
      state: {},
      boundSlots: new Set(),
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      expect(d.unmetPreconditions).toHaveLength(1);
      expect(d.unmetPreconditions?.[0]).toEqual(pc);
    }
  });
});

describe('precondition: composition', () => {
  it('ALL must pass; failure list contains every unmet one', () => {
    const a: ActionPrecondition = { kind: 'stateEquals', path: 'phase', value: 'practice' };
    const b: ActionPrecondition = { kind: 'slotBound', slot: 'students' };
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'action', actionApiName: 'adjust', actionDef: action([a, b]) },
      state: { phase: 'waiting' }, // a fails
      boundSlots: new Set(),       // b fails
    });
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      expect(d.unmetPreconditions).toHaveLength(2);
    }
  });

  it('absent/empty preconditions short-circuits to allowed', () => {
    const d = checkBoundary({
      manifest: M,
      role: 'agent',
      op: { kind: 'action', actionApiName: 'adjust', actionDef: action([]) },
    });
    expect(d.allowed).toBe(true);
  });
});
