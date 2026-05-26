/**
 * UserContext — minimal user identity resolution for the L2 layer.
 *
 * See `docs/lesson-plan-format-design.md` §5.3:
 *   - Path A (target): ccaas → live-lesson proxy propagates the
 *     caller's userId via `X-Caller-User-Id` header. live-lesson trusts
 *     this header because the proxy injects it server-side (browser
 *     never holds ccaas key, so it can't forge).
 *   - MVP fallback: a default user (`LIVE_LESSON_DEFAULT_USER_ID` env
 *     or 'default-teacher') so this feature ships before the
 *     proxy-side userId propagation lands. This is explicitly
 *     "single-user mode" — operators must understand interpretations
 *     are shared across all callers until path A ships.
 *
 * `resolveUserId` is a single seam: switch from MVP fallback to
 * strict header-required behavior by setting
 * `LIVE_LESSON_REQUIRE_USER_HEADER=true`.
 */

import {
  BadRequestException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

const logger = new Logger('UserContext');

const DEFAULT_FALLBACK_USER_ID = 'default-teacher';
const USER_ID_MAX_LENGTH = 128;
// Conservative charset: alphanumerics, dash, underscore, dot, @, colon
// (enough for UUIDs, emails, namespaced IDs). Rejects newlines, NUL,
// quotes, anything log-injection or query-poisoning could exploit.
const USER_ID_SHAPE = /^[\w.@:-]{1,128}$/;

/** Express-shaped request — keep loose so this isn't NestJS-bound. */
export interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * **TRUST MODEL** (see `docs/lesson-plan-format-design.md` §5.3 + §5.7):
 *
 * `X-Caller-User-Id` is only trustworthy when the network is gated so
 * that only the ccaas proxy can reach port 3007. Anyone else who can
 * connect directly can forge the header and impersonate any user.
 *
 * For production deployments:
 *  - REQUIRED: bind to loopback or a VPC-internal address, OR
 *  - REQUIRED: an upstream reverse proxy that strips client-supplied
 *    `X-Caller-User-Id` and stamps its own from authenticated state.
 *
 * For MVP (single-machine dev), the env fallback is acceptable; flip
 * `LIVE_LESSON_REQUIRE_USER_HEADER=true` once the ccaas → live-lesson
 * proxy injection ships to catch missing-header bugs loudly.
 *
 * Future hardening (out of MVP scope): an HMAC header stamped by the
 * proxy with a shared secret would lift the trust off the network
 * layer entirely. Tracked as Open Question #7 in the design.
 */
export function resolveUserId(req: RequestLike): string {
  const headerValue = req.headers?.['x-caller-user-id'];
  const headerRaw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const header = headerRaw?.trim();
  if (header) {
    // Sanitize to defend against log/query injection if the network
    // trust assumption is violated. Bad-shaped values produce 400
    // rather than silently flowing into row writes.
    if (!USER_ID_SHAPE.test(header)) {
      throw new BadRequestException(
        `X-Caller-User-Id has invalid shape (max ${USER_ID_MAX_LENGTH} chars, [a-zA-Z0-9._@:-])`,
      );
    }
    return header;
  }
  if (process.env.LIVE_LESSON_REQUIRE_USER_HEADER === 'true') {
    throw new UnauthorizedException(
      'X-Caller-User-Id header required (LIVE_LESSON_REQUIRE_USER_HEADER=true).',
    );
  }
  const fallback =
    process.env.LIVE_LESSON_DEFAULT_USER_ID?.trim() || DEFAULT_FALLBACK_USER_ID;
  // Logging at debug rather than warn — under MVP single-user this
  // path is hit on every request, would spam logs at warn level.
  logger.debug(`no X-Caller-User-Id; falling back to "${fallback}"`);
  return fallback;
}
