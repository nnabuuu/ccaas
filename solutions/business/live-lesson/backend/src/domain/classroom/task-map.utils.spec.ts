import { buildTaskMap } from './task-map.utils';

describe('buildTaskMap', () => {
  it('maps task-type steps to 1-based task numbers', () => {
    const manifest = {
      readingSteps: [
        { idx: 0, type: 'intro' },
        { idx: 1, type: 'task', answerKey: { type: 'quiz' } },
        { idx: 2, type: 'task', answerKey: { type: 'match' } },
      ],
    };
    const result = buildTaskMap(manifest);
    expect(result.stepToTask).toEqual({ 1: 1, 2: 2 });
    expect(result.taskToStep).toEqual({ 1: 1, 2: 2 });
    expect(result.taskSteps).toEqual([1, 2]);
    expect(result.maxTask).toBe(2);
  });

  it('falls back to answerKey presence when type is missing', () => {
    const manifest = {
      readingSteps: [
        { idx: 0 }, // no type, no answerKey → skip
        { idx: 1, answerKey: { type: 'quiz' } }, // no type but has answerKey → task
        { idx: 2, type: 'reading' }, // non-task type → skip
      ],
    };
    const result = buildTaskMap(manifest);
    expect(result.stepToTask).toEqual({ 1: 1 });
    expect(result.maxTask).toBe(1);
  });

  it('sorts by idx before assigning task numbers', () => {
    const manifest = {
      readingSteps: [
        { idx: 5, type: 'task' },
        { idx: 2, type: 'task' },
        { idx: 8, type: 'task' },
      ],
    };
    const result = buildTaskMap(manifest);
    // sorted: idx 2→task1, idx 5→task2, idx 8→task3
    expect(result.stepToTask).toEqual({ 2: 1, 5: 2, 8: 3 });
    expect(result.taskToStep).toEqual({ 1: 2, 2: 5, 3: 8 });
  });

  it('returns empty maps for null manifest', () => {
    const result = buildTaskMap(null);
    expect(result.stepToTask).toEqual({});
    expect(result.taskToStep).toEqual({});
    expect(result.taskSteps).toEqual([]);
    expect(result.maxTask).toBe(0);
  });

  it('returns empty maps for manifest with no readingSteps', () => {
    const result = buildTaskMap({});
    expect(result.maxTask).toBe(0);
  });

  it('returns empty maps when no steps qualify as tasks', () => {
    const manifest = {
      readingSteps: [
        { idx: 0, type: 'intro' },
        { idx: 1, type: 'reading' },
      ],
    };
    const result = buildTaskMap(manifest);
    expect(result.maxTask).toBe(0);
  });

  it('does not include steps with type but no answerKey as tasks (only type=task counts)', () => {
    const manifest = {
      readingSteps: [
        { idx: 0, type: 'reading', answerKey: { type: 'quiz' } },
      ],
    };
    const result = buildTaskMap(manifest);
    // type is 'reading', not 'task', and type IS defined so fallback doesn't apply
    expect(result.maxTask).toBe(0);
  });
});
