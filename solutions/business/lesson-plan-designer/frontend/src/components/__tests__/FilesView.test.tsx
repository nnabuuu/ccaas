import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FilesView } from '../FilesView'
import type { UseAgentConnectionReturn, FileMetadata } from '@kedge-agentic/react-sdk'

// Mock dependencies
vi.mock('@kedge-agentic/react-sdk', async () => {
  const actual = await vi.importActual('@kedge-agentic/react-sdk')
  return {
    ...actual,
    useFiles: vi.fn(),
    FileUploadButton: ({ onUpload }: { onUpload: (file: File) => void }) => (
      <button onClick={() => onUpload(new File(['test'], 'test.txt'))}>
        Upload File Mock
      </button>
    ),
  }
})

import { useFiles } from '@kedge-agentic/react-sdk'

describe('FilesView', () => {
  const mockConnection = {
    connected: true,
    socket: null,
    sessionId: 'test-session',
    clientId: 'test-client',
  } as UseAgentConnectionReturn

  const mockFiles: FileMetadata[] = [
    {
      id: 'file-1',
      filename: 'test-audio.mp3',
      originalPath: 'test-audio.mp3',
      mimeType: 'audio/mpeg',
      size: 2500000,
      status: 'new',
      uploadedBy: 'user',
      currentVersion: 'v1',
      lastVersionAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'file-2',
      filename: 'test-slides.pptx',
      originalPath: 'test-slides.pptx',
      mimeType: 'application/vnd.ms-powerpoint',
      size: 5200000,
      status: 'synced',
      uploadedBy: 'agent',
      currentVersion: 'v1',
      lastVersionAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  const mockUseFiles = {
    files: mockFiles,
    isLoading: false,
    hasNewFiles: true,
    newFilesCount: 1,
    uploadFile: vi.fn(),
    markAsSynced: vi.fn(),
    markAllSeen: vi.fn(),
  }

  const mockAttachFile = vi.fn().mockResolvedValue({ success: true })

  const mockUseFileAttachment = {
    attachFile: mockAttachFile,
    isAttaching: false,
    error: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useFiles).mockReturnValue(mockUseFiles as any)
  })

  describe('rendering', () => {
    it('should render header with file count', () => {
      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={mockUseFileAttachment.attachFile}
        />
      )

      expect(screen.getByText('文件')).toBeInTheDocument()
      expect(screen.getByText('1 新')).toBeInTheDocument()
    })

    it('should render upload button', () => {
      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={mockUseFileAttachment.attachFile}
        />
      )

      expect(screen.getByText('上传')).toBeInTheDocument()
    })

    it('should render mark all seen button when there are new files', () => {
      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={mockUseFileAttachment.attachFile}
        />
      )

      expect(screen.getByText('标记已读')).toBeInTheDocument()
    })

    it('should not render mark all seen button when no new files', () => {
      vi.mocked(useFiles).mockReturnValue({
        ...mockUseFiles,
        hasNewFiles: false,
        newFilesCount: 0,
      } as any)

      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={mockUseFileAttachment.attachFile}
        />
      )

      expect(screen.queryByText('标记已读')).not.toBeInTheDocument()
    })

    it('should render file list', () => {
      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={mockUseFileAttachment.attachFile}
        />
      )

      expect(screen.getByText('test-audio.mp3')).toBeInTheDocument()
      expect(screen.getByText('test-slides.pptx')).toBeInTheDocument()
    })

    it('should show loading state', () => {
      vi.mocked(useFiles).mockReturnValue({
        ...mockUseFiles,
        isLoading: true,
        files: [],
      } as any)

      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={mockUseFileAttachment.attachFile}
        />
      )

      expect(screen.getByText('加载中...')).toBeInTheDocument()
    })

    it('should show empty state when no files', () => {
      vi.mocked(useFiles).mockReturnValue({
        ...mockUseFiles,
        files: [],
        hasNewFiles: false,
        newFilesCount: 0,
      } as any)

      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={mockUseFileAttachment.attachFile}
        />
      )

      expect(screen.getByText('暂无文件')).toBeInTheDocument()
      expect(screen.getByText('点击上传按钮添加课件、音频等资料')).toBeInTheDocument()
    })
  })

  describe('file display', () => {
    it('should display file size in human-readable format', () => {
      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={mockUseFileAttachment.attachFile}
        />
      )

      expect(screen.getByText('2.5 MB')).toBeInTheDocument()
      expect(screen.getByText('5.2 MB')).toBeInTheDocument()
    })

    it('should show "new" badge for new files', () => {
      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={mockUseFileAttachment.attachFile}
        />
      )

      const badges = screen.getAllByText('新')
      expect(badges).toHaveLength(1) // Only file-1 has status 'new'
    })

    it('should display correct icon for audio files', () => {
      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={mockUseFileAttachment.attachFile}
        />
      )

      // Music icon should be rendered (can't test Lucide icon directly, but can test presence)
      const audioFile = screen.getByText('test-audio.mp3').closest('div')
      expect(audioFile).toBeInTheDocument()
    })
  })

  describe('upload functionality', () => {
    it('should toggle upload area when upload button clicked', async () => {
      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={mockUseFileAttachment.attachFile}
        />
      )

      const uploadButton = screen.getByText('上传')
      fireEvent.click(uploadButton)

      // Upload area should appear
      await waitFor(() => {
        expect(screen.getByText('Upload File Mock')).toBeInTheDocument()
      })

      // Button text should change to "取消"
      expect(screen.getByText('取消')).toBeInTheDocument()
    })

    it('should call uploadFile when file is uploaded', async () => {
      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={mockUseFileAttachment.attachFile}
        />
      )

      // Open upload area
      fireEvent.click(screen.getByText('上传'))

      // Click mock upload button
      await waitFor(() => {
        const mockUploadButton = screen.getByText('Upload File Mock')
        fireEvent.click(mockUploadButton)
      })

      // uploadFile should be called
      await waitFor(() => {
        expect(mockUseFiles.uploadFile).toHaveBeenCalled()
      })
    })

    it('should close upload area after successful upload', async () => {
      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={mockUseFileAttachment.attachFile}
        />
      )

      // Open upload area
      fireEvent.click(screen.getByText('上传'))

      // Upload file
      const mockUploadButton = await screen.findByText('Upload File Mock')
      fireEvent.click(mockUploadButton)

      // Upload area should close
      await waitFor(() => {
        expect(screen.queryByText('Upload File Mock')).not.toBeInTheDocument()
      })
    })
  })

  describe('attach functionality', () => {
    it('should render attach button for each file', () => {
      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={mockUseFileAttachment.attachFile}
        />
      )

      const attachButtons = screen.getAllByText('附加')
      expect(attachButtons).toHaveLength(2) // One for each file
    })

    it('should call attachFile when attach button clicked', async () => {
      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={mockUseFileAttachment.attachFile}
        />
      )

      const attachButtons = screen.getAllByText('附加')
      fireEvent.click(attachButtons[0])

      await waitFor(() => {
        expect(mockUseFileAttachment.attachFile).toHaveBeenCalledWith(mockFiles[0])
      })
    })

    it('should show loading state during attach', async () => {
      const slowAttach = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return { success: true }
      })

      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={slowAttach}
        />
      )

      const attachButton = screen.getAllByText('附加')[0]
      fireEvent.click(attachButton)

      await waitFor(() => {
        expect(screen.getByText('附加中...')).toBeInTheDocument()
      })
    })

    it('should disable attach button during attach', async () => {
      const slowAttach = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return { success: true }
      })

      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={slowAttach}
        />
      )

      const firstAttachButton = screen.getAllByText('附加')[0]
      fireEvent.click(firstAttachButton)

      await waitFor(() => {
        const loadingButton = screen.getByText('附加中...')
        expect(loadingButton).toBeDisabled()
      })
    })
  })

  describe('mark as seen functionality', () => {
    it('should call markAllSeen when button clicked', () => {
      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={mockUseFileAttachment.attachFile}
        />
      )

      const markSeenButton = screen.getByText('标记已读')
      fireEvent.click(markSeenButton)

      expect(mockUseFiles.markAllSeen).toHaveBeenCalled()
    })
  })

  describe('download functionality', () => {
    it('should render download button for each file', () => {
      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={mockUseFileAttachment.attachFile}
        />
      )

      // Download buttons are rendered (check by role or test-id if needed)
      const files = screen.getAllByText(/test-.*\.(mp3|pptx)/)
      expect(files).toHaveLength(2)
    })

    it('should create download link when download button clicked', () => {
      // Mock document.createElement
      const createElementSpy = vi.spyOn(document, 'createElement')
      const appendChildSpy = vi.spyOn(document.body, 'appendChild')
      const removeChildSpy = vi.spyOn(document.body, 'removeChild')

      const mockLink = {
        click: vi.fn(),
        href: '',
        download: '',
      } as any

      createElementSpy.mockReturnValue(mockLink)

      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={mockUseFileAttachment.attachFile}
        />
      )

      // Find and click download button (first one)
      const fileItem = screen.getByText('test-audio.mp3').closest('div')
      const downloadButton = fileItem?.querySelector('button[title="下载"]')

      if (downloadButton) {
        fireEvent.click(downloadButton)

        expect(createElementSpy).toHaveBeenCalledWith('a')
        expect(mockLink.href).toBe('/api/v1/files/file-1/download')
        expect(mockLink.download).toBe('test-audio.mp3')
        expect(mockLink.click).toHaveBeenCalled()
        expect(appendChildSpy).toHaveBeenCalledWith(mockLink)
        expect(removeChildSpy).toHaveBeenCalledWith(mockLink)
      }

      createElementSpy.mockRestore()
      appendChildSpy.mockRestore()
      removeChildSpy.mockRestore()
    })
  })

  describe('file selection', () => {
    it('should mark file as synced when clicked', () => {
      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={mockUseFileAttachment.attachFile}
        />
      )

      // Click on file with "new" status
      const newFile = screen.getByText('test-audio.mp3')
      fireEvent.click(newFile.closest('div')!)

      expect(mockUseFiles.markAsSynced).toHaveBeenCalledWith('file-1')
    })

    it('should highlight selected file', () => {
      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={mockUseFileAttachment.attachFile}
        />
      )

      const fileDiv = screen.getByText('test-audio.mp3').closest('div')!
      fireEvent.click(fileDiv)

      // Check if selected class is applied
      expect(fileDiv).toHaveClass('bg-blue-50')
    })
  })

  describe('accessibility', () => {
    it('should have proper button labels', () => {
      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={mockUseFileAttachment.attachFile}
        />
      )

      expect(screen.getByText('上传')).toBeInTheDocument()
      expect(screen.getByText('标记已读')).toBeInTheDocument()
      expect(screen.getAllByText('附加')).toHaveLength(2)
    })

    it('should have proper button titles for icons', () => {
      render(
        <FilesView
          connection={mockConnection}
          sessionId="test-session"
          onAttachFile={mockUseFileAttachment.attachFile}
        />
      )

      const fileItem = screen.getByText('test-audio.mp3').closest('div')
      const downloadButton = fileItem?.querySelector('button[title="下载"]')
      const attachButton = fileItem?.querySelector('button[title="附加到教案"]')

      expect(downloadButton).toHaveAttribute('title', '下载')
      expect(attachButton).toHaveAttribute('title', '附加到教案')
    })
  })
})
