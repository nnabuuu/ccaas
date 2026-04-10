import { Injectable, OnModuleInit } from '@nestjs/common';
import { TaskRegistry } from '@kedge-agentic/harness';
import { getArticleTask } from './article-task';

@Injectable()
export class HarnessSetupService implements OnModuleInit {
  constructor(private readonly taskRegistry: TaskRegistry) {}

  onModuleInit(): void {
    const task = getArticleTask();
    this.taskRegistry.register(task);
    console.log(
      `[ArticleAnalyzer] Registered task: ${task.id}`,
    );
  }
}
