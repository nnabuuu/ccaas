import { Injectable } from '@nestjs/common';
import type { ClassroomStateResponse } from '../schemas/classroom';

@Injectable()
export class StateCacheService {
  private readonly TTL_MS = 2000;
  private cache = new Map<string, { state: ClassroomStateResponse; builtAt: number }>();

  get(sessionId: string): ClassroomStateResponse | null {
    const entry = this.cache.get(sessionId);
    if (!entry) return null;
    if (Date.now() - entry.builtAt > this.TTL_MS) {
      this.cache.delete(sessionId);
      return null;
    }
    return entry.state;
  }

  set(sessionId: string, state: ClassroomStateResponse): void {
    this.cache.set(sessionId, { state, builtAt: Date.now() });
  }

  markDirty(sessionId: string): void {
    this.cache.delete(sessionId);
  }

  /** Alias for markDirty — used on session end/cleanup for semantic clarity. */
  clear(sessionId: string): void {
    this.markDirty(sessionId);
  }
}
