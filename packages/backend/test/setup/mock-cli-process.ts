/**
 * Mock CLI Process
 *
 * Simulates Claude Code CLI process for integration tests.
 * Allows controlled emission of CLI events to test event handling.
 */

import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';

export interface MockCliProcess {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: {
    write: jest.Mock;
    destroyed: boolean;
  };
  pid: number;
  killed: boolean;
  kill: jest.Mock;
  on: jest.Mock;
  // Helper methods for testing
  emitEvent: (event: object) => void;
  emitEvents: (events: object[]) => void;
  emitStderr: (data: string) => void;
  emitSpawn: () => void;
  emitClose: (code?: number) => void;
  emitError: (error: Error) => void;
}

let processCounter = 10000;

/**
 * Create a mock CLI process that simulates Claude Code CLI behavior
 */
export function createMockCliProcess(): MockCliProcess {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const stdin = {
    write: jest.fn((data: string) => {
      // Can be used to verify messages sent to CLI
      return true;
    }),
    destroyed: false,
  };

  const pid = processCounter++;
  let killed = false;

  const eventHandlers: Map<string, Function[]> = new Map();

  const mockProcess: MockCliProcess = {
    stdout,
    stderr,
    stdin,
    pid,
    killed,
    kill: jest.fn((signal?: string) => {
      killed = true;
      mockProcess.killed = true;
      // Emit close after kill
      setTimeout(() => {
        const handlers = eventHandlers.get('close') || [];
        handlers.forEach(h => h(signal === 'SIGKILL' ? 137 : 143, signal));
      }, 10);
    }),
    on: jest.fn((event: string, handler: Function) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, []);
      }
      eventHandlers.get(event)!.push(handler);
    }),

    // Helper: Emit a single CLI event as JSON line
    emitEvent(event: object) {
      const jsonLine = JSON.stringify(event) + '\n';
      stdout.emit('data', Buffer.from(jsonLine));
    },

    // Helper: Emit multiple CLI events
    emitEvents(events: object[]) {
      for (const event of events) {
        this.emitEvent(event);
      }
    },

    // Helper: Emit stderr data
    emitStderr(data: string) {
      stderr.emit('data', Buffer.from(data));
    },

    // Helper: Emit spawn event
    emitSpawn() {
      const handlers = eventHandlers.get('spawn') || [];
      handlers.forEach(h => h());
    },

    // Helper: Emit close event
    emitClose(code: number = 0) {
      killed = true;
      mockProcess.killed = true;
      stdin.destroyed = true;
      const handlers = eventHandlers.get('close') || [];
      handlers.forEach(h => h(code, null));
    },

    // Helper: Emit error event
    emitError(error: Error) {
      const handlers = eventHandlers.get('error') || [];
      handlers.forEach(h => h(error));
    },
  };

  return mockProcess;
}

/**
 * Create a spawn function that returns mock processes
 */
export function createMockSpawn(): {
  spawn: jest.Mock;
  getProcess: (index?: number) => MockCliProcess | undefined;
  processes: MockCliProcess[];
} {
  const processes: MockCliProcess[] = [];

  const spawn = jest.fn(
    (command: string, args: string[], options: object): ChildProcess => {
      const mockProcess = createMockCliProcess();
      processes.push(mockProcess);
      return mockProcess as unknown as ChildProcess;
    },
  );

  return {
    spawn,
    getProcess: (index: number = 0) => processes[index],
    processes,
  };
}

/**
 * Simulate a complete CLI interaction sequence
 */
export async function simulateCliInteraction(
  mockProcess: MockCliProcess,
  events: object[],
  options: {
    spawnDelay?: number;
    eventDelay?: number;
    exitCode?: number;
  } = {},
): Promise<void> {
  const { spawnDelay = 10, eventDelay = 5, exitCode = 0 } = options;

  // Emit spawn
  await delay(spawnDelay);
  mockProcess.emitSpawn();

  // Emit events with delay
  for (const event of events) {
    await delay(eventDelay);
    mockProcess.emitEvent(event);
  }

  // Emit close
  await delay(eventDelay);
  mockProcess.emitClose(exitCode);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
