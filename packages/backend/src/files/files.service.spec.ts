/**
 * FilesService Tests
 *
 * Tests for file management service including:
 * - createFromWriteTool (Write tool file tracking)
 * - getSessionFilesAsTree (FB-001)
 * - getFilePreview (FB-003)
 * - markAsSynced (FB-002)
 * - uploadFile (FB-004)
 * - validateUpload
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { FilesService } from './files.service';
import { AgentFile } from './entities/agent-file.entity';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs/promises
jest.mock('fs/promises');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('FilesService', () => {
  let service: FilesService;
  let repository: jest.Mocked<Repository<AgentFile>>;

  const mockFile = (overrides: Partial<AgentFile> = {}): AgentFile => ({
    id: 'file-uuid-1',
    messageId: 'msg-uuid-1',
    sessionId: 'session-uuid-1',
    tenantId: 'tenant-1',
    originalPath: 'reports/summary.md',
    storedPath: '/storage/tenant-1/msg-uuid-1/summary.md',
    filename: 'summary.md',
    mimeType: 'text/markdown',
    size: 1024,
    status: 'new',
    downloadedAt: null,
    uploadedBy: 'agent',
    createdAt: new Date('2024-01-01'),
    message: {} as any,
    ...overrides,
  });

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: getRepositoryToken(AgentFile),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
    repository = module.get(getRepositoryToken(AgentFile));

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('createFromWriteTool', () => {
    const baseDto = {
      messageId: 'msg-uuid-1',
      sessionId: 'session-uuid-1',
      tenantId: 'tenant-1',
      originalPath: 'docs/test.md',
      workspaceDir: '/tmp/workspace',
    };

    beforeEach(() => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({ size: 256 } as any);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.copyFile.mockResolvedValue(undefined);
    });

    describe('success path', () => {
      it('should copy file from workspace to persistent storage', async () => {
        const file = mockFile();
        repository.create.mockReturnValue(file);
        repository.save.mockResolvedValue(file);

        await service.createFromWriteTool(baseDto);

        expect(mockFs.copyFile).toHaveBeenCalledWith(
          '/tmp/workspace/docs/test.md',
          expect.stringContaining('test.md'),
        );
      });

      it('should create database record with correct fields', async () => {
        const file = mockFile();
        repository.create.mockReturnValue(file);
        repository.save.mockResolvedValue(file);

        await service.createFromWriteTool(baseDto);

        expect(repository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            messageId: 'msg-uuid-1',
            sessionId: 'session-uuid-1',
            tenantId: 'tenant-1',
            originalPath: 'docs/test.md',
            filename: 'test.md',
          }),
        );
        expect(repository.save).toHaveBeenCalled();
      });

      it('should resolve relative paths correctly', async () => {
        const file = mockFile();
        repository.create.mockReturnValue(file);
        repository.save.mockResolvedValue(file);

        await service.createFromWriteTool({
          ...baseDto,
          originalPath: 'relative/path/file.txt',
        });

        expect(mockFs.access).toHaveBeenCalledWith(
          '/tmp/workspace/relative/path/file.txt',
        );
      });

      it('should resolve absolute paths correctly', async () => {
        const file = mockFile();
        repository.create.mockReturnValue(file);
        repository.save.mockResolvedValue(file);

        await service.createFromWriteTool({
          ...baseDto,
          originalPath: '/absolute/path/file.txt',
        });

        // Absolute paths should not be joined with workspaceDir
        expect(mockFs.access).toHaveBeenCalledWith('/absolute/path/file.txt');
      });

      it('should detect MIME type from filename', async () => {
        const file = mockFile({ mimeType: 'text/markdown' });
        repository.create.mockReturnValue(file);
        repository.save.mockResolvedValue(file);

        await service.createFromWriteTool({
          ...baseDto,
          originalPath: 'docs/readme.md',
        });

        expect(repository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            mimeType: 'text/markdown',
          }),
        );
      });

      it('should detect JSON MIME type', async () => {
        const file = mockFile({ mimeType: 'application/json' });
        repository.create.mockReturnValue(file);
        repository.save.mockResolvedValue(file);

        await service.createFromWriteTool({
          ...baseDto,
          originalPath: 'data/config.json',
        });

        expect(repository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            mimeType: 'application/json',
          }),
        );
      });

      it('should create storage directory with recursive option', async () => {
        const file = mockFile();
        repository.create.mockReturnValue(file);
        repository.save.mockResolvedValue(file);

        await service.createFromWriteTool(baseDto);

        expect(mockFs.mkdir).toHaveBeenCalledWith(
          expect.stringContaining('tenant-1'),
          { recursive: true },
        );
      });
    });

    describe('error handling', () => {
      it('should throw NotFoundException when source file missing', async () => {
        mockFs.access.mockRejectedValue(new Error('ENOENT: no such file'));

        await expect(service.createFromWriteTool(baseDto)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('should throw InternalServerErrorException when copy fails', async () => {
        mockFs.copyFile.mockRejectedValue(new Error('Permission denied'));

        await expect(service.createFromWriteTool(baseDto)).rejects.toThrow(
          InternalServerErrorException,
        );
      });
    });

    describe('field values', () => {
      it('should set status to "new" for new files', async () => {
        const file = mockFile({ status: 'new' });
        repository.create.mockReturnValue(file);
        repository.save.mockResolvedValue(file);

        const result = await service.createFromWriteTool(baseDto);

        expect(result.status).toBe('new');
      });

      it('should set uploadedBy to "agent"', async () => {
        const file = mockFile({ uploadedBy: 'agent' });
        repository.create.mockReturnValue(file);
        repository.save.mockResolvedValue(file);

        const result = await service.createFromWriteTool(baseDto);

        expect(result.uploadedBy).toBe('agent');
      });

      it('should store correct originalPath', async () => {
        const file = mockFile({ originalPath: 'docs/test.md' });
        repository.create.mockReturnValue(file);
        repository.save.mockResolvedValue(file);

        const result = await service.createFromWriteTool(baseDto);

        expect(result.originalPath).toBe('docs/test.md');
      });

      it('should store file size from stat', async () => {
        mockFs.stat.mockResolvedValue({ size: 4096 } as any);
        const file = mockFile({ size: 4096 });
        repository.create.mockReturnValue(file);
        repository.save.mockResolvedValue(file);

        await service.createFromWriteTool(baseDto);

        expect(repository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            size: 4096,
          }),
        );
      });
    });

    describe('tenantId handling', () => {
      it('should use provided tenantId', async () => {
        const file = mockFile({ tenantId: 'custom-tenant' });
        repository.create.mockReturnValue(file);
        repository.save.mockResolvedValue(file);

        await service.createFromWriteTool({
          ...baseDto,
          tenantId: 'custom-tenant',
        });

        expect(repository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId: 'custom-tenant',
          }),
        );
      });

      it('should use default tenant directory when tenantId not provided', async () => {
        const file = mockFile({ tenantId: null });
        repository.create.mockReturnValue(file);
        repository.save.mockResolvedValue(file);

        await service.createFromWriteTool({
          ...baseDto,
          tenantId: undefined,
        });

        expect(mockFs.mkdir).toHaveBeenCalledWith(
          expect.stringContaining('default'),
          { recursive: true },
        );
      });

      it('should set tenantId to null in record when not provided', async () => {
        const file = mockFile({ tenantId: null });
        repository.create.mockReturnValue(file);
        repository.save.mockResolvedValue(file);

        await service.createFromWriteTool({
          ...baseDto,
          tenantId: undefined,
        });

        expect(repository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId: null,
          }),
        );
      });
    });
  });

  describe('getSessionFilesAsTree', () => {
    it('should return empty array for session with no files', async () => {
      repository.find.mockResolvedValue([]);

      const result = await service.getSessionFilesAsTree('session-1');

      expect(result).toEqual([]);
      expect(repository.find).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
        order: { createdAt: 'ASC' },
      });
    });

    it('should build flat tree for root-level files', async () => {
      const files = [
        mockFile({ originalPath: 'file1.md', filename: 'file1.md' }),
        mockFile({ id: 'file-2', originalPath: 'file2.json', filename: 'file2.json' }),
      ];
      repository.find.mockResolvedValue(files);

      const result = await service.getSessionFilesAsTree('session-1');

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('file');
      expect(result[0].name).toBe('file1.md');
      expect(result[1].name).toBe('file2.json');
    });

    it('should build hierarchical tree from paths', async () => {
      const files = [
        mockFile({ originalPath: 'reports/q1/summary.md', filename: 'summary.md' }),
        mockFile({ id: 'file-2', originalPath: 'reports/q1/data.json', filename: 'data.json' }),
        mockFile({ id: 'file-3', originalPath: 'reports/q2/summary.md', filename: 'summary.md' }),
      ];
      repository.find.mockResolvedValue(files);

      const result = await service.getSessionFilesAsTree('session-1');

      // Should have one root folder: reports
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('folder');
      expect(result[0].name).toBe('reports');

      // reports should have two children: q1 and q2
      expect(result[0].children).toHaveLength(2);
      expect(result[0].children![0].name).toBe('q1');
      expect(result[0].children![1].name).toBe('q2');

      // q1 should have two files
      expect(result[0].children![0].children).toHaveLength(2);
    });

    it('should sort folders before files alphabetically', async () => {
      const files = [
        mockFile({ originalPath: 'zebra.md', filename: 'zebra.md' }),
        mockFile({ id: 'file-2', originalPath: 'alpha/file.md', filename: 'file.md' }),
        mockFile({ id: 'file-3', originalPath: 'apple.md', filename: 'apple.md' }),
      ];
      repository.find.mockResolvedValue(files);

      const result = await service.getSessionFilesAsTree('session-1');

      // Folder first, then files alphabetically
      expect(result[0].name).toBe('alpha'); // folder
      expect(result[1].name).toBe('apple.md'); // file
      expect(result[2].name).toBe('zebra.md'); // file
    });

    it('should handle paths with leading slashes', async () => {
      const files = [
        mockFile({ originalPath: '/reports/summary.md', filename: 'summary.md' }),
      ];
      repository.find.mockResolvedValue(files);

      const result = await service.getSessionFilesAsTree('session-1');

      expect(result[0].type).toBe('folder');
      expect(result[0].name).toBe('reports');
    });

    it('should include file metadata in tree nodes', async () => {
      const file = mockFile({
        originalPath: 'data.json',
        filename: 'data.json',
        status: 'modified',
        uploadedBy: 'user',
        size: 2048,
        mimeType: 'application/json',
      });
      repository.find.mockResolvedValue([file]);

      const result = await service.getSessionFilesAsTree('session-1');

      expect(result[0].fileId).toBe(file.id);
      expect(result[0].status).toBe('modified');
      expect(result[0].uploadedBy).toBe('user');
      expect(result[0].size).toBe(2048);
      expect(result[0].mimeType).toBe('application/json');
    });
  });

  describe('getFilePreview', () => {
    beforeEach(() => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({ size: 500 } as any);
    });

    it('should throw NotFoundException for non-existent file', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.getFilePreview('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when file content unavailable', async () => {
      repository.findOne.mockResolvedValue(mockFile());
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      await expect(service.getFilePreview('file-uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return utf8 encoded content for text files', async () => {
      const file = mockFile({ mimeType: 'text/markdown' });
      repository.findOne.mockResolvedValue(file);

      const mockHandle = {
        read: jest.fn().mockResolvedValue({ bytesRead: 12 }),
        close: jest.fn().mockResolvedValue(undefined),
      };
      mockFs.open.mockResolvedValue(mockHandle as any);

      const result = await service.getFilePreview('file-uuid-1');

      expect(result.encoding).toBe('utf8');
      expect(result.mimeType).toBe('text/markdown');
      expect(result.truncated).toBe(false);
    });

    it('should return base64 encoded content for images', async () => {
      const file = mockFile({ mimeType: 'image/png' });
      repository.findOne.mockResolvedValue(file);

      const mockHandle = {
        read: jest.fn().mockResolvedValue({ bytesRead: 100 }),
        close: jest.fn().mockResolvedValue(undefined),
      };
      mockFs.open.mockResolvedValue(mockHandle as any);

      const result = await service.getFilePreview('file-uuid-1');

      expect(result.encoding).toBe('base64');
      expect(result.mimeType).toBe('image/png');
    });

    it('should truncate large files', async () => {
      const file = mockFile();
      repository.findOne.mockResolvedValue(file);
      mockFs.stat.mockResolvedValue({ size: 200 * 1024 } as any); // 200KB

      const mockHandle = {
        read: jest.fn().mockResolvedValue({ bytesRead: 100 * 1024 }),
        close: jest.fn().mockResolvedValue(undefined),
      };
      mockFs.open.mockResolvedValue(mockHandle as any);

      const result = await service.getFilePreview('file-uuid-1'); // default 100KB limit

      expect(result.truncated).toBe(true);
      expect(result.size).toBe(200 * 1024);
    });

    it('should respect custom maxBytes parameter', async () => {
      const file = mockFile();
      repository.findOne.mockResolvedValue(file);
      mockFs.stat.mockResolvedValue({ size: 50 * 1024 } as any);

      const mockHandle = {
        read: jest.fn().mockResolvedValue({ bytesRead: 10 * 1024 }),
        close: jest.fn().mockResolvedValue(undefined),
      };
      mockFs.open.mockResolvedValue(mockHandle as any);

      await service.getFilePreview('file-uuid-1', 10 * 1024);

      expect(mockHandle.read).toHaveBeenCalledWith(
        expect.any(Buffer),
        0,
        10 * 1024,
        0,
      );
    });

    it('should recognize JSON as text file', async () => {
      const file = mockFile({ mimeType: 'application/json' });
      repository.findOne.mockResolvedValue(file);

      const mockHandle = {
        read: jest.fn().mockResolvedValue({ bytesRead: 50 }),
        close: jest.fn().mockResolvedValue(undefined),
      };
      mockFs.open.mockResolvedValue(mockHandle as any);

      const result = await service.getFilePreview('file-uuid-1');

      expect(result.encoding).toBe('utf8');
    });
  });

  describe('markAsSynced', () => {
    it('should throw NotFoundException for non-existent file', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.markAsSynced('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update file status to synced', async () => {
      const file = mockFile({ status: 'new' });
      repository.findOne.mockResolvedValue(file);
      repository.save.mockResolvedValue({ ...file, status: 'synced' });

      const result = await service.markAsSynced('file-uuid-1');

      expect(result.status).toBe('synced');
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'synced',
          downloadedAt: expect.any(Date),
        }),
      );
    });

    it('should set downloadedAt timestamp', async () => {
      const file = mockFile({ downloadedAt: null });
      repository.findOne.mockResolvedValue(file);
      repository.save.mockImplementation((f) => Promise.resolve(f as AgentFile));

      const before = new Date();
      const result = await service.markAsSynced('file-uuid-1');
      const after = new Date();

      expect(result.downloadedAt).toBeInstanceOf(Date);
      expect(result.downloadedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.downloadedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('uploadFile', () => {
    beforeEach(() => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should create file record with user uploadedBy', async () => {
      const buffer = Buffer.from('test content');
      repository.create.mockReturnValue(mockFile({ uploadedBy: 'user' }));
      repository.save.mockResolvedValue(mockFile({ uploadedBy: 'user' }));

      const result = await service.uploadFile(
        buffer,
        'test.txt',
        'session-1',
        'msg-1',
        'tenant-1',
      );

      expect(result.uploadedBy).toBe('user');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadedBy: 'user',
          status: 'new',
        }),
      );
    });

    it('should use filename as originalPath when no targetPath', async () => {
      const buffer = Buffer.from('content');
      repository.create.mockReturnValue(mockFile());
      repository.save.mockResolvedValue(mockFile());

      await service.uploadFile(buffer, 'document.pdf', 'session-1', 'msg-1');

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          originalPath: 'document.pdf',
          filename: 'document.pdf',
        }),
      );
    });

    it('should combine targetPath with filename', async () => {
      const buffer = Buffer.from('content');
      repository.create.mockReturnValue(mockFile());
      repository.save.mockResolvedValue(mockFile());

      await service.uploadFile(
        buffer,
        'document.pdf',
        'session-1',
        'msg-1',
        'tenant-1',
        'uploads/docs',
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          originalPath: path.join('uploads/docs', 'document.pdf'),
        }),
      );
    });

    it('should detect MIME type from filename', async () => {
      const buffer = Buffer.from('content');
      repository.create.mockReturnValue(mockFile({ mimeType: 'application/json' }));
      repository.save.mockResolvedValue(mockFile({ mimeType: 'application/json' }));

      await service.uploadFile(buffer, 'data.json', 'session-1', 'msg-1');

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mimeType: 'application/json',
        }),
      );
    });

    it('should create storage directory', async () => {
      const buffer = Buffer.from('content');
      repository.create.mockReturnValue(mockFile());
      repository.save.mockResolvedValue(mockFile());

      await service.uploadFile(buffer, 'test.txt', 'session-1', 'msg-1', 'tenant-1');

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('tenant-1'),
        { recursive: true },
      );
    });

    it('should throw InternalServerErrorException on write failure', async () => {
      const buffer = Buffer.from('content');
      mockFs.writeFile.mockRejectedValue(new Error('Disk full'));

      await expect(
        service.uploadFile(buffer, 'test.txt', 'session-1', 'msg-1'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should use default tenant when not provided', async () => {
      const buffer = Buffer.from('content');
      repository.create.mockReturnValue(mockFile({ tenantId: null }));
      repository.save.mockResolvedValue(mockFile());

      await service.uploadFile(buffer, 'test.txt', 'session-1', 'msg-1');

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('default'),
        { recursive: true },
      );
    });
  });

  describe('validateUpload', () => {
    const createMockMulterFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({
      fieldname: 'file',
      originalname: 'test.txt',
      encoding: '7bit',
      mimetype: 'text/plain',
      size: 1024,
      destination: '/tmp',
      filename: 'test.txt',
      path: '/tmp/test.txt',
      buffer: Buffer.from('test'),
      stream: {} as any,
      ...overrides,
    });

    it('should throw BadRequestException when no file provided', () => {
      expect(() => service.validateUpload(null as any)).toThrow(BadRequestException);
      expect(() => service.validateUpload(undefined as any)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException when file exceeds size limit', () => {
      const file = createMockMulterFile({ size: 20 * 1024 * 1024 }); // 20MB

      expect(() => service.validateUpload(file, 10 * 1024 * 1024)).toThrow(
        BadRequestException,
      );
    });

    it('should pass validation for file within size limit', () => {
      const file = createMockMulterFile({ size: 5 * 1024 * 1024 }); // 5MB

      expect(() => service.validateUpload(file, 10 * 1024 * 1024)).not.toThrow();
    });

    it('should throw BadRequestException for disallowed MIME type', () => {
      const file = createMockMulterFile({ mimetype: 'application/exe' });

      expect(() =>
        service.validateUpload(file, undefined, ['image/png', 'image/jpeg']),
      ).toThrow(BadRequestException);
    });

    it('should pass validation for allowed MIME type', () => {
      const file = createMockMulterFile({ mimetype: 'image/png' });

      expect(() =>
        service.validateUpload(file, undefined, ['image/png', 'image/jpeg']),
      ).not.toThrow();
    });

    it('should skip MIME type check when allowedTypes is empty', () => {
      const file = createMockMulterFile({ mimetype: 'application/anything' });

      expect(() => service.validateUpload(file, undefined, [])).not.toThrow();
    });
  });
});
