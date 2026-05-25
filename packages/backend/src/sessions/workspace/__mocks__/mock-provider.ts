/**
 * Shared mock for tests that build a SessionService TestingModule.
 * Returns a `useValue` provider that no-ops everything but yields a
 * deterministic `/tmp/test/{sessionId}` path on `create()`.
 */

import { WORKSPACE_PROVIDER } from '../types';

export function mockWorkspaceProvider() {
  return {
    provide: WORKSPACE_PROVIDER,
    useValue: {
      create: jest.fn(async ({ sessionId }: { sessionId: string }) => ({
        sessionId,
        path: `/tmp/test/${sessionId}`,
      })),
      close: jest.fn(async () => {}),
      destroy: jest.fn(async () => {}),
      capabilities: () => ({ snapshot: false, multiMount: false, fastClone: false }),
    },
  };
}
