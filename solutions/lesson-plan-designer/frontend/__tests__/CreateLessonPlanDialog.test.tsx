import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CreateLessonPlanDialog from '../src/components/CreateLessonPlanDialog'
import type { TextbookSubject, TextbookGrade, TextbookPublisher, TextbookVolume, TextbookChapter } from '../src/types'

// Mock data
const mockSubjects: TextbookSubject[] = [
  { id: 'math', label: '数学' },
  { id: 'chinese', label: '语文' },
]

const mockGrades: TextbookGrade[] = [
  { id: 1, label: '一年级', stage: '义务教育阶段第一学段' },
  { id: 3, label: '三年级', stage: '义务教育阶段第二学段' },
]

const mockPublishers: TextbookPublisher[] = [
  { id: 'pep', label: '人教版' },
  { id: 'bsd', label: '北师大版' },
]

const mockVolumes: TextbookVolume[] = [
  { id: 'vol1', label: '上册' },
  { id: 'vol2', label: '下册' },
]

const mockChapters: TextbookChapter[] = [
  {
    id: 1,
    title: '第一单元 时、分、秒',
    children: [
      { id: 11, title: '秒的认识' },
    ],
  },
]

// Create mock fetch that returns appropriate data based on URL
function createMockFetch() {
  return vi.fn((url: string) => {
    if (url.includes('/subjects')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSubjects),
      } as Response)
    }
    if (url.includes('/grades')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockGrades),
      } as Response)
    }
    if (url.includes('/publishers')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockPublishers),
      } as Response)
    }
    if (url.includes('/volumes')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockVolumes),
      } as Response)
    }
    if (url.includes('/chapters')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockChapters),
      } as Response)
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    } as Response)
  })
}

