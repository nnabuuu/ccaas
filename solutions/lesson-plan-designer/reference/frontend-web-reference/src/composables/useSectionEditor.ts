/**
 * Section Editor Composable
 *
 * Provides a consistent interface for inline section editing.
 * Works with the lesson plan store to manage edit state.
 */

import toast from '../utils/toast'

/**
 * Lesson Plan Store interface (minimal required interface)
 */
interface LessonPlanStoreInterface {
  isEditing: (sectionId: string) => boolean
  isSaving: (sectionId: string) => boolean
  startEditing: (sectionId: string) => void
  updateDraft: (sectionId: string, value: unknown) => void
  getSectionValue: (sectionId: string) => unknown
  saveSection: (sectionId: string) => Promise<boolean>
  cancelEditing: (sectionId: string) => void
  editingSections: Set<string>
}

/**
 * Section Editor Return Type
 */
interface SectionEditorReturn {
  isEditing: (sectionId: string) => boolean
  isSaving: (sectionId: string) => boolean
  startEdit: (sectionId: string) => void
  updateDraft: (sectionId: string, value: unknown) => void
  getSectionValue: (sectionId: string) => unknown
  saveEdit: (sectionId: string) => Promise<boolean>
  cancelEdit: (sectionId: string) => void
  hasActiveEdits: () => boolean
  cancelAllEdits: () => void
}

/**
 * Create section editor composable
 * @param store - The lesson plan Pinia store instance
 * @returns Section editor interface
 */
export function useSectionEditor(store: LessonPlanStoreInterface): SectionEditorReturn {
  /**
   * Check if a section is being edited
   * @param sectionId - Section identifier
   */
  function isEditing(sectionId: string): boolean {
    return store.isEditing(sectionId)
  }

  /**
   * Check if a section is being saved
   * @param sectionId - Section identifier
   */
  function isSaving(sectionId: string): boolean {
    return store.isSaving(sectionId)
  }

  /**
   * Start editing a section
   * Clones current data to draft for editing
   * @param sectionId - Section identifier
   */
  function startEdit(sectionId: string): void {
    store.startEditing(sectionId)
  }

  /**
   * Update draft data during editing
   * @param sectionId - Section identifier
   * @param value - New value for the section
   */
  function updateDraft(sectionId: string, value: unknown): void {
    store.updateDraft(sectionId, value)
  }

  /**
   * Get the current value for a section
   * Returns draft if editing, otherwise returns saved value
   * @param sectionId - Section identifier
   * @returns Section value
   */
  function getSectionValue(sectionId: string): unknown {
    return store.getSectionValue(sectionId)
  }

  /**
   * Save edited section
   * Validates, calls API, updates store
   * @param sectionId - Section identifier
   * @returns True if save successful
   */
  async function saveEdit(sectionId: string): Promise<boolean> {
    try {
      await store.saveSection(sectionId)
      toast.success('保存成功')
      return true
    } catch (err) {
      toast.error('保存失败：' + ((err as Error).message || '未知错误'))
      return false
    }
  }

  /**
   * Cancel editing and discard draft changes
   * @param sectionId - Section identifier
   */
  function cancelEdit(sectionId: string): void {
    store.cancelEditing(sectionId)
  }

  /**
   * Check if there are any sections being edited
   */
  function hasActiveEdits(): boolean {
    return store.editingSections.size > 0
  }

  /**
   * Cancel all active edits
   */
  function cancelAllEdits(): void {
    const sections = [...store.editingSections]
    sections.forEach(sectionId => {
      store.cancelEditing(sectionId)
    })
  }

  return {
    isEditing,
    isSaving,
    startEdit,
    updateDraft,
    getSectionValue,
    saveEdit,
    cancelEdit,
    hasActiveEdits,
    cancelAllEdits
  }
}
