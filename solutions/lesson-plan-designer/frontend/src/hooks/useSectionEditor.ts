import { useState, useCallback } from 'react'

export interface UseSectionEditorOptions {
  /**
   * Callback function called when saving a section.
   * Should return a Promise that resolves on success or rejects on failure.
   */
  onSave?: (sectionId: string) => Promise<void>
}

export interface UseSectionEditorReturn {
  /**
   * Set of section IDs currently being edited
   */
  editingSections: Set<string>

  /**
   * Start editing a section
   */
  startEdit: (sectionId: string) => void

  /**
   * Cancel editing a section (discard changes)
   */
  cancelEdit: (sectionId: string) => void

  /**
   * Save changes to a section
   * Returns a Promise that resolves when save is complete
   */
  saveEdit: (sectionId: string) => Promise<void>

  /**
   * Check if a section is currently being edited
   */
  isEditing: (sectionId: string) => boolean

  /**
   * Check if a section is currently being saved
   */
  isSaving: (sectionId: string) => boolean

  /**
   * Get the count of sections currently being edited
   */
  getEditingCount: () => number

  /**
   * Cancel all active edits
   */
  cancelAllEdits: () => void
}

/**
 * Hook for managing per-section editing state.
 * Allows multiple sections to be edited simultaneously,
 * with independent save/cancel operations for each section.
 */
export function useSectionEditor(
  options: UseSectionEditorOptions = {}
): UseSectionEditorReturn {
  const { onSave } = options

  // Set of section IDs currently in editing mode
  const [editingSections, setEditingSections] = useState<Set<string>>(new Set())

  // Set of section IDs currently being saved
  const [savingSections, setSavingSections] = useState<Set<string>>(new Set())

  const startEdit = useCallback((sectionId: string) => {
    setEditingSections((prev) => {
      const next = new Set(prev)
      next.add(sectionId)
      return next
    })
  }, [])

  const cancelEdit = useCallback((sectionId: string) => {
    setEditingSections((prev) => {
      const next = new Set(prev)
      next.delete(sectionId)
      return next
    })
  }, [])

  const saveEdit = useCallback(
    async (sectionId: string): Promise<void> => {
      // Mark section as saving
      setSavingSections((prev) => {
        const next = new Set(prev)
        next.add(sectionId)
        return next
      })

      try {
        // Call the onSave callback if provided
        if (onSave) {
          await onSave(sectionId)
        }

        // Remove from editing set on success
        setEditingSections((prev) => {
          const next = new Set(prev)
          next.delete(sectionId)
          return next
        })
      } catch (error) {
        // Keep in editing mode on failure, re-throw error
        throw error
      } finally {
        // Always remove from saving set
        setSavingSections((prev) => {
          const next = new Set(prev)
          next.delete(sectionId)
          return next
        })
      }
    },
    [onSave]
  )

  const isEditing = useCallback(
    (sectionId: string): boolean => {
      return editingSections.has(sectionId)
    },
    [editingSections]
  )

  const isSaving = useCallback(
    (sectionId: string): boolean => {
      return savingSections.has(sectionId)
    },
    [savingSections]
  )

  const getEditingCount = useCallback((): number => {
    return editingSections.size
  }, [editingSections])

  const cancelAllEdits = useCallback(() => {
    setEditingSections(new Set())
  }, [])

  return {
    editingSections,
    startEdit,
    cancelEdit,
    saveEdit,
    isEditing,
    isSaving,
    getEditingCount,
    cancelAllEdits,
  }
}
