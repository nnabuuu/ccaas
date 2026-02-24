import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { LessonManifest, BoardState, HighlightedNode, ActiveProbe } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class StateManager {
  private manifest: LessonManifest | null = null;
  private boardState: BoardState | null = null;

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
      activeProbes: [],
      currentPhase: this.manifest.teachingPhases[0]?.id ?? 'intro',
    };

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
   * Show diagnostic probes for a confusion point
   * Also highlights the confusion point's trigger node in red
   */
  showConfusionProbes(confusionPointId: string): BoardState {
    if (!this.boardState || !this.manifest) {
      throw new Error('No lesson loaded. Call load_lesson first.');
    }

    const cp = this.manifest.confusionPoints.find(c => c.id === confusionPointId);
    if (!cp) {
      throw new Error(`Confusion point not found: ${confusionPointId}`);
    }

    // Set active probes from confusion point's secondaryProbes
    this.boardState.activeProbes = cp.secondaryProbes.map(probe => ({
      id: probe.id,
      label: probe.label,
      confusionPointId,
    }));

    // Highlight the board node in red
    const startedAt = Date.now();
    this.boardState.highlightedNodes = this.boardState.highlightedNodes.filter(
      h => h.nodeId !== cp.boardNodeToFlash,
    );
    this.boardState.highlightedNodes.push({
      nodeId: cp.boardNodeToFlash,
      durationMs: 5000,
      startedAt,
      color: 'red',
    });

    return this.boardState;
  }

  /**
   * Clear all active probes and highlights
   */
  dismissProbes(): BoardState {
    if (!this.boardState) {
      throw new Error('No lesson loaded. Call load_lesson first.');
    }

    this.boardState.activeProbes = [];
    this.boardState.highlightedNodes = [];

    return this.boardState;
  }

  /**
   * Get the probe remediation text (used by Agent after probe selection)
   */
  getProbeRemediation(probeId: string): string | null {
    if (!this.manifest) return null;

    for (const cp of this.manifest.confusionPoints) {
      const probe = cp.secondaryProbes.find(p => p.id === probeId);
      if (probe) return probe.remediation;
    }
    return null;
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

  getBoardState(): BoardState | null {
    return this.boardState;
  }

  getManifest(): LessonManifest | null {
    return this.manifest;
  }
}

// Singleton instance
export const stateManager = new StateManager();
