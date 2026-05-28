/**
 * Reserved-field sanitization unit tests.
 *
 * Contract: identity fields the platform owns (userId, tenantId, etc.)
 * must NEVER survive into a tool handler. The strip is the first
 * defense layer against prompt-injection identity spoofing.
 */

import {
  isReservedField,
  RESERVED_ARG_FIELDS,
  sanitizeArgs,
} from './reserved-fields';
import type { ExecutionContext } from './types';

describe('reserved-fields', () => {
  describe('RESERVED_ARG_FIELDS', () => {
    it('locks down the canonical reserved set (any change is a contract change)', () => {
      // Snapshot guard — changing this list affects EVERY tool call
      // and the spoofing-resistance argument in the design doc.
      // If you intentionally add/remove a reserved field, update both
      // here AND in ExecutionContext + the spoofing spec.
      expect([...RESERVED_ARG_FIELDS].sort()).toEqual(
        [
          'userId',
          'tenantId',
          'sessionId',
          'permissions',
          'context',
          'role',
          'solutionId',
          'actingUserId',
          'actingRole',
          'apiKeyId',
          'effectiveScope',
        ].sort(),
      );
    });

    it('covers every ExecutionContext field (the contract from reserved-fields.ts)', () => {
      // This test reifies the invariant doc'd at the top of
      // reserved-fields.ts: every ExecutionContext field must be a
      // reserved arg name, otherwise it can be set by the agent and
      // bypass the platform's authoritative value.
      //
      // The compiler can't enforce "the keys of ExecutionContext are
      // a subset of RESERVED_ARG_FIELDS" because ExecutionContext is a
      // type-only shape — there's no runtime key list. We instead
      // assert against a hand-mirrored list that the type system DOES
      // check (the `satisfies` clause forces every key to be a real
      // ExecutionContext field).
      const ctxKeys = {
        solutionId: true,
        sessionId: true,
        actingUserId: true,
        actingRole: true,
        apiKeyId: true,
        effectiveScope: true,
      } satisfies { [K in keyof Required<ExecutionContext>]: true };

      const reservedSet = new Set<string>(RESERVED_ARG_FIELDS);
      const missing = Object.keys(ctxKeys).filter((k) => !reservedSet.has(k));
      expect(missing).toEqual([]);
    });
  });

  describe('isReservedField', () => {
    it('matches every reserved name', () => {
      for (const name of RESERVED_ARG_FIELDS) {
        expect(isReservedField(name)).toBe(true);
      }
    });

    it('rejects non-reserved names', () => {
      for (const name of ['title', 'items', 'foo', 'USER_ID', 'userid']) {
        expect(isReservedField(name)).toBe(false);
      }
    });

    it('case-sensitive (avoids surprise collisions with random fields)', () => {
      expect(isReservedField('UserId')).toBe(false);
      expect(isReservedField('USERID')).toBe(false);
    });
  });

  describe('sanitizeArgs', () => {
    it('returns an empty pair for nullish input', () => {
      expect(sanitizeArgs(undefined)).toEqual({ cleaned: {}, stripped: [] });
      expect(sanitizeArgs({} as any)).toEqual({ cleaned: {}, stripped: [] });
    });

    it('passes through benign args untouched', () => {
      const args = { title: 'Hi', count: 3, nested: { foo: 'bar' } };
      const { cleaned, stripped } = sanitizeArgs(args);
      expect(stripped).toEqual([]);
      expect(cleaned).toEqual(args);
    });

    it('strips every reserved field at the top level', () => {
      const args = {
        title: 'Pwned',
        userId: 'attacker',
        tenantId: 'other-tenant',
        permissions: ['admin:*'],
        role: 'admin',
      };
      const { cleaned, stripped } = sanitizeArgs(args);
      expect(cleaned).toEqual({ title: 'Pwned' });
      expect(stripped.sort()).toEqual(
        ['permissions', 'role', 'tenantId', 'userId'].sort(),
      );
    });

    it('does NOT recurse into nested objects — schema validator handles structure', () => {
      // Documented limitation: a tool that legitimately accepts an
      // object containing a `userId` field within a nested context
      // works fine. The reserved set is intentionally top-level.
      const args = { profile: { userId: 'inner-anything', name: 'Alice' } };
      const { cleaned, stripped } = sanitizeArgs(args);
      expect(stripped).toEqual([]);
      expect(cleaned).toEqual(args);
    });

    it('does not mutate the input object', () => {
      const args = { title: 'X', userId: 'a' };
      const before = { ...args };
      sanitizeArgs(args);
      expect(args).toEqual(before);
    });

    it('handles the empty-string field name gracefully', () => {
      // Object.entries iterates "" keys correctly; check we don't blow up.
      const args = { '': 'empty', title: 'X' };
      const { cleaned } = sanitizeArgs(args);
      expect(cleaned).toEqual(args);
    });
  });
});
