/**
 * Preview Backend — NestJS module (P1).
 *
 * Optional NestJS surface for the preview platform: hosts the same in-memory
 * state, instrumentation, short-codes, and rate limiter as the standalone
 * http server, but as injectable providers that can be composed with the
 * live-lesson backend's real ExerciseTypeRegistry + GradingService via
 * regular NestJS DI.
 *
 * The factory functions are typed liberally (any) to avoid requiring the
 * @nestjs/common package at type-check time for callers who only use the
 * http server. NestJS users should import these alongside their own
 * @nestjs decorators.
 *
 * Example:
 * ```ts
 * import { createPreviewBackendProviders } from '@kedge-agentic/exercise-preview';
 * import { Module } from '@nestjs/common';
 *
 * @Module({
 *   providers: [
 *     ...createPreviewBackendProviders(),
 *   ],
 * })
 * class MyAppModule {}
 * ```
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { InMemoryState } from '../backend/in-memory-state';
import { createTracer, instrumentPlugin, type Tracer } from '../backend/instrument';
import { runGrade } from '../backend/grade-runner';
import { MemoryShortCodesStore, type ShortCodesStore } from '../backend/shortcodes-store';
import { createRateLimiter, type RateLimiter } from '../backend/rate-limiter';
import type { LoadedBundle } from '../core/types';

/** Tokens for NestJS DI (string-based so no @nestjs/common dependency here) */
export const PREVIEW_STATE = 'PREVIEW_STATE';
export const PREVIEW_TRACER = 'PREVIEW_TRACER';
export const PREVIEW_SHORTCODES = 'PREVIEW_SHORTCODES';
export const PREVIEW_RATE_LIMIT = 'PREVIEW_RATE_LIMIT';
export const PREVIEW_BUNDLES = 'PREVIEW_BUNDLES';

export interface PreviewBackendConfig {
  /** Initial bundles to register */
  bundles?: LoadedBundle[];
  /** Custom short-codes store (defaults to in-memory) */
  shortCodes?: ShortCodesStore;
  /** Rate limiter config (max + windowMs) */
  rateLimit?: { max: number; windowMs: number };
}

/**
 * Build NestJS-compatible provider definitions for the preview backend.
 *
 * Returns an array of `{ provide, useValue }` records that can be spread
 * into a NestJS @Module's providers array.
 */
export function createPreviewBackendProviders(
  config: PreviewBackendConfig = {},
): Array<{ provide: string; useValue: any }> {
  const state = new InMemoryState();
  for (const b of config.bundles ?? []) state.registerBundle(b);

  const tracer = createTracer();
  const shortCodes = config.shortCodes ?? new MemoryShortCodesStore();
  const rateLimit = createRateLimiter(
    config.rateLimit ?? { max: 60, windowMs: 60_000 },
  );

  return [
    { provide: PREVIEW_STATE, useValue: state },
    { provide: PREVIEW_TRACER, useValue: tracer },
    { provide: PREVIEW_SHORTCODES, useValue: shortCodes },
    { provide: PREVIEW_RATE_LIMIT, useValue: rateLimit },
    { provide: PREVIEW_BUNDLES, useValue: config.bundles ?? [] },
  ];
}

/**
 * Service-style helper for use inside NestJS controllers.
 *
 * Encapsulates the same operations as the standalone http server (createSession,
 * grade, inspector) but as plain methods so they can be wrapped by any HTTP
 * framework or used directly from background jobs.
 */
export class PreviewBackendService {
  constructor(
    private readonly state: InMemoryState,
    private readonly tracer: Tracer,
    private readonly bundles: LoadedBundle[],
    public readonly shortCodes: ShortCodesStore,
    public readonly rateLimit: RateLimiter,
  ) {
    for (const b of bundles) state.registerBundle(b);
  }

  listBundles() {
    return this.state.listBundles();
  }

  createSession(bundleId: string, storyName: string) {
    const bundle = this.state.getBundle(bundleId);
    if (!bundle) throw new Error(`Bundle "${bundleId}" not registered`);
    return this.state.createSession(bundle, storyName);
  }

  /** Run grade with the instrumented plugin wrapper so lifecycle events are captured. */
  async grade(sessionId: string, ans: Record<string, unknown>) {
    const session = this.state.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    const bundle = this.state.getBundle(session.story.answerKey.type as string);
    if (!bundle) throw new Error('Bundle missing for session');

    const localTracer = createTracer();
    const instrumented = instrumentPlugin(
      bundle.plugin as any,
      localTracer,
    );
    const instrumentedBundle: LoadedBundle = { ...bundle, plugin: instrumented };
    const result = await runGrade(instrumentedBundle, session.story, ans);
    this.state.recordGrade(sessionId, { ans }, result, result.durationMs);
    for (const ev of localTracer.events()) this.state.recordLifecycle(sessionId, ev);
    return result;
  }

  getInspector(sessionId: string) {
    const session = this.state.getSession(sessionId);
    if (!session) return null;
    return {
      sessionId,
      gradeHistory: session.gradeHistory,
      prompts: this.state.getPromptTrace(sessionId),
      lifecycle: this.state.getLifecycle(sessionId),
    };
  }

  /** Rate-limit a request by key (IP or user). Throws when over limit. */
  checkRateLimit(key: string): void {
    if (!this.rateLimit.hit(key)) throw new Error(`rate limit exceeded for ${key}`);
  }
}

/** Factory that builds a PreviewBackendService from providers (manual wiring). */
export function buildPreviewBackendService(
  providers: ReturnType<typeof createPreviewBackendProviders>,
): PreviewBackendService {
  const lookup = (token: string) =>
    providers.find((p) => p.provide === token)?.useValue;
  return new PreviewBackendService(
    lookup(PREVIEW_STATE) as InMemoryState,
    lookup(PREVIEW_TRACER) as Tracer,
    (lookup(PREVIEW_BUNDLES) as LoadedBundle[]) ?? [],
    lookup(PREVIEW_SHORTCODES) as ShortCodesStore,
    lookup(PREVIEW_RATE_LIMIT) as RateLimiter,
  );
}
