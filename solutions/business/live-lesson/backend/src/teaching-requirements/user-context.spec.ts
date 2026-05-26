/**
 * Tests for the userId resolution seam.
 *
 * Default behavior is to fall back to a default user when no header is
 * present — that's the MVP "single-user" mode (see §5.3 of the design).
 * Strict mode is opt-in via LIVE_LESSON_REQUIRE_USER_HEADER=true; flip
 * that for production once the proxy injects X-Caller-User-Id.
 */

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { resolveUserId } from './user-context';

describe('resolveUserId', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns the X-Caller-User-Id header value (lowercased key)', () => {
    expect(resolveUserId({ headers: { 'x-caller-user-id': 'alice' } })).toBe(
      'alice',
    );
  });

  it('handles array-valued header (multi-set) by taking first', () => {
    expect(
      resolveUserId({ headers: { 'x-caller-user-id': ['alice', 'bob'] } }),
    ).toBe('alice');
  });

  it('trims whitespace from header value', () => {
    expect(resolveUserId({ headers: { 'x-caller-user-id': '  alice  ' } })).toBe(
      'alice',
    );
  });

  it('falls back to default when no header is present', () => {
    delete process.env.LIVE_LESSON_REQUIRE_USER_HEADER;
    delete process.env.LIVE_LESSON_DEFAULT_USER_ID;
    expect(resolveUserId({ headers: {} })).toBe('default-teacher');
  });

  it('falls back to LIVE_LESSON_DEFAULT_USER_ID when set', () => {
    process.env.LIVE_LESSON_DEFAULT_USER_ID = 'env-default';
    delete process.env.LIVE_LESSON_REQUIRE_USER_HEADER;
    expect(resolveUserId({ headers: {} })).toBe('env-default');
  });

  it('throws Unauthorized when LIVE_LESSON_REQUIRE_USER_HEADER=true and no header', () => {
    process.env.LIVE_LESSON_REQUIRE_USER_HEADER = 'true';
    expect(() => resolveUserId({ headers: {} })).toThrow(UnauthorizedException);
  });

  it('strict mode still accepts a valid header', () => {
    process.env.LIVE_LESSON_REQUIRE_USER_HEADER = 'true';
    expect(resolveUserId({ headers: { 'x-caller-user-id': 'alice' } })).toBe(
      'alice',
    );
  });

  it('empty-string header value falls back (treated as missing)', () => {
    delete process.env.LIVE_LESSON_REQUIRE_USER_HEADER;
    expect(resolveUserId({ headers: { 'x-caller-user-id': '   ' } })).toBe(
      'default-teacher',
    );
  });

  it('handles missing headers object', () => {
    delete process.env.LIVE_LESSON_REQUIRE_USER_HEADER;
    expect(resolveUserId({})).toBe('default-teacher');
  });

  describe('header sanitization (defense against forged header content)', () => {
    it('rejects values containing newlines (log-injection)', () => {
      expect(() =>
        resolveUserId({ headers: { 'x-caller-user-id': 'alice\nbob' } }),
      ).toThrow(BadRequestException);
    });

    it('rejects values containing NUL bytes', () => {
      expect(() =>
        resolveUserId({ headers: { 'x-caller-user-id': 'alice\0evil' } }),
      ).toThrow(BadRequestException);
    });

    it('rejects values containing SQL-quote characters', () => {
      expect(() =>
        resolveUserId({ headers: { 'x-caller-user-id': "alice' OR 1=1" } }),
      ).toThrow(BadRequestException);
    });

    it('rejects values containing spaces', () => {
      expect(() =>
        resolveUserId({ headers: { 'x-caller-user-id': 'alice bob' } }),
      ).toThrow(BadRequestException);
    });

    it('rejects values longer than 128 chars', () => {
      const tooLong = 'a'.repeat(129);
      expect(() =>
        resolveUserId({ headers: { 'x-caller-user-id': tooLong } }),
      ).toThrow(BadRequestException);
    });

    it('accepts UUIDs', () => {
      expect(
        resolveUserId({
          headers: { 'x-caller-user-id': '550e8400-e29b-41d4-a716-446655440000' },
        }),
      ).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('accepts email-shaped values', () => {
      expect(
        resolveUserId({
          headers: { 'x-caller-user-id': 'alice@example.com' },
        }),
      ).toBe('alice@example.com');
    });

    it('accepts dotted namespaced IDs', () => {
      expect(
        resolveUserId({
          headers: { 'x-caller-user-id': 'tenant.alice:teacher' },
        }),
      ).toBe('tenant.alice:teacher');
    });
  });
});
