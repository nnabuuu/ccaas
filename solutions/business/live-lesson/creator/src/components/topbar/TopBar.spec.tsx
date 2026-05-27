import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TopBar from './TopBar'

// Stub the heavy children so this spec stays focused on TopBar's
// wiring (callbacks fire, viewingAuditReport prop flows down,
// publish disable, status pill). AuditButton + FilesPopover are
// tested separately.
vi.mock('./AuditButton', () => ({
  default: ({ viewingAuditReport, onAuditDone }: {
    viewingAuditReport?: boolean
    onAuditDone?: (path: string) => void
  }) => (
    <button
      type="button"
      data-testid="audit-button"
      data-viewing={viewingAuditReport ? 'true' : 'false'}
      onClick={() => onAuditDone?.('audit/x.md')}
    >
      audit
    </button>
  ),
}))
vi.mock('./FilesPopover', () => ({
  default: () => <div data-testid="files-popover" />,
}))

const baseProject = {
  id: 'p1',
  title: 'Sample Lesson',
  description: '',
  status: 'draft' as const,
  subjects: [],
  createdAt: '',
  updatedAt: '',
}

function renderTopBar(overrides: Partial<Parameters<typeof TopBar>[0]> = {}) {
  const defaults = {
    project: baseProject,
    files: [],
    isConnected: true,
    sseError: null,
    publishing: false,
    publishMsg: null,
    publishOk: false,
    viewingAuditReport: false,
    onBack: vi.fn(),
    onPublish: vi.fn(),
    onPreview: vi.fn(),
    onPickFile: vi.fn(),
    onAuditDone: vi.fn(),
  }
  return { ...defaults, ...overrides, ...render(<TopBar {...defaults} {...overrides} />) }
}

describe('TopBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('layout + status pill', () => {
    it('renders title + draft pill when status is draft', () => {
      renderTopBar()
      expect(screen.getByText('Sample Lesson')).toBeInTheDocument()
      expect(screen.getByText('草稿')).toBeInTheDocument()
    })

    it('shows published pill when project.status === published', () => {
      renderTopBar({ project: { ...baseProject, status: 'published' } })
      expect(screen.getByText('已发布')).toBeInTheDocument()
    })

    it('renders 预览 + 发布 buttons (design §3.1 — both must coexist)', () => {
      renderTopBar()
      expect(screen.getByText('预览')).toBeInTheDocument()
      expect(screen.getByText('发布')).toBeInTheDocument()
    })
  })

  describe('callbacks', () => {
    it('onBack fires when back arrow clicked', () => {
      const onBack = vi.fn()
      renderTopBar({ onBack })
      fireEvent.click(screen.getByLabelText('返回项目列表'))
      expect(onBack).toHaveBeenCalledTimes(1)
    })

    it('onPreview fires when 预览 button clicked', () => {
      const onPreview = vi.fn()
      renderTopBar({ onPreview })
      fireEvent.click(screen.getByText('预览').closest('button')!)
      expect(onPreview).toHaveBeenCalledTimes(1)
    })

    it('onPublish fires when 发布 button clicked', () => {
      const onPublish = vi.fn()
      renderTopBar({ onPublish })
      fireEvent.click(screen.getByText('发布').closest('button')!)
      expect(onPublish).toHaveBeenCalledTimes(1)
    })

    it('disables 发布 button while publishing=true (shows 发布中…)', () => {
      renderTopBar({ publishing: true })
      const btn = screen.getByText('发布中…').closest('button')!
      expect(btn).toBeDisabled()
    })
  })

  describe('viewingAuditReport prop drilling', () => {
    it('forwards viewingAuditReport=true to AuditButton', () => {
      renderTopBar({ viewingAuditReport: true })
      expect(screen.getByTestId('audit-button')).toHaveAttribute(
        'data-viewing',
        'true',
      )
    })

    it('forwards viewingAuditReport=false (default) to AuditButton', () => {
      renderTopBar()
      expect(screen.getByTestId('audit-button')).toHaveAttribute(
        'data-viewing',
        'false',
      )
    })
  })

  describe('SSE indicator', () => {
    it('green dot when isConnected=true', () => {
      const { container } = renderTopBar({ isConnected: true })
      const dot = container.querySelector('.bg-green-500')
      expect(dot).toBeTruthy()
    })

    it('gray dot when isConnected=false', () => {
      const { container } = renderTopBar({ isConnected: false })
      const dot = container.querySelector('.bg-gray-300')
      expect(dot).toBeTruthy()
    })
  })
})
