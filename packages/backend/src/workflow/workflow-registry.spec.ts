/**
 * Registry contract tests — index correctness + duplicate-name policy
 * + priority sort.
 */

import { WorkflowRegistry } from './workflow-registry';
import type { TriggerDef } from './types';

function eventTrigger(
  apiName: string,
  stream: string,
  priority?: number,
): TriggerDef {
  return {
    apiName,
    manifest: 'LessonSession',
    semantic: 'fixture',
    kind: 'event',
    watch: { stream },
    priority,
    then: { action: 'noop', args: () => ({}) },
  };
}

function stateTrigger(apiName: string, state: string): TriggerDef {
  return {
    apiName,
    manifest: 'LessonSession',
    semantic: 'fixture',
    kind: 'state-change',
    watch: { state },
    then: { action: 'noop', args: () => ({}) },
  };
}

describe('WorkflowRegistry', () => {
  it('registers + retrieves by apiName', () => {
    const r = new WorkflowRegistry();
    const t = eventTrigger('t1', 'events');
    r.register(t);
    expect(r.getByName('t1')).toBe(t);
    expect(r.getByName('does_not_exist')).toBeUndefined();
  });

  it('throws on duplicate apiName (no shadowing)', () => {
    const r = new WorkflowRegistry();
    r.register(eventTrigger('t1', 'events'));
    expect(() => r.register(eventTrigger('t1', 'other'))).toThrow(
      /already registered/,
    );
  });

  it('lookup indexes by (manifest, kind, watchKey)', () => {
    const r = new WorkflowRegistry();
    const a = eventTrigger('a', 'events');
    const b = eventTrigger('b', 'events');
    const c = eventTrigger('c', 'other_stream');
    const d = stateTrigger('d', 'phase');
    r.register(a);
    r.register(b);
    r.register(c);
    r.register(d);

    const events = r.lookup('LessonSession', {
      kind: 'event',
      stream: 'events',
    });
    expect(new Set(events.map((t) => t.apiName))).toEqual(new Set(['a', 'b']));

    const other = r.lookup('LessonSession', {
      kind: 'event',
      stream: 'other_stream',
    });
    expect(other.map((t) => t.apiName)).toEqual(['c']);

    const phase = r.lookup('LessonSession', {
      kind: 'state-change',
      state: 'phase',
    });
    expect(phase.map((t) => t.apiName)).toEqual(['d']);
  });

  it('lookup sorts by priority (lower first), then registration order', () => {
    const r = new WorkflowRegistry();
    r.register(eventTrigger('mid', 'events', 5));
    r.register(eventTrigger('low_first', 'events', 1));
    r.register(eventTrigger('mid_second', 'events', 5));
    r.register(eventTrigger('no_priority', 'events'));

    const order = r
      .lookup('LessonSession', { kind: 'event', stream: 'events' })
      .map((t) => t.apiName);
    // priority undefined defaults to 0 (first), then 1, then 5/5 in registration order
    expect(order).toEqual(['no_priority', 'low_first', 'mid', 'mid_second']);
  });

  it('lookup returns empty array when nothing matches (no throw)', () => {
    const r = new WorkflowRegistry();
    expect(
      r.lookup('LessonSession', { kind: 'event', stream: 'nope' }),
    ).toEqual([]);
  });

  it('all() returns every registered trigger', () => {
    const r = new WorkflowRegistry();
    r.register(eventTrigger('a', 'events'));
    r.register(stateTrigger('b', 'phase'));
    expect(r.all().map((t) => t.apiName).sort()).toEqual(['a', 'b']);
  });

  it('reset() clears both indexes', () => {
    const r = new WorkflowRegistry();
    r.register(eventTrigger('a', 'events'));
    r.reset();
    expect(r.getByName('a')).toBeUndefined();
    expect(
      r.lookup('LessonSession', { kind: 'event', stream: 'events' }),
    ).toEqual([]);
  });
});
