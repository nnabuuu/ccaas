/**
 * FilesController Tests
 *
 * Tests for file management endpoints:
 * - GET /session/:sessionId/tree
 * - GET /:fileId/preview
 * - POST /:fileId/sync
 * - POST /upload
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { SessionService } from '../sessions/session.service';
import type { FileTreeNode, FilePreviewResponse } from './dto/file.dto';

describe('FilesController', () => {
  let controller: FilesController;
  let service: jest.Mocked<FilesService>;
  let sessionService: jest.Mocked<SessionService>;

  const mockTreeNode = (overrides: Partial<FileTreeNode> = {}): FileTreeNode => ({
    id: 'file-1',
    name: 'test.md',
    type: 'file',
    path: 'test.md',
    fileId: 'uuid-1',
    mimeType: 'text/markdown',
    size: 1024,
    status: 'new',
    ...overrides,
  });

  const mockPreview = (overrides: Partial<FilePreviewResponse> = {}): FilePreviewResponse => ({
    content: '# Hello World',
    truncated: false,
    encoding: 'utf8',
    mimeType: 'text/markdown',
    size: 1024,
    ...overrides,
  });

  beforeEach(async () => {
    const mockFilesService = {
      getSessionFilesAsTree: jest.fn(),
      getFilePreview: jest.fn(),
      markAsSynced: jest.fn(),
      uploadFile: jest.fn(),
      validateUpload: jest.fn(),
      findById: jest.fn(),
      findByIdOrFail: jest.fn(),
      findBySessionId: jest.fn(),
      fileExists: jest.fn(),
      getFilePath: jest.fn(),
    };

    const mockSessionService = {
      getSession: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('.agent-workspace'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        {
          provide: FilesService,
          useValue: mockFilesService,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<FilesController>(FilesController);
    service = module.get(FilesService);
    sessionService = module.get(SessionService);

    jest.clearAllMocks();
  });

  describe('GET /session/:sessionId/tree', () => {
    it('should return file tree for session', async () => {
      const tree: FileTreeNode[] = [
        mockTreeNode({ type: 'folder', name: 'docs', children: [mockTreeNode()] }),
      ];
      service.getSessionFilesAsTree.mockResolvedValue(tree);

      const result = await controller.getSessionFilesTree('session-1');

      expect(result.tree).toEqual(tree);
      expect(service.getSessionFilesAsTree).toHaveBeenCalledWith('session-1');
    });

    it('should return empty tree for session with no files', async () => {
      service.getSessionFilesAsTree.mockResolvedValue([]);

      const result = await controller.getSessionFilesTree('session-1');

      expect(result.tree).toEqual([]);
    });
  });

  describe('GET /:fileId/preview', () => {
    it('should return file preview', async () => {
      const preview = mockPreview();
      service.getFilePreview.mockResolvedValue(preview);

      const result = await controller.getFilePreview('uuid-1');

      expect(result).toEqual(preview);
      expect(service.getFilePreview).toHaveBeenCalledWith('uuid-1', undefined);
    });

    it('should pass maxBytes query parameter', async () => {
      service.getFilePreview.mockResolvedValue(mockPreview());

      await controller.getFilePreview('uuid-1', '50000');

      expect(service.getFilePreview).toHaveBeenCalledWith('uuid-1', 50000);
    });

    it('should handle truncated content', async () => {
      const preview = mockPreview({ truncated: true, size: 200000 });
      service.getFilePreview.mockResolvedValue(preview);

      const result = await controller.getFilePreview('uuid-1');

      expect(result.truncated).toBe(true);
      expect(result.size).toBe(200000);
    });

    it('should propagate NotFoundException', async () => {
      service.getFilePreview.mockRejectedValue(
        new NotFoundException('File not found'),
      );

      await expect(controller.getFilePreview('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('POST /:fileId/sync', () => {
    it('should mark file as synced and return success', async () => {
      const syncedFile = {
        id: 'uuid-1',
        status: 'synced' as const,
        downloadedAt: new Date(),
      };
      service.markAsSynced.mockResolvedValue(syncedFile as any);

      const result = await controller.markFileAsSynced('uuid-1');

      expect(result.success).toBe(true);
      expect(result.status).toBe('synced');
      expect(service.markAsSynced).toHaveBeenCalledWith('uuid-1');
    });

    it('should propagate NotFoundException for invalid file', async () => {
      service.markAsSynced.mockRejectedValue(
        new NotFoundException('File not found'),
      );

      await expect(controller.markFileAsSynced('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('POST /upload', () => {
    const mockMulterFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'document.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 5000,
      destination: '/tmp',
      filename: 'document.pdf',
      path: '/tmp/document.pdf',
      buffer: Buffer.from('pdf content'),
      stream: {} as any,
    };

    it('should upload file and return result', async () => {
      const uploadResult = {
        id: 'new-uuid',
        filename: 'document.pdf',
        originalPath: 'document.pdf',
        mimeType: 'application/pdf',
        size: 5000,
        status: 'new' as const,
        uploadedBy: 'user' as const,
        createdAt: new Date(),
      };
      service.uploadFile.mockResolvedValue(uploadResult);
      sessionService.getSession.mockReturnValue(undefined);

      const result = await controller.uploadFile(
        mockMulterFile,
        'session-1',
        'msg-1',
        'tenant-1',
        undefined,
      );

      expect(result).toEqual(uploadResult);
      expect(service.validateUpload).toHaveBeenCalledWith(mockMulterFile);
      expect(service.uploadFile).toHaveBeenCalledWith(
        mockMulterFile.buffer,
        'document.pdf',
        'session-1',
        'msg-1',
        'tenant-1',
        undefined,
        expect.stringContaining('sessions/session-1'), // fallback workspaceDir
      );
    });

    it('should pass workspaceDir when session exists', async () => {
      const uploadResult = {
        id: 'new-uuid',
        filename: 'document.pdf',
        originalPath: 'document.pdf',
        mimeType: 'application/pdf',
        size: 5000,
        status: 'new' as const,
        uploadedBy: 'user' as const,
        createdAt: new Date(),
      };
      service.uploadFile.mockResolvedValue(uploadResult);
      sessionService.getSession.mockReturnValue({
        sessionId: 'session-1',
        workspaceDir: '/tmp/workspace/sessions/session-1',
      } as any);

      await controller.uploadFile(
        mockMulterFile,
        'session-1',
        'msg-1',
        'tenant-1',
        undefined,
      );

      expect(sessionService.getSession).toHaveBeenCalledWith('session-1');
      expect(service.uploadFile).toHaveBeenCalledWith(
        mockMulterFile.buffer,
        'document.pdf',
        'session-1',
        'msg-1',
        'tenant-1',
        undefined,
        '/tmp/workspace/sessions/session-1', // workspaceDir from session
      );
    });

    it('should pass targetPath when provided', async () => {
      service.uploadFile.mockResolvedValue({
        id: 'uuid',
        originalPath: 'uploads/docs/document.pdf',
      } as any);
      sessionService.getSession.mockReturnValue(undefined);

      await controller.uploadFile(
        mockMulterFile,
        'session-1',
        'msg-1',
        'tenant-1',
        'uploads/docs',
      );

      expect(service.uploadFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        'document.pdf',
        'session-1',
        'msg-1',
        'tenant-1',
        'uploads/docs',
        expect.stringContaining('sessions/session-1'), // fallback workspaceDir
      );
    });

    it('should throw NotFoundException when sessionId is missing', async () => {
      await expect(
        controller.uploadFile(mockMulterFile, '', 'msg-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow upload without messageId for user uploads', async () => {
      service.uploadFile.mockResolvedValue({
        id: 'new-uuid',
        filename: 'test.txt',
        originalPath: 'test.txt',
        mimeType: 'text/plain',
        size: 100,
        status: 'new',
        uploadedBy: 'user',
        createdAt: new Date(),
      });
      sessionService.getSession.mockReturnValue(undefined);

      const result = await controller.uploadFile(mockMulterFile, 'session-1', '');

      expect(service.uploadFile).toHaveBeenCalledWith(
        mockMulterFile.buffer,
        mockMulterFile.originalname,
        'session-1',
        null, // messageId should be null
        undefined, // tenantId
        undefined, // targetPath
        expect.stringContaining('sessions/session-1'), // fallback workspaceDir
      );
      expect(result.id).toBe('new-uuid');
    });

    it('should propagate validation errors', async () => {
      service.validateUpload.mockImplementation(() => {
        throw new BadRequestException('File too large');
      });

      await expect(
        controller.uploadFile(mockMulterFile, 'session-1', 'msg-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('GET /session/:sessionId (existing endpoint)', () => {
    it('should return files with new fields', async () => {
      const files = [
        {
          id: 'uuid-1',
          filename: 'test.md',
          originalPath: 'docs/test.md',
          mimeType: 'text/markdown',
          size: 1024,
          messageId: 'msg-1',
          status: 'new' as const,
          uploadedBy: 'agent' as const,
          createdAt: new Date(),
        },
      ];
      service.findBySessionId.mockResolvedValue(files as any);

      const result = await controller.getSessionFiles('session-1');

      expect(result.files[0]).toMatchObject({
        id: 'uuid-1',
        filename: 'test.md',
        originalPath: 'docs/test.md',
        status: 'new',
        uploadedBy: 'agent',
        downloadUrl: '/api/v1/files/uuid-1/download',
      });
    });
  });
});
