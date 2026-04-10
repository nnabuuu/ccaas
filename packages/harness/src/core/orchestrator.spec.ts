import { Orchestrator } from './orchestrator';
import { TaskRegistry } from './task-registry';
import { InMemoryRunStore } from './in-memory-run-store';
import type { SessionProvider, McpClient, HarnessTask } from './interfaces';

function makeSessionProvider(scores: number[]): SessionProvider {
  let callCount = 0;
  return {
    createSession: jest.fn().mockImplementation(async () => ({
      sessionId: `sess_${callCount++}`,
    })),
    sendMessage: jest.fn().mockResolvedValue(undefined),
    waitForCompletion: jest.fn().mockImplementation(async () => {
      const idx = Math.min(Math.floor(callCount / 2), scores.length - 1);
      const score = scores[idx] ?? 70;
      return {
        text: JSON.stringify({ score, summary: `Iteration result`, changes: 'improved' }),
        tokensUsed: { inputTokens: 100, outputTokens: 50 },
        finishReason: 'completed' as const,
      };
    }),
    getTokenUsage: jest.fn().mockResolvedValue({ inputTokens: 100, outputTokens: 50 }),
  };
}

function makeMcpClient(): McpClient {
  return {
    callTool: jest.fn().mockResolvedValue({ status: 'completed', result: 'ok' }),
  };
}

function makeSimpleTask(): HarnessTask {
  return {
    id: 'test-task',
    name: 'Test Task',
    mode: 'iterative',
    spec: {
      objective: 'Test objective',
      frozenConstraints: [],
      artifactDescription: 'Test artifact',
    },
    agents: [
      { role: 'generator', sessionTemplateId: 'tpl-gen' },
    ],
    pipeline: [
      {
        id: 'gen-step',
        type: 'agent',
        role: 'generator',
        contextSources: [{ type: 'spec' }],
        requiredOutputs: [{ schemaId: 'report', outputKey: 'report' }],
      },
    ],
    exitConditions: { maxIterations: 2 },
    outputSchemas: [
      {
        id: 'report',
        name: 'Report',
        fields: [
          { key: 'score', type: 'number', required: true, description: 'Score' },
          { key: 'summary', type: 'string', required: true, description: 'Summary' },
        ],
      },
    ],
  };
}

describe('Orchestrator', () => {
  it('starts a run and completes after maxIterations', async () => {
    const provider = makeSessionProvider([70, 80]);
    const registry = new TaskRegistry();
    const store = new InMemoryRunStore();
    const task = makeSimpleTask();
    registry.register(task);

    const orchestrator = new Orchestrator(provider, makeMcpClient(), store, registry);
    const run = await orchestrator.startRun('test-task');

    expect(run.id).toBeDefined();
    expect(run.status).toBe('running');
    expect(run.taskId).toBe('test-task');

    // Wait for async loop to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    const completedRun = await store.getRun(run.id);
    expect(completedRun).not.toBeNull();
    expect(completedRun!.status).toBe('completed');
    expect(completedRun!.iterations.length).toBe(2);
    expect(completedRun!.summary).toBeDefined();
    expect(completedRun!.summary!.totalIterations).toBe(2);
  });

  it('throws for unknown task', async () => {
    const registry = new TaskRegistry();
    const store = new InMemoryRunStore();
    const orchestrator = new Orchestrator(
      makeSessionProvider([]),
      makeMcpClient(),
      store,
      registry,
    );

    await expect(orchestrator.startRun('nonexistent')).rejects.toThrow('Task not found');
  });

  it('stops a running run', async () => {
    const provider = makeSessionProvider([60, 65, 70, 75, 80]);
    const registry = new TaskRegistry();
    const store = new InMemoryRunStore();
    const task = { ...makeSimpleTask(), exitConditions: { maxIterations: 10 } };
    registry.register(task);

    const orchestrator = new Orchestrator(provider, makeMcpClient(), store, registry);
    const run = await orchestrator.startRun('test-task');

    // Stop immediately
    await orchestrator.stopRun(run.id);

    const stoppedRun = await store.getRun(run.id);
    expect(stoppedRun!.status).toBe('stopped');
  });
});
