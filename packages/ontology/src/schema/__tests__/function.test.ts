/**
 * Type-shape tests for `FunctionDef`.
 *
 * `FunctionDef` is intentionally structurally similar to `ActionDef`
 * minus the side-effect-bearing fields. These tests confirm the type
 * composes and that the deliberately-absent fields are actually
 * absent (an attempt to set them should fail to type-check).
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { FunctionDef } from '../function.js';
import { objectRef } from '../zod-helpers.js';

describe('FunctionDef', () => {
  it('composes with typed params and return schemas', () => {
    const computeEngagement: FunctionDef = {
      apiName: 'computeEngagementScore',
      displayName: '计算参与度',
      params: z.object({
        studentId: objectRef('Student'),
        windowMinutes: z.number().int().min(1).max(60),
      }),
      returnType: z.number().min(0).max(100),
      semantic:
        "Read the student's recent ClassroomEvents and compute their engagement score.",
      allowedRoles: ['agent', 'admin'],
    };
    expect(computeEngagement.apiName).toBe('computeEngagementScore');
  });

  it('rejects side-effect-bearing fields at compile time', () => {
    const fn: FunctionDef = {
      apiName: 'f',
      displayName: 'f',
      params: z.object({}),
      returnType: z.number(),
      semantic: 's',
      allowedRoles: ['agent'],
      // @ts-expect-error — FunctionDef intentionally omits sideEffects
      sideEffects: ['mutates:something'],
    };
    expect(fn.apiName).toBe('f');
  });

  it('rejects auditLevel at compile time', () => {
    const fn: FunctionDef = {
      apiName: 'f',
      displayName: 'f',
      params: z.object({}),
      returnType: z.number(),
      semantic: 's',
      allowedRoles: ['agent'],
      // @ts-expect-error — FunctionDef has no auditLevel; the bridge pins it at 'log'
      auditLevel: 'full_diff',
    };
    expect(fn.apiName).toBe('f');
  });

  it('rejects requiresApproval at compile time', () => {
    const fn: FunctionDef = {
      apiName: 'f',
      displayName: 'f',
      params: z.object({}),
      returnType: z.number(),
      semantic: 's',
      allowedRoles: ['agent'],
      // @ts-expect-error — approval for a pure read is a category error
      requiresApproval: true,
    };
    expect(fn.apiName).toBe('f');
  });
});
