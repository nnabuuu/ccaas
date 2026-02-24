import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { LessonManifest, BoardState, HighlightedNode, Beat, BeatState, ChalkboardAction, GlobalBoardOp } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class StateManager {
  private manifest: LessonManifest | null = null;
  private boardState: BoardState | null = null;
  private beatState: BeatState | null = null;
  private dynamicBoardActions: ChalkboardAction[] = [];
  private lastDynamicBeatId: string | null = null;
  private globalBoardOps: GlobalBoardOp[] = [];

  /**
   * Load lesson manifest from data/lessons/{lessonId}/manifest.json
   * Initializes board state with initially visible nodes
   */
  loadLesson(lessonId: string): BoardState {
    // Resolve data directory relative to dist/ (one level up from dist)
    const dataPath = path.resolve(__dirname, '../../data/lessons', lessonId, 'manifest.json');

    if (!fs.existsSync(dataPath)) {
      throw new Error(`Lesson manifest not found: ${dataPath}`);
    }

    const raw = fs.readFileSync(dataPath, 'utf-8');
    this.manifest = JSON.parse(raw) as LessonManifest;

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

    return this.boardState;
  }

  /**
   * Reveal specified node IDs (make visible)
   */
  revealNodes(nodeIds: string[]): BoardState {
    if (!this.boardState) {
      throw new Error('No lesson loaded. Call load_lesson first.');
    }

    for (const nodeId of nodeIds) {
      if (!this.boardState.visibleNodeIds.includes(nodeId)) {
        this.boardState.visibleNodeIds.push(nodeId);
      }
    }

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
      throw new Error('No lesson loaded. Call load_lesson first.');
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

    return this.boardState;
  }

  /**
   * Update the current teaching phase
   */
  setPhase(phaseId: string): BoardState {
    if (!this.boardState) {
      throw new Error('No lesson loaded. Call load_lesson first.');
    }
    this.boardState.currentPhase = phaseId;
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
    return this.dynamicBoardActions;
  }

  /**
   * Apply a global board operation (reveal/highlight a global node)
   */
  applyGlobalOp(op: GlobalBoardOp): GlobalBoardOp[] {
    this.globalBoardOps.push(op);
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
  }
}

// Singleton instance
export const stateManager = new StateManager();
