import { Module, DynamicModule } from '@nestjs/common';
import type { SessionProvider, McpClient, RunStore, HarnessEventEmitter } from '../core/interfaces.js';
import { TaskRegistry } from '../core/task-registry.js';
import { Orchestrator } from '../core/orchestrator.js';
import { OutputSchemaRegistry } from '../core/output-schema-registry.js';
import { InMemoryRunStore } from '../core/in-memory-run-store.js';
import { HarnessController } from './harness.controller.js';
import { HARNESS_MODULE_OPTIONS, HARNESS_RUN_STORE } from './harness.constants.js';

export interface HarnessModuleOptions {
  sessionProvider: SessionProvider;
  mcpClient: McpClient;
  runStore?: RunStore;
  eventEmitter?: HarnessEventEmitter;
}

@Module({})
export class HarnessModule {
  static forRoot(options: HarnessModuleOptions): DynamicModule {
    const registry = new TaskRegistry();
    const outputSchemaRegistry = new OutputSchemaRegistry();
    const runStore = options.runStore ?? new InMemoryRunStore();
    const orchestrator = new Orchestrator(
      options.sessionProvider,
      options.mcpClient,
      runStore,
      registry,
      options.eventEmitter,
    );

    return {
      module: HarnessModule,
      providers: [
        { provide: TaskRegistry, useValue: registry },
        { provide: OutputSchemaRegistry, useValue: outputSchemaRegistry },
        { provide: Orchestrator, useValue: orchestrator },
        { provide: HARNESS_MODULE_OPTIONS, useValue: options },
        { provide: HARNESS_RUN_STORE, useValue: runStore },
      ],
      controllers: [HarnessController],
      exports: [TaskRegistry, Orchestrator, OutputSchemaRegistry, HARNESS_RUN_STORE],
    };
  }
}