describe('CreateLessonPlanDialog', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', createMockFetch())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

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

    it('should render when open', async () => {
      render(
        <CreateLessonPlanDialog
          open={true}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      )

      expect(screen.getByText('创建新备课方案')).toBeInTheDocument()
    })

    it('should render all form elements', async () => {
      render(
        <CreateLessonPlanDialog
          open={true}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('学科')).toBeInTheDocument()
      })

      expect(screen.getByText('年级')).toBeInTheDocument()
      expect(screen.getByText('出版社')).toBeInTheDocument()
      expect(screen.getByText('册别')).toBeInTheDocument()
      expect(screen.getByText('备课标题')).toBeInTheDocument()
    })

    it('should show unsaved changes warning', async () => {
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

  describe('form interaction', () => {
    it('should load subjects on open', async () => {
      render(
        <CreateLessonPlanDialog
          open={true}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/subjects'))
      })
    })

    it('should have disabled grade selector initially', async () => {
      render(
        <CreateLessonPlanDialog
          open={true}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      )

      await waitFor(() => {
        const gradeSelect = screen.getAllByRole('combobox')[1] // Second select is grade
        expect(gradeSelect).toBeDisabled()
      })
    })

    it('should enable grade selector after subject selection', async () => {
      render(
        <CreateLessonPlanDialog
          open={true}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText('请选择学科')).toBeInTheDocument()
      })

      // Select subject
      const subjectSelect = screen.getAllByRole('combobox')[0]
      fireEvent.change(subjectSelect, { target: { value: 'math' } })

      await waitFor(() => {
        const gradeSelect = screen.getAllByRole('combobox')[1]
        expect(gradeSelect).not.toBeDisabled()
      })
    })

    it('should show auto-generated title after subject and grade selection', async () => {
      render(
        <CreateLessonPlanDialog
          open={true}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText('请选择学科')).toBeInTheDocument()
      })

      // Select subject
      const subjectSelect = screen.getAllByRole('combobox')[0]
      fireEvent.change(subjectSelect, { target: { value: 'math' } })

      await waitFor(() => {
        const gradeSelect = screen.getAllByRole('combobox')[1]
        expect(gradeSelect).not.toBeDisabled()
      })

      // Select grade
      const gradeSelect = screen.getAllByRole('combobox')[1]
      fireEvent.change(gradeSelect, { target: { value: '3' } })

      await waitFor(() => {
        expect(screen.getByText('三年级数学')).toBeInTheDocument()
      })
    })

    it('should allow custom title toggle', async () => {
      render(
        <CreateLessonPlanDialog
          open={true}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('自定义标题')).toBeInTheDocument()
      })

      // Check the custom title checkbox
      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      // Should show input field
      expect(screen.getByPlaceholderText('输入自定义标题')).toBeInTheDocument()
    })
  })

  describe('create button state', () => {
    it('should be disabled initially', async () => {
      render(
        <CreateLessonPlanDialog
          open={true}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      )

      await waitFor(() => {
        const createButton = screen.getByText('创建')
        expect(createButton).toBeDisabled()
      })
    })

    it('should be enabled after minimum selections', async () => {
      render(
        <CreateLessonPlanDialog
          open={true}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText('请选择学科')).toBeInTheDocument()
      })

      // Select subject
      const subjectSelect = screen.getAllByRole('combobox')[0]
      fireEvent.change(subjectSelect, { target: { value: 'math' } })

      await waitFor(() => {
        const gradeSelect = screen.getAllByRole('combobox')[1]
        expect(gradeSelect).not.toBeDisabled()
      })

      // Select grade
      const gradeSelect = screen.getAllByRole('combobox')[1]
      fireEvent.change(gradeSelect, { target: { value: '3' } })

      await waitFor(() => {
        const createButton = screen.getByText('创建')
        expect(createButton).not.toBeDisabled()
      })
    })

    it('should show loading state when creating', async () => {
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
    it('should call onClose when cancel is clicked', async () => {
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

    it('should call onCreate with correct data', async () => {
      const onCreate = vi.fn()

      render(
        <CreateLessonPlanDialog
          open={true}
          onClose={vi.fn()}
          onCreate={onCreate}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText('请选择学科')).toBeInTheDocument()
      })

      // Select subject
      const subjectSelect = screen.getAllByRole('combobox')[0]
      fireEvent.change(subjectSelect, { target: { value: 'math' } })

      await waitFor(() => {
        const gradeSelect = screen.getAllByRole('combobox')[1]
        expect(gradeSelect).not.toBeDisabled()
      })

      // Select grade
      const gradeSelect = screen.getAllByRole('combobox')[1]
      fireEvent.change(gradeSelect, { target: { value: '3' } })

      await waitFor(() => {
        const createButton = screen.getByText('创建')
        expect(createButton).not.toBeDisabled()
      })

      // Click create
      fireEvent.click(screen.getByText('创建'))

      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '三年级数学',
          subject: '数学',
          gradeLevel: '三年级',
        })
      )
    })

    it('should include optional fields when selected', async () => {
      const onCreate = vi.fn()

      render(
        <CreateLessonPlanDialog
          open={true}
          onClose={vi.fn()}
          onCreate={onCreate}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText('请选择学科')).toBeInTheDocument()
      })

      // Select subject
      fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'math' } })

      await waitFor(() => {
        expect(screen.getAllByRole('combobox')[1]).not.toBeDisabled()
      })

      // Select grade
      fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '3' } })

      await waitFor(() => {
        expect(screen.getAllByRole('combobox')[2]).not.toBeDisabled()
      })

      // Select publisher
      fireEvent.change(screen.getAllByRole('combobox')[2], { target: { value: '人教版' } })

      await waitFor(() => {
        expect(screen.getAllByRole('combobox')[3]).not.toBeDisabled()
      })

      // Select volume
      fireEvent.change(screen.getAllByRole('combobox')[3], { target: { value: '上册' } })

      await waitFor(() => {
        const createButton = screen.getByText('创建')
        expect(createButton).not.toBeDisabled()
      })

      // Click create
      fireEvent.click(screen.getByText('创建'))

      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          publisher: '人教版',
          volume: '上册',
        })
      )
    })
  })

  describe('warning messages', () => {
    it('should show warning for non-math subjects', async () => {
      render(
        <CreateLessonPlanDialog
          open={true}
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText('请选择学科')).toBeInTheDocument()
      })

      // Select non-math subject
      const subjectSelect = screen.getAllByRole('combobox')[0]
      fireEvent.change(subjectSelect, { target: { value: 'chinese' } })

      await waitFor(() => {
        expect(screen.getByText('目前仅数学学科支持完整章节选择')).toBeInTheDocument()
      })
    })
  })
})
