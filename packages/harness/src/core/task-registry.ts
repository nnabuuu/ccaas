import type { HarnessTask } from './interfaces.js';

export class TaskRegistry {
  private tasks = new Map<string, HarnessTask>();

  register(task: HarnessTask): void {
    this.tasks.set(task.id, task);
  }

  get(id: string): HarnessTask | undefined {
    return this.tasks.get(id);
  }

  list(): HarnessTask[] {
    return Array.from(this.tasks.values());
  }

  remove(id: string): boolean {
    return this.tasks.delete(id);
  }
}
