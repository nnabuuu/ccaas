import { randomUUID } from 'node:crypto';
import type { Story, LoadedBundle } from '../core/types';
import type { LifecycleEvent } from './instrument';

/**
 * Per-session preview state.
 * Lives in memory only — no DB, no SSE, no multi-user.
 */
export interface PreviewSession {
  sessionId: string;
  bundleFilePath: string;
  storyName: string;
  story: Story;
  ans: Record<string, unknown>;
  gradeHistory: Array<{
    timestamp: number;
    input: { ans: Record<string, unknown> };
    output: unknown;
    durationMs: number;
  }>;
  createdAt: number;
}

export interface PromptTraceEntry {
  callId: string;
  sessionId: string;
  systemPrompt: string;
  userMessage: string;
  response: string;
  durationMs: number;
  timestamp: number;
}

/**
 * Default upper bound on history arrays per session. The preview server is
 * meant for short authoring sessions, but a forgotten tab could otherwise
 * accumulate grade calls indefinitely (one per submit) and slowly leak
 * memory. Each per-session array uses ring-buffer semantics: append, then
 * drop oldest if over the limit.
 *
 * These are visible deliberately — preview deployments running long-lived
 * dev sessions can tune them at construction.
 */
export const DEFAULT_HISTORY_LIMITS = {
  grade: 200,
  prompt: 200,
  lifecycle: 500,
} as const;

export interface HistoryLimits {
  grade: number;
  prompt: number;
  lifecycle: number;
}

/**
 * In-memory session store for the preview server.
 * Replaces SQLite/TypeORM that the real ClassroomService uses.
 */
export class InMemoryState {
  private sessions = new Map<string, PreviewSession>();
  private prompts = new Map<string, PromptTraceEntry[]>(); // sessionId → traces
  private lifecycle = new Map<string, LifecycleEvent[]>(); // sessionId → events
  private bundles = new Map<string, LoadedBundle>(); // bundleId → bundle
  private readonly limits: HistoryLimits;

  constructor(options: { limits?: Partial<HistoryLimits> } = {}) {
    this.limits = { ...DEFAULT_HISTORY_LIMITS, ...options.limits };
  }

  registerBundle(bundle: LoadedBundle): void {
    this.bundles.set(this.bundleId(bundle), bundle);
  }

  getBundle(bundleId: string): LoadedBundle | undefined {
    return this.bundles.get(bundleId);
  }

  listBundles(): LoadedBundle[] {
    return [...this.bundles.values()];
  }

  bundleId(bundle: LoadedBundle): string {
    return bundle.plugin.type;
  }

  createSession(bundle: LoadedBundle, storyName: string): PreviewSession {
    const story = bundle.stories[storyName];
    if (!story) throw new Error(`Story "${storyName}" not found in bundle ${bundle.plugin.type}`);

    const sessionId = randomUUID();
    const session: PreviewSession = {
      sessionId,
      bundleFilePath: bundle.filePath,
      storyName,
      story,
      ans: { ...(story.initialAns ?? {}) },
      gradeHistory: [],
      createdAt: Date.now(),
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): PreviewSession | undefined {
    return this.sessions.get(sessionId);
  }

  recordGrade(
    sessionId: string,
    input: { ans: Record<string, unknown> },
    output: unknown,
    durationMs: number,
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.gradeHistory.push({ timestamp: Date.now(), input, output, durationMs });
    if (session.gradeHistory.length > this.limits.grade) {
      session.gradeHistory.splice(0, session.gradeHistory.length - this.limits.grade);
    }
  }

  resetSession(sessionId: string): PreviewSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    session.ans = { ...(session.story.initialAns ?? {}) };
    session.gradeHistory = [];
    // Drop transient per-plugin state alongside the ans bag so re-running a
    // story doesn't inherit stale plugin UI state from the previous run.
    this.prompts.delete(sessionId);
    this.lifecycle.delete(sessionId);
    return session;
  }

  recordPrompt(entry: PromptTraceEntry): void {
    const arr = this.prompts.get(entry.sessionId) ?? [];
    arr.push(entry);
    if (arr.length > this.limits.prompt) {
      arr.splice(0, arr.length - this.limits.prompt);
    }
    this.prompts.set(entry.sessionId, arr);
  }

  getPromptTrace(sessionId: string): PromptTraceEntry[] {
    return this.prompts.get(sessionId) ?? [];
  }

  /**
   * Lifecycle ring buffer: keeps the most recent `limits.lifecycle` events
   * per session. Bounded so a long-lived preview tab can't OOM the host.
   */
  recordLifecycle(sessionId: string, event: LifecycleEvent): void {
    const arr = this.lifecycle.get(sessionId) ?? [];
    arr.push(event);
    if (arr.length > this.limits.lifecycle) {
      arr.splice(0, arr.length - this.limits.lifecycle);
    }
    this.lifecycle.set(sessionId, arr);
  }

  getLifecycle(sessionId: string): LifecycleEvent[] {
    return this.lifecycle.get(sessionId) ?? [];
  }
}
