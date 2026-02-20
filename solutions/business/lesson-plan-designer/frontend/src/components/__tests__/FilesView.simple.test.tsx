import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FilesView } from '../FilesView'
import type { UseAgentConnectionReturn } from '@ccaas/react-sdk'

// Mock dependencies
vi.mock('@ccaas/react-sdk', () => ({
  useFiles: () => ({
    files: [],
    isLoading: false,
    hasNewFiles: false,
    newFilesCount: 0,
    uploadFile: vi.fn(),
    markAsSynced: vi.fn(),
    markAllSeen: vi.fn(),
  }),
  FileUploadButton: () => <div>Upload Button</div>,
}))

// Note: useFileAttachment is no longer imported by FilesView
// Attachment functionality is now passed via onAttachFile prop

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Music: () => <div>Music Icon</div>,
  Presentation: () => <div>Presentation Icon</div>,
  FileText: () => <div>FileText Icon</div>,
  FileCode: () => <div>FileCode Icon</div>,
  File: () => <div>File Icon</div>,
  Download: () => <div>Download Icon</div>,
  Paperclip: () => <div>Paperclip Icon</div>,
}))

describe('FilesView - Basic Tests', () => {
  const mockConnection = {
    connected: true,
    socket: null,
    sessionId: 'test-session',
    clientId: 'test-client',
  } as UseAgentConnectionReturn

  it('should render without crashing (generic mode)', () => {
    render(
      <FilesView
        connection={mockConnection}
        sessionId="test-session"
      />
    )

    expect(screen.getByText('文件')).toBeInTheDocument()
  })

  it('should render upload button', () => {
    render(
      <FilesView
        connection={mockConnection}
        sessionId="test-session"
      />
    )

    expect(screen.getByText('上传')).toBeInTheDocument()
  })

  it('should render empty state when no files', () => {
    render(
      <FilesView
        connection={mockConnection}
        sessionId="test-session"
      />
    )

    expect(screen.getByText('暂无文件')).toBeInTheDocument()
  })

  it('should render with attachment functionality when onAttachFile provided', () => {
    const mockAttach = vi.fn().mockResolvedValue({ success: true })

    render(
      <FilesView
        connection={mockConnection}
        sessionId="test-session"
        onAttachFile={mockAttach}
        attachButtonLabel="附加"
        attachButtonTitle="附加到教案"
      />
    )

    expect(screen.getByText('文件')).toBeInTheDocument()
  })
})
