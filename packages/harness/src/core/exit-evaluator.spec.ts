import { shouldExit } from './exit-evaluator';
import type { HarnessRun, ExitConditions } from './interfaces';

function makeRun(scores: (number | null)[]): HarnessRun {
  return {
    id: 'run_1',
    taskId: 'task_1',
    status: 'running',
    trigger: {},
    iterations: scores.map((score, i) => ({
      iteration: i + 1,
      status: 'completed' as const,
      steps: [],
      score: score ?? undefined,
      keyChanges: '',
      topIssue: '',
      timestamp: new Date().toISOString(),
    })),
    totalTokens: 0,
    totalCostEstimate: 0,
    startedAt: new Date().toISOString(),
  };
}

describe('shouldExit', () => {
  describe('maxIterations', () => {
    it('exits when iteration count reaches max', () => {
      const run = makeRun([60, 70, 80]);
      const result = shouldExit(run, { maxIterations: 3 });
      expect(result.exit).toBe(true);
      expect(result.reason).toContain('max iterations');
    });

    it('does not exit when below max', () => {
      const run = makeRun([60, 70]);
      const result = shouldExit(run, { maxIterations: 5 });
      expect(result.exit).toBe(false);
    });
  });

  describe('scoreThreshold', () => {
    it('exits when score meets threshold', () => {
      const run = makeRun([60, 85]);
      const conditions: ExitConditions = { maxIterations: 10, scoreThreshold: 85 };
      const result = shouldExit(run, conditions);
      expect(result.exit).toBe(true);
      expect(result.reason).toContain('threshold');
    });

    it('exits when score exceeds threshold', () => {
      const run = makeRun([60, 90]);
      const conditions: ExitConditions = { maxIterations: 10, scoreThreshold: 85 };
      const result = shouldExit(run, conditions);
      expect(result.exit).toBe(true);
    });

    it('does not exit when score below threshold', () => {
      const run = makeRun([60, 70]);
      const conditions: ExitConditions = { maxIterations: 10, scoreThreshold: 85 };
      const result = shouldExit(run, conditions);
      expect(result.exit).toBe(false);
    });
  });

  describe('minImprovement', () => {
    it('does not exit with only 1 scored iteration', () => {
      const run = makeRun([60]);
      const conditions: ExitConditions = { maxIterations: 10, minImprovement: 3 };
      const result = shouldExit(run, conditions);
      expect(result.exit).toBe(false);
    });

    it('does not exit with only 2 scored iterations (needs 2 consecutive low rounds)', () => {
      const run = makeRun([60, 61]);
      const conditions: ExitConditions = { maxIterations: 10, minImprovement: 3 };
      const result = shouldExit(run, conditions);
      expect(result.exit).toBe(false);
    });

    it('exits with 3 scored iterations and 2 consecutive low improvements', () => {
      const run = makeRun([60, 61, 62]);
      const conditions: ExitConditions = { maxIterations: 10, minImprovement: 3 };
      const result = shouldExit(run, conditions);
      expect(result.exit).toBe(true);
      expect(result.reason).toContain('2 consecutive');
    });

    it('does not exit if only the latest improvement is low', () => {
      const run = makeRun([60, 70, 71]);
      const conditions: ExitConditions = { maxIterations: 10, minImprovement: 3 };
      const result = shouldExit(run, conditions);
      expect(result.exit).toBe(false);
    });

    it('does not exit if only the earlier improvement is low', () => {
      const run = makeRun([60, 61, 70]);
      const conditions: ExitConditions = { maxIterations: 10, minImprovement: 3 };
      const result = shouldExit(run, conditions);
      expect(result.exit).toBe(false);
    });
  });

  describe('no scored iterations', () => {
    it('does not exit when no iterations have scores', () => {
      const run = makeRun([null, null]);
      const conditions: ExitConditions = { maxIterations: 10, scoreThreshold: 85 };
      const result = shouldExit(run, conditions);
      expect(result.exit).toBe(false);
    });
  });
});
