import { useState, useCallback, useMemo } from 'react'
import { useTextbook } from '../hooks/useTextbook'
import ChapterTree from './ChapterTree'

interface CreateLessonPlanDialogProps {
  open: boolean
  loading?: boolean
  hasUnsavedChanges?: boolean
  onClose: () => void
  onCreate: (data: {
    title: string
    subject: string
    gradeLevel: string
    publisher?: string
    volume?: string
    chapterId?: number
    chapterTitle?: string
  }) => void
}

export default function CreateLessonPlanDialog({
  open,
  loading = false,
  hasUnsavedChanges = false,
  onClose,
  onCreate,
}: CreateLessonPlanDialogProps) {
  const {
    subjects,
    grades,
    publishers,
    volumes,
    chapters,
    loadingSubjects,
    loadingGrades,
    loadingPublishers,
    loadingVolumes,
    loadingChapters,
    error,
    selectedSubject,
    selectedGradeId,
    selectedPublisher,
    selectedVolume,
    selectedChapterId,
    selectedChapterTitle,
    setSelectedSubject,
    setSelectedGradeId,
    setSelectedPublisher,
    setSelectedVolume,
    setSelectedChapter,
    reset,
  } = useTextbook()

  // Custom title override
  const [customTitle, setCustomTitle] = useState('')
  const [useCustomTitle, setUseCustomTitle] = useState(false)

  // Get grade label
  const selectedGradeLabel = useMemo(() => {
    const grade = grades.find((g) => g.id === selectedGradeId)
    return grade?.label || ''
  }, [grades, selectedGradeId])

  // Get subject label
  const selectedSubjectLabel = useMemo(() => {
    const subject = subjects.find((s) => s.id === selectedSubject)
    return subject?.label || ''
  }, [subjects, selectedSubject])

  // Auto-generated title
  const autoTitle = useMemo(() => {
    if (!selectedGradeLabel || !selectedSubjectLabel) return ''
    if (!selectedChapterTitle) return `${selectedGradeLabel}${selectedSubjectLabel}`
    return `${selectedGradeLabel}${selectedSubjectLabel} - ${selectedChapterTitle}`
  }, [selectedGradeLabel, selectedSubjectLabel, selectedChapterTitle])

  // Final title
  const finalTitle = useCustomTitle ? customTitle : autoTitle

  // Can create
  const canCreate = useMemo(() => {
    // Minimum requirement: subject and grade
    return selectedSubject && selectedGradeId && finalTitle.trim().length > 0
  }, [selectedSubject, selectedGradeId, finalTitle])

  const handleCreate = useCallback(() => {
    if (!canCreate) return

    onCreate({
      title: finalTitle.trim(),
      subject: selectedSubjectLabel,
      gradeLevel: selectedGradeLabel,
      publisher: selectedPublisher || undefined,
      volume: selectedVolume || undefined,
      chapterId: selectedChapterId || undefined,
      chapterTitle: selectedChapterTitle || undefined,
    })
  }, [
    canCreate,
    finalTitle,
    selectedSubjectLabel,
    selectedGradeLabel,
    selectedPublisher,
    selectedVolume,
    selectedChapterId,
    selectedChapterTitle,
    onCreate,
  ])

  const handleClose = useCallback(() => {
    reset()
    setCustomTitle('')
    setUseCustomTitle(false)
    onClose()
  }, [reset, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">创建新备课方案</h3>
          <p className="text-sm text-gray-500 mt-1">选择教材版本和章节，AI将根据课程标准帮您设计教案</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Warning for unsaved changes */}
          {hasUnsavedChanges && (
            <div className="p-3 bg-yellow-50 text-yellow-700 rounded-lg text-sm">
              当前备课方案有未保存的更改
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Cascading selectors */}
          <div className="grid grid-cols-2 gap-4">
            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                学科 <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                disabled={loadingSubjects}
                className="input-field"
              >
                <option value="">请选择学科</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.label}
                  </option>
                ))}
              </select>
              {selectedSubject && selectedSubject !== 'math' && (
                <p className="text-xs text-amber-600 mt-1">目前仅数学学科支持完整章节选择</p>
              )}
            </div>

            {/* Grade */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                年级 <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedGradeId || ''}
                onChange={(e) => setSelectedGradeId(e.target.value ? parseInt(e.target.value, 10) : null)}
                disabled={!selectedSubject || loadingGrades}
                className="input-field"
              >
                <option value="">请选择年级</option>
                {grades.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.label} ({grade.stage})
                  </option>
                ))}
              </select>
            </div>

            {/* Publisher */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                出版社
              </label>
              <select
                value={selectedPublisher}
                onChange={(e) => setSelectedPublisher(e.target.value)}
                disabled={!selectedGradeId || loadingPublishers}
                className="input-field"
              >
                <option value="">请选择出版社</option>
                {publishers.map((publisher) => (
                  <option key={publisher.id} value={publisher.label}>
                    {publisher.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Volume */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                册别
              </label>
              <select
                value={selectedVolume}
                onChange={(e) => setSelectedVolume(e.target.value)}
                disabled={!selectedPublisher || loadingVolumes}
                className="input-field"
              >
                <option value="">请选择册别</option>
                {volumes.map((volume) => (
                  <option key={volume.id} value={volume.label}>
                    {volume.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Chapter Tree - Always visible with appropriate states */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              章节
            </label>
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 min-h-[200px]">
              {!selectedSubject ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <p className="text-sm">请先选择学科</p>
                </div>
              ) : !selectedGradeId ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <p className="text-sm">请选择年级</p>
                </div>
              ) : !selectedPublisher ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <p className="text-sm">请选择出版社</p>
                </div>
              ) : !selectedVolume ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <p className="text-sm">请选择册别</p>
                </div>
              ) : (
                <ChapterTree
                  chapters={chapters}
                  selectedChapterId={selectedChapterId}
                  onSelect={setSelectedChapter}
                  loading={loadingChapters}
                />
              )}
            </div>
          </div>

          {/* Title */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                备课标题
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={useCustomTitle}
                  onChange={(e) => setUseCustomTitle(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-gray-600">自定义标题</span>
              </label>
            </div>

            {useCustomTitle ? (
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="输入自定义标题"
                className="input-field"
                autoFocus
              />
            ) : (
              <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-700">
                {autoTitle || <span className="text-gray-400">请先选择学科和年级</span>}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            {selectedChapterTitle && (
              <span className="text-primary-600">
                已选择：{selectedChapterTitle}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="btn-secondary"
              disabled={loading}
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={!canCreate || loading}
              className="btn-primary"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  创建中...
                </span>
              ) : (
                '创建'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
