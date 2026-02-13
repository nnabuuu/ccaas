import {
  Controller,
  Get,
  Post,
  Param,
  Res,
  Body,
  Query,
  NotFoundException,
  StreamableFile,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { FilesService } from './files.service';
import { createReadStream } from 'fs';
import * as path from 'path';
import type {
  FileTreeNode,
  FilePreviewResponse,
  FileUploadResult,
} from './dto/file.dto';

@Controller('v1/files')
export class FilesController {
  private readonly workspaceBaseDir: string;

  constructor(private readonly filesService: FilesService) {
    this.workspaceBaseDir =
      process.env.WORKSPACE_DIR || './.agent-workspace';
  }

  /**
   * Get file metadata
   * GET /api/v1/files/:fileId
   */
  @Get(':fileId')
  async getFile(@Param('fileId') fileId: string): Promise<{
    id: string;
    filename: string;
    mimeType: string | null;
    size: number;
    sessionId: string;
    messageId: string | null;
    createdAt: Date;
    downloadUrl: string;
  }> {
    const file = await this.filesService.findById(fileId);
    if (!file) {
      throw new NotFoundException(`File ${fileId} not found`);
    }

    return {
      id: file.id,
      filename: file.filename,
      mimeType: file.mime_type,
      size: file.size,
      sessionId: file.session_id,
      messageId: file.message_id,
      createdAt: new Date(file.created_at),
      downloadUrl: `/api/v1/files/${file.id}/download`,
    };
  }

  /**
   * Download file
   * GET /api/v1/files/:fileId/download
   */
  @Get(':fileId/download')
  async downloadFile(
    @Param('fileId') fileId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.filesService.findByIdOrFail(fileId);

    // Check if file exists
    const exists = await this.filesService.fileExists(fileId);
    if (!exists) {
      throw new NotFoundException('File content not available');
    }

    const filePath = this.filesService.getFilePath(file);

    // Set response headers
    res.set({
      'Content-Type': file.mime_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.filename)}"`,
      'Content-Length': file.size,
    });

    // Stream the file
    const fileStream = createReadStream(filePath);
    return new StreamableFile(fileStream);
  }

  /**
   * Get all files for a session
   * GET /api/v1/files/session/:sessionId
   */
  @Get('session/:sessionId')
  async getSessionFiles(@Param('sessionId') sessionId: string): Promise<{
    files: Array<{
      id: string;
      filename: string;
      originalPath: string;
      mimeType: string | null;
      size: number;
      messageId: string | null;
      status: 'new' | 'modified' | 'synced';
      uploadedBy: 'agent' | 'user';
      createdAt: Date;
      downloadUrl: string;
    }>;
  }> {
    const files = await this.filesService.findBySessionId(sessionId);

    return {
      files: files.map((f) => ({
        id: f.id,
        filename: f.filename,
        originalPath: f.original_path,
        mimeType: f.mime_type,
        size: f.size,
        messageId: f.message_id,
        status: f.status,
        uploadedBy: f.uploaded_by,
        createdAt: new Date(f.created_at),
        downloadUrl: `/api/v1/files/${f.id}/download`,
      })),
    };
  }

  /**
   * Get session files as tree structure
   * GET /api/v1/files/session/:sessionId/tree
   */
  @Get('session/:sessionId/tree')
  async getSessionFilesTree(
    @Param('sessionId') sessionId: string,
    @Query('includeMessage') includeMessage?: string,
    @Query('scanFilesystem') scanFilesystem?: string,
    @Query('autoImport') autoImport?: string,
  ): Promise<{
    tree: FileTreeNode[];
    stats: {
      totalFiles: number;
      newFiles: number;
      trackedInDb: number;
      scannedFromFs: number;
    };
  }> {
    return this.filesService.getSessionFilesAsTree(sessionId, {
      includeMessage: includeMessage !== 'false', // Default true
      scanFilesystem: scanFilesystem !== 'false', // Default true
      autoImport: autoImport === 'true',          // Default false
    });
  }

  /**
   * Get file preview content
   * GET /api/v1/files/:fileId/preview
   */
  @Get(':fileId/preview')
  async getFilePreview(
    @Param('fileId') fileId: string,
    @Query('maxBytes') maxBytesStr?: string,
  ): Promise<FilePreviewResponse> {
    const maxBytes = maxBytesStr ? parseInt(maxBytesStr, 10) : undefined;
    return this.filesService.getFilePreview(fileId, maxBytes);
  }

  /**
   * Mark file as synced (downloaded)
   * POST /api/v1/files/:fileId/sync
   */
  @Post(':fileId/sync')
  async markFileAsSynced(
    @Param('fileId') fileId: string,
  ): Promise<{ success: boolean; status: string }> {
    const file = await this.filesService.markAsSynced(fileId);
    return { success: true, status: file.status };
  }

  /**
   * Upload a file
   * POST /api/v1/files/upload
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('sessionId') sessionId: string,
    @Body('messageId') messageId?: string,
    @Body('tenantId') tenantId?: string,
    @Body('targetPath') targetPath?: string,
  ): Promise<FileUploadResult> {
    // Validate input
    if (!sessionId) {
      throw new BadRequestException('sessionId is required');
    }

    // Validate file
    this.filesService.validateUpload(file);

    // Get session workspace directory
    const workspaceDir = path.join(
      this.workspaceBaseDir,
      'sessions',
      sessionId,
    );

    // For user uploads without chat context, pass null messageId
    return this.filesService.uploadFile(
      file.buffer,
      file.originalname,
      sessionId,
      messageId || null,
      tenantId,
      targetPath,
      workspaceDir, // Pass workspace directory for agent access
    );
  }

  /**
   * Get count of new files for a session (for badge indicator)
   * GET /api/v1/files/session/:sessionId/new-count
   */
  @Get('session/:sessionId/new-count')
  async getNewFilesCount(
    @Param('sessionId') sessionId: string,
  ): Promise<{
    count: number;
    files: {
      id: string;
      filename: string;
      createdAt: Date;
    }[];
  }> {
    const files = await this.filesService.findBySessionId(sessionId);
    const newFiles = files.filter((f) => f.status === 'new');
    return {
      count: newFiles.length,
      files: newFiles.map((f) => ({
        id: f.id,
        filename: f.filename,
        createdAt: new Date(f.created_at),
      })),
    };
  }

  /**
   * Mark all files in session as synced (clear badge)
   * POST /api/v1/files/session/:sessionId/mark-seen
   */
  @Post('session/:sessionId/mark-seen')
  async markAllFilesSeen(
    @Param('sessionId') sessionId: string,
  ): Promise<{ success: boolean; markedCount: number }> {
    const markedCount = await this.filesService.markAllFilesSeen(sessionId);

    return {
      success: true,
      markedCount,
    };
  }

  /**
   * Get message info (for frontend跳转)
   * GET /api/v1/files/messages/:messageId
   */
  @Get('messages/:messageId')
  async getMessageInfo(@Param('messageId') messageId: string): Promise<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: Date;
    files: string[];
  }> {
    return this.filesService.getMessageInfo(messageId);
  }
}
