/**
 * Type-shape tests for `ActionDef` + `ActionPrecondition`.
 *
 * Most of ActionDef is a TypeScript interface — the runtime behavior
 * (validate args, dispatch handler, audit) lives in the Phase 3 bridge,
 * not in this package. These tests confirm the type composes correctly
 * with realistic Zod schemas and that all three ActionPrecondition
 * discriminants type-check.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ActionDef, ActionPrecondition } from '../action.js';

describe('ActionDef', () => {
  it('composes with a typed Zod params schema', () => {
    const adjustDifficulty: ActionDef = {
      apiName: 'adjustDifficulty',
      displayName: '调整难度',
      params: z.object({
        direction: z.enum(['easier', 'harder']),
        reason: z.string(),
      }),
      sideEffects: ['mutates:LessonPlan.steps'],
      allowedRoles: ['agent', 'admin'],
      requiredScopes: ['chat'],
      auditLevel: 'full_diff',
      semantic: 'Re-paces the plan toward easier or harder content.',
    };
    expect(adjustDifficulty.apiName).toBe('adjustDifficulty');
    // The params schema should still parse what it should.
    expect(adjustDifficulty.params.parse({ direction: 'easier', reason: 'r' })).toEqual({
      direction: 'easier',
      reason: 'r',
    });
  });

  it('accepts the optional preconditions array', () => {
    const action: ActionDef = {
      apiName: 'a',
      displayName: 'a',
      params: z.object({}),
      sideEffects: [],
      preconditions: [
        { kind: 'stateEquals', path: 'phase', value: 'practice' },
        { kind: 'slotBound', slot: 'class' },
      ],
      allowedRoles: ['agent'],
      auditLevel: 'log',
      semantic: 's',
    };
    expect(action.preconditions).toHaveLength(2);
  });

  it('preconditions discriminate by `kind`', () => {
    const stateEq: ActionPrecondition = {
      kind: 'stateEquals',
      path: 'phase',
      value: 'practice',
    };
    const slotBound: ActionPrecondition = { kind: 'slotBound', slot: 'class' };
    const named: ActionPrecondition = {
      kind: 'named',
      name: 'isInWeekendMode',
      params: { someParam: true },
    };
    expect(stateEq.kind).toBe('stateEquals');
    expect(slotBound.kind).toBe('slotBound');
    expect(named.kind).toBe('named');
  });
});
