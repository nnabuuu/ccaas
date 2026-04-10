import type {
  RunStore,
  HarnessRun,
  RunFilters,
  IterationRecord,
} from './interfaces.js';

export class InMemoryRunStore implements RunStore {
  private runs = new Map<string, HarnessRun>();
  private stepOutputs = new Map<string, unknown>();
  private artifacts = new Map<string, { iteration: number; data: unknown }[]>();

  async createRun(run: HarnessRun): Promise<HarnessRun> {
    this.runs.set(run.id, { ...run });
    return run;
  }

  async updateRun(
    runId: string,
    updates: Partial<HarnessRun>,
  ): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    Object.assign(run, updates);
  }

  async getRun(runId: string): Promise<HarnessRun | null> {
    return this.runs.get(runId) ?? null;
  }

  async listRuns(filters?: RunFilters): Promise<HarnessRun[]> {
    let runs = Array.from(this.runs.values());
    if (filters?.taskId) {
      runs = runs.filter((r) => r.taskId === filters.taskId);
    }
    if (filters?.status) {
      runs = runs.filter((r) => r.status === filters.status);
    }
    return runs;
  }

  async appendIteration(
    runId: string,
    iteration: IterationRecord,
  ): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    run.iterations.push(iteration);
  }

  async saveStepOutput(
    runId: string,
    iteration: number,
    stepId: string,
    outputKey: string,
    data: unknown,
  ): Promise<void> {
    const key = `${runId}:${iteration}:${stepId}:${outputKey}`;
    this.stepOutputs.set(key, data);
  }

  async getStepOutput(
    runId: string,
    iteration: number,
    stepId: string,
    outputKey: string,
  ): Promise<unknown | null> {
    const key = `${runId}:${iteration}:${stepId}:${outputKey}`;
    return this.stepOutputs.get(key) ?? null;
  }

  async saveArtifact(
    runId: string,
    iteration: number,
    artifact: unknown,
  ): Promise<void> {
    if (!this.artifacts.has(runId)) {
      this.artifacts.set(runId, []);
    }
    this.artifacts.get(runId)!.push({ iteration, data: artifact });
  }

  async getLatestArtifact(runId: string): Promise<unknown | null> {
    const list = this.artifacts.get(runId);
    if (!list || list.length === 0) return null;
    return list[list.length - 1].data;
  }
}
