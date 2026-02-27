import type Database from 'better-sqlite3';
import type { LessonManifest, BoardState, Beat, BeatState, ChalkboardAction, GlobalBoardOp } from './types.js';
import { loadLessonManifest, saveSessionState, loadSessionState, type SavedState } from './db.js';

class StateManager {
  private db: Database.Database;
  private sessionId: string;

  private manifest: LessonManifest | null = null;
  private boardState: BoardState | null = null;
  private beatState: BeatState | null = null;
  private dynamicBoardActions: ChalkboardAction[] = [];
  private lastDynamicBeatId: string | null = null;
  private globalBoardOps: GlobalBoardOp[] = [];

  constructor(db: Database.Database, sessionId: string) {
    this.db = db;
    this.sessionId = sessionId;
  }

  /**
   * Persist all mutable state to SQLite.
   * Called after every mutation method.
   */
  private persistState(): void {
    if (!this.boardState) return; // nothing to persist until lesson is loaded
    const state: SavedState = {
      sessionId: this.sessionId,
      lessonId: this.boardState.lessonId,
      boardState: this.boardState,
      beatState: this.beatState,
      dynamicActions: this.dynamicBoardActions,
      lastDynamicBeatId: this.lastDynamicBeatId,
      globalOps: this.globalBoardOps,
    };
    saveSessionState(this.db, this.sessionId, state);
  }

  /**
   * Restore session state from SQLite.
   * Returns { restored, lessonId } so callers know if a session was recovered.
   */
  restoreSession(): { restored: boolean; lessonId: string | null } {
    const saved = loadSessionState(this.db, this.sessionId);
    if (!saved) return { restored: false, lessonId: null };

    // Reload the manifest from DB
    try {
      this.manifest = loadLessonManifest(this.db, saved.lessonId);
    } catch {
      return { restored: false, lessonId: null };
    }

    this.boardState = saved.boardState;
    this.beatState = saved.beatState;
    this.dynamicBoardActions = saved.dynamicActions;
    this.lastDynamicBeatId = saved.lastDynamicBeatId;
    this.globalBoardOps = saved.globalOps;

    return { restored: true, lessonId: saved.lessonId };
  }

  /**
   * Load lesson manifest from SQLite.
   * If the session was already restored with the same lessonId, returns current state
   * without re-initializing (preserving progress).
   */
  loadLesson(lessonId: string): BoardState {
    // If already loaded with same lesson (from restore), skip re-init
    if (this.manifest && this.boardState && this.boardState.lessonId === lessonId) {
      return this.boardState;
    }

    this.manifest = loadLessonManifest(this.db, lessonId);

    // Initialize board state: show initially visible nodes
    const visibleNodeIds = this.manifest.boardNodes
      .filter(node => !node.initiallyHidden)
      .map(node => node.id);

    this.boardState = {
      lessonId,
      visibleNodeIds,
      highlightedNodes: [],
      currentPhase: this.manifest.teachingPhases[0]?.id ?? 'intro',
    };

    // Reset beat-related state
    this.beatState = null;
    this.dynamicBoardActions = [];
    this.lastDynamicBeatId = null;
    this.globalBoardOps = [];

    this.persistState();
    return this.boardState;
  }

  /**
   * Reveal specified node IDs (make visible)
   */
  revealNodes(nodeIds: string[]): BoardState {
    if (!this.boardState) {
      throw new Error('No lesson loaded.');
    }

    for (const nodeId of nodeIds) {
      if (!this.boardState.visibleNodeIds.includes(nodeId)) {
        this.boardState.visibleNodeIds.push(nodeId);
      }
    }

    this.persistState();
    return this.boardState;
  }

  /**
   * Highlight specified nodes with a color
   * If durationMs === 0, clear all highlights
   */
  highlightNodes(
    nodeIds: string[],
    color: 'yellow' | 'red' | 'blue' = 'yellow',
    durationMs: number = 3000,
  ): BoardState {
    if (!this.boardState) {
      throw new Error('No lesson loaded.');
    }

    if (durationMs === 0) {
      // Clear all highlights
      this.boardState.highlightedNodes = [];
    } else {
      const startedAt = Date.now();
      for (const nodeId of nodeIds) {
        // Remove existing highlight for this node (if any)
        this.boardState.highlightedNodes = this.boardState.highlightedNodes.filter(
          h => h.nodeId !== nodeId,
        );
        // Add new highlight
        this.boardState.highlightedNodes.push({ nodeId, durationMs, startedAt, color });
      }
    }

    this.persistState();
    return this.boardState;
  }

  /**
   * Update the current teaching phase
   */
  setPhase(phaseId: string): BoardState {
    if (!this.boardState) {
      throw new Error('No lesson loaded.');
    }
    this.boardState.currentPhase = phaseId;
    this.persistState();
    return this.boardState;
  }

  /**
   * Advance to a specific beat by ID
   */
  advanceBeat(beatId: string): { beatState: BeatState; beat: Beat | undefined } {
    if (!this.manifest) throw new Error('No lesson loaded.');
    const beats = this.manifest.beats ?? [];
    const idx = beats.findIndex(b => b.id === beatId);
    const beat = beats[idx];
    this.beatState = {
      currentBeatId: beatId,
      currentBeatIndex: idx,
      totalBeats: beats.length,
      sectionId: beat?.sectionId ?? null,
    };
    // Reset dynamic board actions for new beat
    this.dynamicBoardActions = [];
    this.lastDynamicBeatId = beatId;
    this.persistState();
    return { beatState: this.beatState, beat };
  }

  /**
   * Append dynamic chalkboard actions for a beat.
   * Resets the action list when beatId changes so UI-driven beat advances
   * (which skip the server's advance_beat) don't cause stale action accumulation.
   */
  appendDynamicBoardActions(beatId: string, actions: ChalkboardAction[]): ChalkboardAction[] {
    if (this.lastDynamicBeatId !== beatId) {
      this.dynamicBoardActions = [];
      this.lastDynamicBeatId = beatId;
    }
    this.dynamicBoardActions.push(...actions);
    this.persistState();
    return this.dynamicBoardActions;
  }

  /**
   * Apply a global board operation (reveal/highlight a global node)
   */
  applyGlobalOp(op: GlobalBoardOp): GlobalBoardOp[] {
    this.globalBoardOps.push(op);
    this.persistState();
    return this.globalBoardOps;
  }

  getBoardState(): BoardState | null {
    return this.boardState;
  }

  getManifest(): LessonManifest | null {
    return this.manifest;
  }

  getBeatState(): BeatState | null {
    return this.beatState;
  }

  getDynamicBoardActions(): ChalkboardAction[] {
    return this.dynamicBoardActions;
  }

  getGlobalBoardOps(): GlobalBoardOp[] {
    return this.globalBoardOps;
  }

  resetBeatActions(): void {
    this.dynamicBoardActions = [];
    this.persistState();
  }
}

/**
 * Factory function: creates a StateManager bound to a db + sessionId.
 */
export function createStateManager(db: Database.Database, sessionId: string): StateManager {
  return new StateManager(db, sessionId);
}

export type { StateManager };
