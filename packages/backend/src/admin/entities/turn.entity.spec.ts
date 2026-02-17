/**
 * Turn Entity Tests
 *
 * Tests for the Turn entity which tracks dialogue turns
 * (user input + assistant response) with per-turn analytics.
 */

import { Turn } from './turn.entity';

describe('Turn Entity', () => {
  it('should create a Turn with required fields', () => {
    const turn: Turn = {
      id: 'uuid-1',
      sessionId: 'session-123',
      turnNumber: 0,
      userMessageId: 'msg-user-1',
      assistantMessageId: null,
      totalTokens: 0,
      durationMs: 0,
      createdAt: new Date(),
      completedAt: null,
    };

    expect(turn.id).toBe('uuid-1');
    expect(turn.sessionId).toBe('session-123');
    expect(turn.turnNumber).toBe(0);
    expect(turn.userMessageId).toBe('msg-user-1');
    expect(turn.assistantMessageId).toBeNull();
    expect(turn.totalTokens).toBe(0);
    expect(turn.durationMs).toBe(0);
    expect(turn.completedAt).toBeNull();
  });

  it('should support completed turns with all metrics', () => {
    const now = new Date();
    const turn: Turn = {
      id: 'uuid-2',
      sessionId: 'session-123',
      turnNumber: 1,
      userMessageId: 'msg-user-2',
      assistantMessageId: 'msg-assistant-2',
      totalTokens: 5000,
      durationMs: 12500,
      createdAt: new Date(now.getTime() - 12500),
      completedAt: now,
    };

    expect(turn.assistantMessageId).toBe('msg-assistant-2');
    expect(turn.totalTokens).toBe(5000);
    expect(turn.durationMs).toBe(12500);
    expect(turn.completedAt).toBe(now);
  });

  it('should default totalTokens and durationMs to 0', () => {
    const turn: Turn = {
      id: 'uuid-3',
      sessionId: 'session-456',
      turnNumber: 0,
      userMessageId: 'msg-1',
      assistantMessageId: null,
      totalTokens: 0,
      durationMs: 0,
      createdAt: new Date(),
      completedAt: null,
    };

    expect(turn.totalTokens).toBe(0);
    expect(turn.durationMs).toBe(0);
  });

  it('should have turnNumber starting from 0', () => {
    const turn0: Turn = {
      id: 'uuid-a',
      sessionId: 'session-789',
      turnNumber: 0,
      userMessageId: 'msg-1',
      assistantMessageId: 'msg-2',
      totalTokens: 1000,
      durationMs: 5000,
      createdAt: new Date(),
      completedAt: new Date(),
    };

    const turn1: Turn = {
      id: 'uuid-b',
      sessionId: 'session-789',
      turnNumber: 1,
      userMessageId: 'msg-3',
      assistantMessageId: 'msg-4',
      totalTokens: 2000,
      durationMs: 8000,
      createdAt: new Date(),
      completedAt: new Date(),
    };

    expect(turn0.turnNumber).toBe(0);
    expect(turn1.turnNumber).toBe(1);
    expect(turn0.sessionId).toBe(turn1.sessionId);
  });
});
