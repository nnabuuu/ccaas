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
 * In-memory session store for the preview server.
 * Replaces SQLite/TypeORM that the real ClassroomService uses.
 */
export class InMemoryState {
  private sessions = new Map<string, PreviewSession>();
  private prompts = new Map<string, PromptTraceEntry[]>(); // sessionId → traces
  private lifecycle = new Map<string, LifecycleEvent[]>(); // sessionId → events
  private bundles = new Map<string, LoadedBundle>(); // bundleId → bundle

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
  }

  resetSession(sessionId: string): PreviewSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    session.ans = { ...(session.story.initialAns ?? {}) };
    session.gradeHistory = [];
    this.prompts.delete(sessionId);
    return session;
  }

  recordPrompt(entry: PromptTraceEntry): void {
    const arr = this.prompts.get(entry.sessionId) ?? [];
    arr.push(entry);
    this.prompts.set(entry.sessionId, arr);
  }

  getPromptTrace(sessionId: string): PromptTraceEntry[] {
    return this.prompts.get(sessionId) ?? [];
  }

  recordLifecycle(sessionId: string, event: LifecycleEvent): void {
    const arr = this.lifecycle.get(sessionId) ?? [];
    arr.push(event);
    this.lifecycle.set(sessionId, arr);
  }

  getLifecycle(sessionId: string): LifecycleEvent[] {
    return this.lifecycle.get(sessionId) ?? [];
  }
}
