import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CreateLessonPlanDialog from '../src/components/CreateLessonPlanDialog'

// Mock useTextbook hook
vi.mock('../src/hooks/useTextbook', () => ({
  useTextbook: () => ({
    subjects: [
      { id: 'math', label: '数学' },
      { id: 'chinese', label: '语文' },
    ],
    grades: [
      { id: 1, label: '一年级', stage: '义务教育阶段第一学段' },
      { id: 3, label: '三年级', stage: '义务教育阶段第二学段' },
    ],
    publishers: [],
    volumes: [],
    chapters: [],
    loadingSubjects: false,
    loadingGrades: false,
    loadingPublishers: false,
    loadingVolumes: false,
    loadingChapters: false,
    error: null,
    selectedSubject: '',
    selectedGradeId: null,
    selectedPublisher: '',
    selectedVolume: '',
    selectedChapterId: null,
    selectedChapterTitle: '',
    setSelectedSubject: vi.fn(),
    setSelectedGradeId: vi.fn(),
    setSelectedPublisher: vi.fn(),
    setSelectedVolume: vi.fn(),
    setSelectedChapter: vi.fn(),
    reset: vi.fn(),
  }),
}))

describe('CreateLessonPlanDialog', () => {
  describe('rendering', () => {
    it('should not render when closed', () => {
      render(
        <CreateLessonPlanDialog
          open={false}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      )

      expect(screen.queryByText('创建新备课方案')).not.toBeInTheDocument()
    })

    it('should render when open', () => {
      render(
        <CreateLessonPlanDialog
          open={true}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      )

      expect(screen.getByText('创建新备课方案')).toBeInTheDocument()
    })

    it('should render all form elements', () => {
      render(
        <CreateLessonPlanDialog
          open={true}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      )

      expect(screen.getByText('备课标题')).toBeInTheDocument()
      expect(screen.getAllByText(/学科/).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/年级/).length).toBeGreaterThan(0)
      expect(screen.getByText('课时（分钟）')).toBeInTheDocument()
      expect(screen.getByText('教案编号')).toBeInTheDocument()
      expect(screen.getByText('章节')).toBeInTheDocument()
      expect(screen.getByText('出版社')).toBeInTheDocument()
      expect(screen.getByText('册别')).toBeInTheDocument()
    })

    it('should show unsaved changes warning', () => {
      render(
        <CreateLessonPlanDialog
          open={true}
          hasUnsavedChanges={true}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      )

      expect(screen.getByText('当前备课方案有未保存的更改')).toBeInTheDocument()
    })
  })

  describe('create button state', () => {
    it('should be disabled initially (no subject or grade selected)', () => {
      render(
        <CreateLessonPlanDialog
          open={true}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      )

      const createButton = screen.getByText('创建')
      expect(createButton).toBeDisabled()
    })

    it('should show loading state when creating', () => {
      render(
        <CreateLessonPlanDialog
          open={true}
          loading={true}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      )

      expect(screen.getByText('创建中...')).toBeInTheDocument()
    })
  })

  describe('callbacks', () => {
    it('should call onClose when cancel is clicked', () => {
      const onClose = vi.fn()

      render(
        <CreateLessonPlanDialog
          open={true}
          onClose={onClose}
          onCreate={vi.fn()}
        />
      )

      fireEvent.click(screen.getByText('取消'))
      expect(onClose).toHaveBeenCalled()
    })
  })
})
