import { TaskRegistry } from './task-registry';
import type { HarnessTask } from './interfaces';

function makeTask(id: string): HarnessTask {
  return {
    id,
    name: `Task ${id}`,
    mode: 'iterative',
    spec: {
      objective: 'Test objective',
      frozenConstraints: [],
      artifactDescription: 'Test artifact',
    },
    agents: [{ role: 'generator', sessionTemplateId: 'tpl-1' }],
    pipeline: [],
    exitConditions: { maxIterations: 5 },
    outputSchemas: [],
  };
}

describe('TaskRegistry', () => {
  let registry: TaskRegistry;

  beforeEach(() => {
    registry = new TaskRegistry();
  });

  it('registers and retrieves a task', () => {
    const task = makeTask('t1');
    registry.register(task);
    expect(registry.get('t1')).toEqual(task);
  });

  it('returns undefined for non-existent task', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('lists all registered tasks', () => {
    registry.register(makeTask('t1'));
    registry.register(makeTask('t2'));
    const tasks = registry.list();
    expect(tasks).toHaveLength(2);
    expect(tasks.map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('removes a task', () => {
    registry.register(makeTask('t1'));
    expect(registry.remove('t1')).toBe(true);
    expect(registry.get('t1')).toBeUndefined();
  });

  it('returns false when removing non-existent task', () => {
    expect(registry.remove('nonexistent')).toBe(false);
  });

  it('overwrites task with same id', () => {
    registry.register(makeTask('t1'));
    const updated = { ...makeTask('t1'), name: 'Updated' };
    registry.register(updated);
    expect(registry.get('t1')?.name).toBe('Updated');
    expect(registry.list()).toHaveLength(1);
  });
});
