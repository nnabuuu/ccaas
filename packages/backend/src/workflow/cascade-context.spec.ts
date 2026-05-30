/**
 * Cascade-context tests — AsyncLocalStorage propagation across awaits +
 * depth increment + correlationId stability.
 */

import {
  currentCascade,
  withChildCascade,
  withRootCascade,
} from './cascade-context';

describe('cascade-context', () => {
  it('currentCascade outside any frame returns a fresh depth=0 with new UUID', () => {
    const a = currentCascade();
    const b = currentCascade();
    expect(a.depth).toBe(0);
    expect(b.depth).toBe(0);
    // Each fresh frame has its own UUID (we don't share state outside ALS scopes).
    expect(a.correlationId).not.toBe(b.correlationId);
  });

  it('withRootCascade sets a depth=0 frame with a stable UUID inside fn', async () => {
    await withRootCascade('events', async () => {
      const f1 = currentCascade();
      const f2 = currentCascade();
      expect(f1.depth).toBe(0);
      expect(f1.correlationId).toBe(f2.correlationId);
      expect(f1.originStream).toBe('events');
    });
  });

  it('withChildCascade increments depth + preserves correlationId', async () => {
    await withRootCascade('events', async () => {
      const root = currentCascade();
      await withChildCascade(undefined, async () => {
        const child = currentCascade();
        expect(child.depth).toBe(root.depth + 1);
        expect(child.correlationId).toBe(root.correlationId);
        expect(child.originStream).toBe('events'); // inherited
      });
    });
  });

  it('withChildCascade can override originStream when given one', async () => {
    await withRootCascade('events', async () => {
      await withChildCascade('student_observation_changed', async () => {
        expect(currentCascade().originStream).toBe(
          'student_observation_changed',
        );
      });
    });
  });

  it('depth resets to root after withChildCascade returns', async () => {
    await withRootCascade('events', async () => {
      expect(currentCascade().depth).toBe(0);
      await withChildCascade(undefined, async () => {
        expect(currentCascade().depth).toBe(1);
      });
      expect(currentCascade().depth).toBe(0);
    });
  });

  it('survives async boundaries (await + setTimeout)', async () => {
    let captured: number | null = null;
    await withRootCascade('events', async () => {
      await withChildCascade(undefined, async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 5));
        captured = currentCascade().depth;
      });
    });
    expect(captured).toBe(1);
  });

  it('two concurrent root cascades have distinct correlation IDs', async () => {
    const ids: string[] = [];
    await Promise.all([
      withRootCascade(undefined, async () => {
        ids.push(currentCascade().correlationId);
      }),
      withRootCascade(undefined, async () => {
        ids.push(currentCascade().correlationId);
      }),
    ]);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
