/**
 * Tests for the lesson-plan lib materialization extension on
 * SessionAssetMaterializer.
 *
 * Just the env-var parser here — the actual HTTP-driven materialize
 * flow needs a live mock server which is too heavy for unit tests;
 * an integration-level test in live-lesson covers the end-to-end
 * happy path against a real backend.
 */

import { describe, it, expect } from '@jest/globals';
import {
  isUrlSafeForServerFetch,
  parseLessonPlanLibUrls,
} from './session-asset-materializer.service';

describe('parseLessonPlanLibUrls', () => {
  it('returns empty map for unset env', () => {
    expect(parseLessonPlanLibUrls(undefined)).toEqual({});
    expect(parseLessonPlanLibUrls('')).toEqual({});
  });

  it('parses single entry', () => {
    expect(
      parseLessonPlanLibUrls('live-lesson:http://localhost:3007'),
    ).toEqual({ 'live-lesson': 'http://localhost:3007' });
  });

  it('parses multiple comma-separated entries', () => {
    const out = parseLessonPlanLibUrls(
      'live-lesson:http://ll:3007,demo-sandbox:https://demo.example.com',
    );
    expect(out).toEqual({
      'live-lesson': 'http://ll:3007',
      'demo-sandbox': 'https://demo.example.com',
    });
  });

  it('handles URLs containing :// by splitting on the FIRST colon only', () => {
    expect(
      parseLessonPlanLibUrls('slug:https://host.example.com:8443/path'),
    ).toEqual({ slug: 'https://host.example.com:8443/path' });
  });

  it('rejects entries without :// scheme (only http/https allowed)', () => {
    expect(parseLessonPlanLibUrls('slug:ftp://host')).toEqual({});
    expect(parseLessonPlanLibUrls('slug:not-a-url')).toEqual({});
    expect(parseLessonPlanLibUrls('slug:javascript:alert(1)')).toEqual({});
  });

  it('skips bad entries silently while keeping good ones', () => {
    const out = parseLessonPlanLibUrls(
      'good:http://host,bad-no-url,another-good:https://h2,not_url:not-a-url',
    );
    expect(out).toEqual({
      good: 'http://host',
      'another-good': 'https://h2',
    });
  });

  it('trims whitespace around slug and URL', () => {
    expect(
      parseLessonPlanLibUrls('  slug  :  http://host  '),
    ).toEqual({ slug: 'http://host' });
  });

  it('rejects entries with empty slug or empty URL', () => {
    expect(parseLessonPlanLibUrls(':http://host')).toEqual({});
    expect(parseLessonPlanLibUrls('slug:')).toEqual({});
  });
});

describe('isUrlSafeForServerFetch (SSRF guard)', () => {
  const originalEnv = process.env.LESSON_PLAN_LIB_ALLOW_INTERNAL;
  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.LESSON_PLAN_LIB_ALLOW_INTERNAL;
    } else {
      process.env.LESSON_PLAN_LIB_ALLOW_INTERNAL = originalEnv;
    }
  });

  it('rejects non-URL strings', () => {
    delete process.env.LESSON_PLAN_LIB_ALLOW_INTERNAL;
    expect(isUrlSafeForServerFetch('not-a-url')).toBe(false);
  });

  it('rejects non-http(s) schemes', () => {
    delete process.env.LESSON_PLAN_LIB_ALLOW_INTERNAL;
    expect(isUrlSafeForServerFetch('ftp://example.com')).toBe(false);
    expect(isUrlSafeForServerFetch('file:///etc/passwd')).toBe(false);
    expect(isUrlSafeForServerFetch('javascript:alert(1)')).toBe(false);
  });

  it('rejects localhost / 127.0.0.1 / ::1 by default', () => {
    delete process.env.LESSON_PLAN_LIB_ALLOW_INTERNAL;
    expect(isUrlSafeForServerFetch('http://localhost:3007')).toBe(false);
    expect(isUrlSafeForServerFetch('http://127.0.0.1')).toBe(false);
    expect(isUrlSafeForServerFetch('http://[::1]')).toBe(false);
  });

  it('rejects RFC1918 private ranges', () => {
    delete process.env.LESSON_PLAN_LIB_ALLOW_INTERNAL;
    expect(isUrlSafeForServerFetch('http://10.0.0.1')).toBe(false);
    expect(isUrlSafeForServerFetch('http://192.168.1.1')).toBe(false);
    expect(isUrlSafeForServerFetch('http://172.16.0.1')).toBe(false);
    expect(isUrlSafeForServerFetch('http://172.31.255.255')).toBe(false);
  });

  it('rejects 169.254.0.0/16 (link-local incl. cloud metadata)', () => {
    delete process.env.LESSON_PLAN_LIB_ALLOW_INTERNAL;
    expect(isUrlSafeForServerFetch('http://169.254.169.254')).toBe(false);
  });

  it('accepts public hostnames', () => {
    delete process.env.LESSON_PLAN_LIB_ALLOW_INTERNAL;
    expect(isUrlSafeForServerFetch('https://api.example.com')).toBe(true);
    expect(isUrlSafeForServerFetch('http://lesson-plan.internal.acme')).toBe(true);
  });

  it('allows internal addresses when LESSON_PLAN_LIB_ALLOW_INTERNAL=true (dev mode)', () => {
    process.env.LESSON_PLAN_LIB_ALLOW_INTERNAL = 'true';
    expect(isUrlSafeForServerFetch('http://localhost:3007')).toBe(true);
    expect(isUrlSafeForServerFetch('http://192.168.1.1')).toBe(true);
  });

  it('rejects 172 ranges OUTSIDE 172.16-31 (not private)', () => {
    delete process.env.LESSON_PLAN_LIB_ALLOW_INTERNAL;
    // 172.15.x and 172.32.x are NOT private — must be allowed.
    expect(isUrlSafeForServerFetch('http://172.15.0.1')).toBe(true);
    expect(isUrlSafeForServerFetch('http://172.32.0.1')).toBe(true);
    // 172.16-31 are private — must be rejected.
    expect(isUrlSafeForServerFetch('http://172.20.0.1')).toBe(false);
  });
});
