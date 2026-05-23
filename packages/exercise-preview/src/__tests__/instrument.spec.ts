import { describe, it, expect } from 'vitest';
import { createTracer, instrumentPlugin } from '../backend/instrument';

describe('instrumentPlugin', () => {
  it('records sync method calls', () => {
    const tracer = createTracer();
    const plugin = {
      type: 'quiz',
      add: (a: number, b: number) => a + b,
      label: 'static',
    };
    const wrapped = instrumentPlugin(plugin as Parameters<typeof instrumentPlugin>[0], tracer);
    expect((wrapped as unknown as { add: (a: number, b: number) => number }).add(2, 3)).toBe(5);
    const events = tracer.events();
    expect(events).toHaveLength(1);
    expect(events[0].method).toBe('add');
    expect(events[0].result).toBe(5);
  });

  it('records async method calls and errors', async () => {
    const tracer = createTracer();
    const plugin = {
      type: 'quiz',
      ok: async () => 'fine',
      bad: async () => {
        throw new Error('oops');
      },
    };
    const wrapped = instrumentPlugin(plugin as Parameters<typeof instrumentPlugin>[0], tracer) as Record<string, () => Promise<unknown>>;
    await wrapped.ok();
    await expect(wrapped.bad()).rejects.toThrow('oops');
    const events = tracer.events();
    expect(events).toHaveLength(2);
    expect(events[0].result).toBe('fine');
    expect(events[1].error).toBeDefined();
    expect(events[1].error?.message).toBe('oops');
  });

  it('countByMethod aggregates correctly', () => {
    const tracer = createTracer();
    const plugin = {
      type: 'quiz',
      a: () => 1,
      b: () => 2,
    };
    const wrapped = instrumentPlugin(plugin as Parameters<typeof instrumentPlugin>[0], tracer) as Record<string, () => number>;
    wrapped.a(); wrapped.a(); wrapped.b();
    expect(tracer.countByMethod()).toEqual({ a: 2, b: 1 });
  });

  it('forwards non-function properties unchanged', () => {
    const tracer = createTracer();
    const plugin = { type: 'quiz', displayName: 'Quiz', version: '1.0' };
    const wrapped = instrumentPlugin(plugin as Parameters<typeof instrumentPlugin>[0], tracer);
    expect(wrapped.type).toBe('quiz');
    expect((wrapped as unknown as { displayName: string }).displayName).toBe('Quiz');
    expect(tracer.events()).toHaveLength(0);
  });

  it('safeClone truncates large args without crashing', () => {
    const tracer = createTracer();
    const plugin = {
      type: 'quiz',
      run: (arg: Record<string, unknown>) => arg,
    };
    const wrapped = instrumentPlugin(plugin as Parameters<typeof instrumentPlugin>[0], tracer) as Record<string, (a: Record<string, unknown>) => unknown>;
    const huge: Record<string, unknown> = {};
    for (let i = 0; i < 100; i++) huge[`k${i}`] = i;
    wrapped.run(huge);
    const snap = tracer.events()[0].argSnapshot[0] as Record<string, unknown>;
    expect(Object.keys(snap).length).toBeLessThanOrEqual(51);
  });
});
