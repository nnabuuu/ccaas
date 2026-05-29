/**
 * Type-shape tests for `StreamDef`.
 *
 * Most of StreamDef's contract (payload-exclusivity, payloadType
 * resolution) is enforced by the registry validator (commit 6).
 * These tests confirm the interface shape itself accepts both payload
 * variants and the backpressure enum.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { StreamDef } from '../stream.js';

describe('StreamDef', () => {
  it('accepts payloadType (ObjectType reference variant)', () => {
    const stream: StreamDef = {
      apiName: 'events',
      displayName: '课堂事件流',
      payloadType: 'ClassroomEvent',
      backpressure: 'drop_oldest',
      semantic: 'Push stream of ClassroomEvent...',
    };
    expect(stream.payloadType).toBe('ClassroomEvent');
    expect(stream.payloadSchema).toBeUndefined();
  });

  it('accepts payloadSchema (inline Zod variant)', () => {
    const stream: StreamDef = {
      apiName: 'progressTicks',
      displayName: '进度心跳',
      payloadSchema: z.object({ percent: z.number().min(0).max(100) }),
      semantic: 'Ephemeral progress ticks; not persisted as objects.',
    };
    expect(stream.payloadType).toBeUndefined();
    expect(stream.payloadSchema).toBeDefined();
  });

  it('accepts all three backpressure variants', () => {
    const variants: StreamDef['backpressure'][] = [
      'drop_oldest',
      'block_producer',
      'unbounded',
      undefined,
    ];
    expect(variants).toHaveLength(4);
  });

  // Note: payload exclusivity (must set exactly one of payloadType /
  // payloadSchema) is enforced at registration by the validator, not
  // by the type. A StreamDef literal that sets both — or neither —
  // type-checks today; the validator rejects it at registerManifest()
  // time. Covered by validators.test.ts in commit 6.
});
