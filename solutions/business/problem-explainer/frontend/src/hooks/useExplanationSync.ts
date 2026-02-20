import { useState, useCallback } from 'react';
import type { OutputUpdate as SdkOutputUpdate } from '@kedge-agentic/react-sdk';
import { Explanation, OutputUpdate, SyncField, SYNC_FIELDS } from '../types';

interface UndoEntry {
  field: SyncField;
  previousValue: unknown;
  timestamp: number;
}

const UNDO_WINDOW_MS = 30000; // 30 seconds

export function useExplanationSync() {
  // Current explanation state
  const [explanation, setExplanation] = useState<Explanation>({
    keyKnowledge: [],
    solutionSteps: [],
    commonMistakes: [],
    relatedProblems: [],
  });

  // Pending updates (not yet synced to form)
  const [pendingUpdates, setPendingUpdates] = useState<Map<SyncField, OutputUpdate>>(new Map());

  // Modified fields (synced from AI)
  const [modifiedFields, setModifiedFields] = useState<Set<SyncField>>(new Set());

  // Undo stack
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);

  // Handle output update from AI - auto-sync to explanation
  // Accepts SDK's broader OutputUpdate type (field: string) and casts internally
  const handleOutputUpdate = useCallback((update: SdkOutputUpdate) => {
    const field = update.field as SyncField;
    console.log('[handleOutputUpdate] Received update:', {
      field,
      valueType: typeof update.value,
      valueIsArray: Array.isArray(update.value),
      preview: update.preview,
      timestamp: update.timestamp,
    });
    console.log('[handleOutputUpdate] Raw value:', update.value);

    // Parse value if it's a string that should be JSON (array or object)
    let parsedValue = update.value;

    // Fields that expect arrays or objects
    const arrayFields: SyncField[] = ['keyKnowledge', 'solutionSteps', 'commonMistakes', 'relatedProblems'];

    if (typeof parsedValue === 'string') {
      console.log('[handleOutputUpdate] Value is string, checking if needs JSON parse');
      // Try to parse as JSON if the field expects an array/object
      if (arrayFields.includes(field)) {
        try {
          parsedValue = JSON.parse(parsedValue);
          console.log('[handleOutputUpdate] Parsed JSON string for field:', field, 'result:', parsedValue);
        } catch (e) {
          // If parsing fails, wrap string in array for array fields
          console.warn('[handleOutputUpdate] Failed to parse JSON for', field, 'wrapping in array. Error:', e);
          parsedValue = [parsedValue];
        }
      }
    }

    console.log('[handleOutputUpdate] Final parsed value:', parsedValue);

    // Directly apply update to explanation (auto-sync)
    setExplanation((prev) => {
      const newExplanation = {
        ...prev,
        [field]: parsedValue,
      };
      console.log('[handleOutputUpdate] New explanation state:', newExplanation);
      return newExplanation;
    });

    // Mark as modified
    setModifiedFields((prev) => new Set(prev).add(field));

    console.log('[handleOutputUpdate] Auto-synced field:', field);
  }, []);

  // Sync a pending update to the explanation
  const syncToForm = useCallback((field: SyncField) => {
    const update = pendingUpdates.get(field);
    if (!update) return;

    // Save current value for undo
    const currentValue = explanation[field as keyof Explanation];
    setUndoStack((prev) => [
      ...prev.filter((e) => Date.now() - e.timestamp < UNDO_WINDOW_MS),
      { field, previousValue: currentValue, timestamp: Date.now() },
    ]);

    // Apply update
    setExplanation((prev) => ({
      ...prev,
      [field]: update.value,
    }));

    // Mark as modified
    setModifiedFields((prev) => new Set(prev).add(field));

    // Remove from pending
    setPendingUpdates((prev) => {
      const next = new Map(prev);
      next.delete(field);
      return next;
    });
  }, [pendingUpdates, explanation]);

  // Sync all pending updates
  const syncAllToForm = useCallback(() => {
    for (const field of SYNC_FIELDS) {
      if (pendingUpdates.has(field)) {
        syncToForm(field);
      }
    }
  }, [pendingUpdates, syncToForm]);

  // Dismiss a pending update without syncing
  const dismissUpdate = useCallback((field: SyncField) => {
    setPendingUpdates((prev) => {
      const next = new Map(prev);
      next.delete(field);
      return next;
    });
  }, []);

  // Undo a synced field
  const undoSync = useCallback((field: SyncField) => {
    const entry = undoStack.find(
      (e) => e.field === field && Date.now() - e.timestamp < UNDO_WINDOW_MS
    );

    if (!entry) return false;

    // Restore previous value
    setExplanation((prev) => ({
      ...prev,
      [field]: entry.previousValue,
    }));

    // Remove from modified
    setModifiedFields((prev) => {
      const next = new Set(prev);
      next.delete(field);
      return next;
    });

    // Remove from undo stack
    setUndoStack((prev) => prev.filter((e) => e !== entry));

    return true;
  }, [undoStack]);

  // Check if undo is available for a field
  const canUndo = useCallback(
    (field: SyncField) => {
      return undoStack.some(
        (e) => e.field === field && Date.now() - e.timestamp < UNDO_WINDOW_MS
      );
    },
    [undoStack]
  );

  // Update a field manually
  const updateField = useCallback((field: SyncField, value: unknown) => {
    setExplanation((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  // Reset explanation
  const resetExplanation = useCallback(() => {
    setExplanation({
      keyKnowledge: [],
      solutionSteps: [],
      commonMistakes: [],
      relatedProblems: [],
    });
    setPendingUpdates(new Map());
    setModifiedFields(new Set());
    setUndoStack([]);
  }, []);

  return {
    explanation,
    pendingUpdates,
    modifiedFields,
    handleOutputUpdate,
    syncToForm,
    syncAllToForm,
    dismissUpdate,
    undoSync,
    canUndo,
    updateField,
    resetExplanation,
  };
}
