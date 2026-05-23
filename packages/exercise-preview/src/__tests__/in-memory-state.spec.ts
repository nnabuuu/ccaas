import { describe, it, expect } from 'vitest';
import { InMemoryState } from '../backend/in-memory-state';
import { defineStories } from '../core/define-stories';
import { extractBundleFromModule } from '../core/story-loader';
import type { Story } from '../core/types';

function makeBundle() {
  const defaultExport = defineStories({
    plugin: { type: 'quiz', displayName: 'Quiz' },
    meta: { title: 'Test Bundle' },
  });
  const Default: Story = {
    name: 'Default',
    answerKey: { type: 'quiz', answers: [] },
    initialAns: { answers: [0] },
  };
  return extractBundleFromModule('/fake/quiz.stories.ts', { default: defaultExport, Default });
}

describe('InMemoryState', () => {
  it('registers and lists bundles', () => {
    const state = new InMemoryState();
    state.registerBundle(makeBundle());
    expect(state.listBundles()).toHaveLength(1);
    expect(state.getBundle('quiz')).toBeDefined();
  });

  it('createSession seeds ans from story.initialAns', () => {
    const state = new InMemoryState();
    const bundle = makeBundle();
    state.registerBundle(bundle);
    const session = state.createSession(bundle, 'Default');
    expect(session.sessionId).toBeTruthy();
    expect(session.ans).toEqual({ answers: [0] });
  });

  it('createSession throws on unknown story name', () => {
    const state = new InMemoryState();
    const bundle = makeBundle();
    state.registerBundle(bundle);
    expect(() => state.createSession(bundle, 'Missing')).toThrow(/Missing.*not found/);
  });

  it('recordGrade appends to history', () => {
    const state = new InMemoryState();
    const bundle = makeBundle();
    state.registerBundle(bundle);
    const session = state.createSession(bundle, 'Default');
    state.recordGrade(session.sessionId, { ans: { answers: [1] } }, { total: 100 }, 42);
    state.recordGrade(session.sessionId, { ans: { answers: [0] } }, { total: 0 }, 38);
    const reloaded = state.getSession(session.sessionId);
    expect(reloaded?.gradeHistory).toHaveLength(2);
    expect(reloaded?.gradeHistory[1].durationMs).toBe(38);
  });

  it('resetSession restores ans + clears history', () => {
    const state = new InMemoryState();
    const bundle = makeBundle();
    state.registerBundle(bundle);
    const session = state.createSession(bundle, 'Default');
    session.ans = { answers: [1, 1, 1] };
    state.recordGrade(session.sessionId, { ans: {} }, {}, 10);
    state.resetSession(session.sessionId);
    const after = state.getSession(session.sessionId);
    expect(after?.ans).toEqual({ answers: [0] });
    expect(after?.gradeHistory).toHaveLength(0);
  });

  it('prompt trace is per-session', () => {
    const state = new InMemoryState();
    const bundle = makeBundle();
    state.registerBundle(bundle);
    const a = state.createSession(bundle, 'Default');
    const b = state.createSession(bundle, 'Default');
    state.recordPrompt({
      callId: 'c1',
      sessionId: a.sessionId,
      systemPrompt: 'sys',
      userMessage: 'usr',
      response: 'resp',
      durationMs: 5,
      timestamp: Date.now(),
    });
    expect(state.getPromptTrace(a.sessionId)).toHaveLength(1);
    expect(state.getPromptTrace(b.sessionId)).toHaveLength(0);
  });
});
