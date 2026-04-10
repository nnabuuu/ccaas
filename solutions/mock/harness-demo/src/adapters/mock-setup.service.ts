import { Injectable, OnModuleInit } from '@nestjs/common';
import { TaskRegistry } from '@kedge-agentic/harness';
import { getDemoTasks } from '../seed/demo-tasks';

@Injectable()
export class MockSetupService implements OnModuleInit {
  constructor(private readonly taskRegistry: TaskRegistry) {}

  onModuleInit(): void {
    const tasks = getDemoTasks();
    for (const task of tasks) {
      this.taskRegistry.register(task);
    }
    console.log(`[HarnessDemo] Registered ${tasks.length} demo tasks`);
  }
}
