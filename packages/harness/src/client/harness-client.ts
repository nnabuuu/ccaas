import type {
  HarnessTask,
  HarnessRun,
  RunTrigger,
  RunProgress,
  IterationRecord,
} from '../core/interfaces.js';

export class HarnessClient {
  private baseUrl: string;
  private authProvider?: () => string;

  constructor(baseUrl: string, authProvider?: () => string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.authProvider = authProvider;
  }

  // ─── Task CRUD ───

  async registerTask(task: HarnessTask): Promise<HarnessTask> {
    return this.post<HarnessTask>('/harness/tasks', task);
  }

  async listTasks(): Promise<HarnessTask[]> {
    return this.get<HarnessTask[]>('/harness/tasks');
  }

  async getTask(taskId: string): Promise<HarnessTask> {
    return this.get<HarnessTask>(`/harness/tasks/${taskId}`);
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.del(`/harness/tasks/${taskId}`);
  }

  // ─── Run lifecycle ───

  async startRun(params: {
    taskId: string;
    trigger?: RunTrigger;
  }): Promise<HarnessRun> {
    return this.post<HarnessRun>('/harness/runs', params);
  }

  async getRun(runId: string): Promise<HarnessRun> {
    return this.get<HarnessRun>(`/harness/runs/${runId}`);
  }

  async getProgress(runId: string): Promise<RunProgress> {
    return this.get<RunProgress>(`/harness/runs/${runId}/progress`);
  }

  async stopRun(runId: string): Promise<void> {
    await this.post<void>(`/harness/runs/${runId}/stop`, {});
  }

  async resumeRun(runId: string): Promise<void> {
    await this.post<void>(`/harness/runs/${runId}/resume`, {});
  }

  // ─── Iterations ───

  async getIteration(
    runId: string,
    n: number,
  ): Promise<IterationRecord> {
    return this.get<IterationRecord>(
      `/harness/runs/${runId}/iterations/${n}`,
    );
  }

  async getIterationOutputs(
    runId: string,
    n: number,
  ): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>(
      `/harness/runs/${runId}/iterations/${n}/outputs`,
    );
  }

  // ─── HTTP helpers ───

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  private async del(path: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new Error(`DELETE ${path} failed: ${res.status} ${res.statusText}`);
    }
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers(),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`POST ${path} failed: ${res.status} ${res.statusText}`);
    }
    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {};
    if (this.authProvider) {
      h['Authorization'] = `Bearer ${this.authProvider()}`;
    }
    return h;
  }
}
