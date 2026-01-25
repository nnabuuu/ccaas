import {
  Controller,
  Get,
  Post,
  Param,
  Res,
  Body,
  Query,
  ParseUUIDPipe,
  NotFoundException,
  StreamableFile,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { FilesService } from './files.service';
import { createReadStream } from 'fs';
import type { FileTreeNode, FilePreviewResponse, FileUploadResult } from './dto/file.dto';

@Controller('api/v1/files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * Get file metadata
   * GET /api/v1/files/:fileId
   */
  @Get(':fileId')
  async getFile(@Param('fileId', ParseUUIDPipe) fileId: string): Promise<{
    id: string;
    filename: string;
    mimeType: string | null;
    size: number;
    sessionId: string;
    messageId: string;
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
      mimeType: file.mimeType,
      size: file.size,
      sessionId: file.sessionId,
      messageId: file.messageId,
      createdAt: file.createdAt,
      downloadUrl: `/api/v1/files/${file.id}/download`,
    };
  }

  /**
   * Download file
   * GET /api/v1/files/:fileId/download
   */
  @Get(':fileId/download')
  async downloadFile(
    @Param('fileId', ParseUUIDPipe) fileId: string,
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
      'Content-Type': file.mimeType || 'application/octet-stream',
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
      messageId: string;
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
        originalPath: f.originalPath,
        mimeType: f.mimeType,
        size: f.size,
        messageId: f.messageId,
        status: f.status,
        uploadedBy: f.uploadedBy,
        createdAt: f.createdAt,
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
  ): Promise<{ tree: FileTreeNode[] }> {
    const tree = await this.filesService.getSessionFilesAsTree(sessionId);
    return { tree };
  }

  /**
   * Get file preview content
   * GET /api/v1/files/:fileId/preview
   */
  @Get(':fileId/preview')
  async getFilePreview(
    @Param('fileId', ParseUUIDPipe) fileId: string,
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
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ): Promise<{ success: boolean; status: string }> {
    const file = await this.filesService.markAsSynced(fileId);
    return { success: true, status: file.status };
  }

  /**
   * Upload a file
   * POST /api/v1/files/upload
   *
   * messageId is optional - if not provided, a placeholder will be used for user uploads
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
      throw new NotFoundException('sessionId is required');
    }

    // Validate file
    this.filesService.validateUpload(file);

    // Use placeholder messageId for user uploads without chat context
    const effectiveMessageId = messageId || `user-upload-${Date.now()}`;

    return this.filesService.uploadFile(
      file.buffer,
      file.originalname,
      sessionId,
      effectiveMessageId,
      tenantId,
      targetPath,
    );
  }
}
