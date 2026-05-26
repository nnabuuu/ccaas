/**
 * FileListItem Component Tests
 *
 * Tests for individual file list item component including:
 * - File display with icons
 * - Badge indicators (new/modified/synced)
 * - Click interactions
 * - Dropdown menu actions
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { FileListItem } from '../FileListItem';
import type { FileMetadata } from '../../types';

describe('FileListItem', () => {
  const mockFile: FileMetadata = {
    id: 'file-123',
    filename: 'test.md',
    size: 1024,
    status: 'synced',
    mimeType: 'text/markdown',
    currentVersion: '1.0.0',
    lastVersionAt: new Date('2024-01-15'),
    createdAt: new Date('2024-01-01'),
    uploadedBy: 'user',
    sessionId: 'session-123',
    solutionId: 'solution-123',
    messageId: 'msg-123',
    originalPath: '/test.md',
    storedPath: '/storage/test.md',
    downloadedAt: null,
  };

  const mockHandlers = {
    onClick: jest.fn(),
    onDownload: jest.fn(),
    onDelete: jest.fn(),
    onVersions: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('File Display', () => {
    it('should render file name', () => {
      render(<FileListItem file={mockFile} {...mockHandlers} />);
      expect(screen.getByText('test.md')).toBeInTheDocument();
    });

    it('should render file size', () => {
      render(<FileListItem file={mockFile} {...mockHandlers} />);
      expect(screen.getByText('1.0 KB')).toBeInTheDocument();
    });

    it('should render file icon based on MIME type', () => {
      render(<FileListItem file={mockFile} {...mockHandlers} />);
      // FileText icon for markdown
      const icon = screen.getByTestId('file-icon');
      expect(icon).toHaveClass('text-blue-500');
    });

    it('should render different icon for image files', () => {
      const imageFile = { ...mockFile, mimeType: 'image/png' };
      render(<FileListItem file={imageFile} {...mockHandlers} />);
      const icon = screen.getByTestId('file-icon');
      expect(icon).toHaveClass('text-purple-500');
    });
  });

  describe('Badge Indicators', () => {
    it('should show pulsing red dot for new files', () => {
      const newFile = { ...mockFile, status: 'new' as const };
      render(<FileListItem file={newFile} {...mockHandlers} />);

      const badge = screen.getByTestId('new-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-red-500', 'animate-ping');
    });

    it('should show yellow badge for modified files', () => {
      const modifiedFile = { ...mockFile, status: 'modified' as const };
      render(<FileListItem file={modifiedFile} {...mockHandlers} />);

      const badge = screen.getByTestId('modified-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-yellow-500');
      expect(screen.getByText('Modified')).toBeInTheDocument();
    });

    it('should show no badge for synced files', () => {
      render(<FileListItem file={mockFile} {...mockHandlers} />);

      expect(screen.queryByTestId('new-badge')).not.toBeInTheDocument();
      expect(screen.queryByTestId('modified-badge')).not.toBeInTheDocument();
    });
  });

  describe('Click Interactions', () => {
    it('should call onClick when file item clicked', () => {
      render(<FileListItem file={mockFile} {...mockHandlers} />);

      const fileItem = screen.getByTestId('file-item');
      fireEvent.click(fileItem);

      expect(mockHandlers.onClick).toHaveBeenCalledWith(mockFile);
    });

    it('should apply hover styles', () => {
      render(<FileListItem file={mockFile} {...mockHandlers} />);

      const fileItem = screen.getByTestId('file-item');
      expect(fileItem).toHaveClass('hover:bg-slate-50', 'cursor-pointer');
    });

    it('should show selected state when isSelected is true', () => {
      render(
        <FileListItem
          file={mockFile}
          {...mockHandlers}
          isSelected={true}
        />
      );

      const fileItem = screen.getByTestId('file-item');
      expect(fileItem).toHaveClass('bg-blue-50', 'border-blue-500');
    });
  });

  describe('Dropdown Menu Actions', () => {
    it('should show dropdown menu when menu button clicked', () => {
      render(<FileListItem file={mockFile} {...mockHandlers} />);

      const menuButton = screen.getByTestId('file-menu-button');
      fireEvent.click(menuButton);

      expect(screen.getByText('Download')).toBeInTheDocument();
      expect(screen.getByText('Version History')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('should call onDownload when download clicked', () => {
      render(<FileListItem file={mockFile} {...mockHandlers} />);

      const menuButton = screen.getByTestId('file-menu-button');
      fireEvent.click(menuButton);

      const downloadButton = screen.getByText('Download');
      fireEvent.click(downloadButton);

      expect(mockHandlers.onDownload).toHaveBeenCalledWith(mockFile);
    });

    it('should call onVersions when version history clicked', () => {
      render(<FileListItem file={mockFile} {...mockHandlers} />);

      const menuButton = screen.getByTestId('file-menu-button');
      fireEvent.click(menuButton);

      const versionsButton = screen.getByText('Version History');
      fireEvent.click(versionsButton);

      expect(mockHandlers.onVersions).toHaveBeenCalledWith(mockFile);
    });

    it('should call onDelete when delete clicked', () => {
      render(<FileListItem file={mockFile} {...mockHandlers} />);

      const menuButton = screen.getByTestId('file-menu-button');
      fireEvent.click(menuButton);

      const deleteButton = screen.getByText('Delete');
      fireEvent.click(deleteButton);

      expect(mockHandlers.onDelete).toHaveBeenCalledWith(mockFile);
    });

    it('should stop propagation on menu button click', () => {
      render(<FileListItem file={mockFile} {...mockHandlers} />);

      const menuButton = screen.getByTestId('file-menu-button');
      fireEvent.click(menuButton);

      // onClick should not be called when clicking menu button
      expect(mockHandlers.onClick).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<FileListItem file={mockFile} {...mockHandlers} />);

      expect(screen.getByLabelText('File: test.md')).toBeInTheDocument();
      expect(screen.getByLabelText('File actions menu')).toBeInTheDocument();
    });

    it('should be keyboard navigable', () => {
      render(<FileListItem file={mockFile} {...mockHandlers} />);

      const fileItem = screen.getByTestId('file-item');
      expect(fileItem).toHaveAttribute('tabIndex', '0');

      // Simulate Enter key
      fireEvent.keyDown(fileItem, { key: 'Enter', code: 'Enter' });
      expect(mockHandlers.onClick).toHaveBeenCalledWith(mockFile);
    });
  });

  describe('File Metadata', () => {
    it('should format large file sizes correctly', () => {
      const largeFile = { ...mockFile, size: 5 * 1024 * 1024 }; // 5 MB
      render(<FileListItem file={largeFile} {...mockHandlers} />);
      expect(screen.getByText('5.0 MB')).toBeInTheDocument();
    });

    it('should show version number', () => {
      render(<FileListItem file={mockFile} {...mockHandlers} />);
      expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    });

    it('should show uploaded by agent/user', () => {
      render(<FileListItem file={mockFile} {...mockHandlers} />);
      expect(screen.getByText('user')).toBeInTheDocument();
    });

    it('should format creation date', () => {
      render(<FileListItem file={mockFile} {...mockHandlers} />);
      // Date formatted like "Jan 1, 2024"
      expect(screen.getByText(/Jan.*2024/)).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should have mobile-friendly touch targets', () => {
      render(<FileListItem file={mockFile} {...mockHandlers} />);

      const fileItem = screen.getByTestId('file-item');
      const style = window.getComputedStyle(fileItem);

      // Should have minimum 44px height for touch targets
      expect(parseInt(style.minHeight)).toBeGreaterThanOrEqual(44);
    });

    it('should truncate long filenames', () => {
      const longFile = {
        ...mockFile,
        filename: 'very-long-filename-that-should-be-truncated.md',
      };
      render(<FileListItem file={longFile} {...mockHandlers} />);

      const filename = screen.getByText(longFile.filename);
      expect(filename).toHaveClass('truncate');
    });
  });
});
