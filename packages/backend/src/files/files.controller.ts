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
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { OptionalAuth } from '../auth/decorators';
import { Response } from 'express';
import { FilesService } from './files.service';
import { SessionService } from '../sessions/session.service';
import { createReadStream } from 'fs';
import * as path from 'path';
import type {
  FileTreeNode,
  FilePreviewResponse,
  FileUploadResult,
  CreateFileVersionDto,
  FileVersionResponse,
  RollbackFileDto,
  CompareVersionsResponse,
  NewFilesCountResponse,
} from './dto/file.dto';

@OptionalAuth()
@ApiTags('files')
@Controller('api/v1/files')
export class FilesController {
  private readonly workspaceBaseDir: string;

  constructor(
    private readonly filesService: FilesService,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
  ) {
    this.workspaceBaseDir = this.configService.get('workspace.dir', '.agent-workspace');
  }

  /**
   * Get file metadata
   * GET /api/v1/files/:fileId
   */
  @Get(':fileId')
  @ApiOperation({
    summary: '获取文件元数据 / Get File Metadata',
    description: '获取文件的元数据信息（不包含文件内容）/ Get file metadata without content',
  })
  @ApiParam({
    name: 'fileId',
    description: '文件 ID / File ID',
  })
  @ApiResponse({
    status: 200,
    description: '文件元数据 / File metadata',
  })
  @ApiResponse({
    status: 404,
    description: '文件不存在 / File not found',
  })
  async getFile(@Param('fileId', ParseUUIDPipe) fileId: string): Promise<{
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
  @ApiOperation({
    summary: '下载文件 / Download File',
    description: '下载文件内容（流式传输）/ Download file content as stream',
  })
  @ApiParam({
    name: 'fileId',
    description: '文件 ID / File ID',
  })
  @ApiResponse({
    status: 200,
    description: '文件流 / File stream',
  })
  @ApiResponse({
    status: 404,
    description: '文件不存在 / File not found',
  })
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
   * Register a file from session workspace (for MCP servers)
   * POST /api/v1/files/register
   */
  @Post('register')
  async registerFile(
    @Body() dto: {
      originalPath: string;   // Absolute path in session workspace
      sessionId?: string;     // Session context
      messageId?: string;     // Optional message context
      solutionId?: string;      // Optional tenant
    },
  ): Promise<{
    fileId: string;
    filename: string;
    downloadUrl: string;
  }> {
    // Get or create session workspace
    const workspaceDir = dto.sessionId
      ? path.join(this.workspaceBaseDir, 'sessions', dto.sessionId)
      : path.dirname(dto.originalPath);

    // Create AgentFile record and copy to persistent storage
    const file = await this.filesService.createFromSessionFile({
      sessionId: dto.sessionId || 'unknown',
      messageId: dto.messageId || null,
      solutionId: dto.solutionId,
      originalPath: dto.originalPath,
      workspaceDir,
    });

    return {
      fileId: file.id,
      filename: file.filename,
      downloadUrl: `http://localhost:3001/api/v1/files/${file.id}/download`,
    };
  }

  /**
   * Upload a file
   * POST /api/v1/files/upload
   *
   * messageId is optional - if not provided, a placeholder will be used for user uploads
   *
   * Files are written to:
   * 1. Session workspace (for agent access): .agent-workspace/sessions/{sessionId}/{targetPath}/{filename}
   * 2. Persistent storage (for versioning): .agent-workspace/files/{solutionId}/{messageId}/{filename}
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: '上传文件 / Upload File',
    description: `
上传文件到会话工作区，Agent 可以读取和处理这些文件。

**文件存储位置：**
1. 会话工作区（Agent 可访问）: \`.agent-workspace/sessions/{sessionId}/{targetPath}/{filename}\`
2. 持久化存储（版本控制）: \`.agent-workspace/files/{solutionId}/{messageId}/{filename}\`

**支持的文件类型：**
- 图片：png, jpg, jpeg, gif, webp（最大 10MB）
- 文档：pdf, txt, md, json, csv（最大 50MB）
- 代码：js, ts, py, java, go, etc.

**English:**
Upload files to session workspace for agent processing.
    `,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'sessionId'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '文件内容 / File content',
        },
        sessionId: {
          type: 'string',
          description: '会话 ID / Session ID',
          example: 'session-123',
        },
        messageId: {
          type: 'string',
          description: '消息 ID（可选）/ Message ID (optional)',
        },
        solutionId: {
          type: 'string',
          description: '租户 ID（可选）/ Solution ID (optional)',
        },
        targetPath: {
          type: 'string',
          description: '目标路径（可选，相对于工作区）/ Target path (optional, relative to workspace)',
          example: 'images',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '文件上传成功 / File uploaded successfully',
  })
  @ApiResponse({
    status: 400,
    description: '请求参数错误 / Bad request',
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('sessionId') sessionId: string,
    @Body('messageId') messageId?: string,
    @Body('solutionId') solutionId?: string,
    @Body('targetPath') targetPath?: string,
  ): Promise<FileUploadResult> {
    // Validate input
    if (!sessionId) {
      throw new NotFoundException('sessionId is required');
    }

    // Validate file
    this.filesService.validateUpload(file);

    // Get session workspace directory
    // If session doesn't exist in SessionService yet, construct the path directly
    // This allows file uploads before the first chat message creates the session
    const session = this.sessionService.getSession(sessionId);
    const workspaceDir = session?.workspaceDir ||
      path.join(this.workspaceBaseDir, 'sessions', sessionId);

    // For user uploads without chat context, pass null messageId
    return this.filesService.uploadFile(
      file.buffer,
      file.originalname,
      sessionId,
      messageId || null,
      solutionId,
      targetPath,
      workspaceDir, // Pass workspace directory for agent access
    );
  }

  // ==========================================
  // VERSION CONTROL ENDPOINTS
  // ==========================================

  /**
   * Create a new version of a file
   * POST /api/v1/files/:fileId/versions
   */
  @Post(':fileId/versions')
  @ApiOperation({
    summary: '创建文件版本 / Create File Version',
    description: '为文件创建新版本快照 / Create a new version snapshot for the file',
  })
  @ApiParam({
    name: 'fileId',
    description: '文件 ID / File ID',
  })
  @ApiResponse({
    status: 201,
    description: '版本创建成功 / Version created successfully',
  })
  async createFileVersion(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Body() dto: CreateFileVersionDto,
  ): Promise<FileVersionResponse> {
    const version = await this.filesService.createVersion(fileId, dto);
    return {
      id: version.id,
      fileId: version.fileId,
      version: version.version,
      contentHash: version.contentHash,
      size: version.size,
      mimeType: version.mimeType,
      changelog: version.changelog,
      uploadedBy: version.uploadedBy,
      createdAt: version.createdAt,
    };
  }

  /**
   * List versions of a file
   * GET /api/v1/files/:fileId/versions
   */
  @Get(':fileId/versions')
  @ApiOperation({
    summary: '获取文件版本列表 / List File Versions',
    description: '获取文件的所有版本历史 / Get all version history for the file',
  })
  @ApiParam({
    name: 'fileId',
    description: '文件 ID / File ID',
  })
  @ApiResponse({
    status: 200,
    description: '版本列表 / Version list',
  })
  async listFileVersions(
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ): Promise<FileVersionResponse[]> {
    const versions = await this.filesService.listVersions(fileId);
    return versions.map((v) => ({
      id: v.id,
      fileId: v.fileId,
      version: v.version,
      contentHash: v.contentHash,
      size: v.size,
      mimeType: v.mimeType,
      changelog: v.changelog,
      uploadedBy: v.uploadedBy,
      createdAt: v.createdAt,
    }));
  }

  /**
   * Get a specific version
   * GET /api/v1/files/:fileId/versions/:version
   */
  @Get(':fileId/versions/:version')
  @ApiOperation({
    summary: '获取指定版本 / Get Specific Version',
    description: '获取文件的指定版本信息 / Get specific version info',
  })
  @ApiParam({
    name: 'fileId',
    description: '文件 ID / File ID',
  })
  @ApiParam({
    name: 'version',
    description: '版本号 / Version number',
    example: '1.0.0',
  })
  async getFileVersion(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Param('version') version: string,
  ): Promise<FileVersionResponse> {
    const v = await this.filesService.getVersion(fileId, version);
    return {
      id: v.id,
      fileId: v.fileId,
      version: v.version,
      contentHash: v.contentHash,
      size: v.size,
      mimeType: v.mimeType,
      changelog: v.changelog,
      uploadedBy: v.uploadedBy,
      createdAt: v.createdAt,
    };
  }

  /**
   * Download a specific version
   * GET /api/v1/files/:fileId/versions/:version/download
   */
  @Get(':fileId/versions/:version/download')
  @ApiOperation({
    summary: '下载指定版本 / Download Specific Version',
    description: '下载文件的指定版本内容 / Download specific version content',
  })
  @ApiParam({
    name: 'fileId',
    description: '文件 ID / File ID',
  })
  @ApiParam({
    name: 'version',
    description: '版本号 / Version number',
  })
  async downloadFileVersion(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Param('version') version: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { content, filename, mimeType } =
      await this.filesService.getVersionContent(fileId, version);

    res.set({
      'Content-Type': mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    return new StreamableFile(content);
  }

  /**
   * Rollback to a specific version
   * POST /api/v1/files/:fileId/rollback
   */
  @Post(':fileId/rollback')
  @ApiOperation({
    summary: '回滚文件版本 / Rollback File Version',
    description: '将文件回滚到指定版本（会创建新版本记录）/ Rollback file to specific version (creates new version record)',
  })
  @ApiParam({
    name: 'fileId',
    description: '文件 ID / File ID',
  })
  @ApiResponse({
    status: 200,
    description: '回滚成功 / Rollback successful',
  })
  async rollbackFile(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Body() dto: RollbackFileDto,
  ): Promise<{ success: boolean; currentVersion: string }> {
    const file = await this.filesService.rollbackToVersion(
      fileId,
      dto.targetVersion,
    );
    return {
      success: true,
      currentVersion: file.currentVersion,
    };
  }

  /**
   * Compare two versions
   * GET /api/v1/files/:fileId/versions/compare
   */
  @Get(':fileId/versions/compare')
  @ApiOperation({
    summary: '比较两个版本 / Compare Two Versions',
    description: '比较文件的两个版本之间的差异 / Compare differences between two versions',
  })
  @ApiParam({
    name: 'fileId',
    description: '文件 ID / File ID',
  })
  @ApiQuery({
    name: 'from',
    description: '起始版本号 / From version',
    example: '1.0.0',
  })
  @ApiQuery({
    name: 'to',
    description: '目标版本号 / To version',
    example: '1.0.1',
  })
  async compareFileVersions(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Query('from') fromVersion: string,
    @Query('to') toVersion: string,
  ): Promise<CompareVersionsResponse> {
    const comparison = await this.filesService.compareVersions(
      fileId,
      fromVersion,
      toVersion,
    );
    return {
      from: {
        id: comparison.from.id,
        fileId: comparison.from.fileId,
        version: comparison.from.version,
        contentHash: comparison.from.contentHash,
        size: comparison.from.size,
        mimeType: comparison.from.mimeType,
        changelog: comparison.from.changelog,
        uploadedBy: comparison.from.uploadedBy,
        createdAt: comparison.from.createdAt,
      },
      to: {
        id: comparison.to.id,
        fileId: comparison.to.fileId,
        version: comparison.to.version,
        contentHash: comparison.to.contentHash,
        size: comparison.to.size,
        mimeType: comparison.to.mimeType,
        changelog: comparison.to.changelog,
        uploadedBy: comparison.to.uploadedBy,
        createdAt: comparison.to.createdAt,
      },
      sizeDiff: comparison.sizeDiff,
      hashChanged: comparison.hashChanged,
    };
  }

  /**
   * Get count of new files for a session (for badge indicator)
   * GET /api/v1/files/session/:sessionId/new-count
   */
  @Get('session/:sessionId/new-count')
  @ApiOperation({
    summary: '获取新文件数量 / Get New Files Count',
    description: '获取会话中状态为 "new" 的文件数量（用于徽章指示器）/ Get count of files with "new" status for badge indicator',
  })
  @ApiParam({
    name: 'sessionId',
    description: '会话 ID / Session ID',
  })
  @ApiResponse({
    status: 200,
    description: '新文件数量 / New files count',
  })
  async getNewFilesCount(
    @Param('sessionId') sessionId: string,
  ): Promise<NewFilesCountResponse> {
    const files = await this.filesService.findBySessionId(sessionId);
    const newFiles = files.filter((f) => f.status === 'new');
    return {
      count: newFiles.length,
      files: newFiles.map((f) => ({
        id: f.id,
        filename: f.filename,
        createdAt: f.createdAt,
      })),
    };
  }

  /**
   * Mark all files in session as synced (clear badge)
   * POST /api/v1/files/session/:sessionId/mark-seen
   */
  @Post('session/:sessionId/mark-seen')
  @ApiOperation({
    summary: '标记所有文件为已查看 / Mark All Files as Seen',
    description: '将会话中所有 "new" 状态的文件标记为 "synced"（清除徽章）/ Mark all "new" files as "synced" (clear badge)',
  })
  @ApiParam({
    name: 'sessionId',
    description: '会话 ID / Session ID',
  })
  @ApiResponse({
    status: 200,
    description: '标记成功 / Marked successfully',
  })
  async markAllFilesSeen(
    @Param('sessionId') sessionId: string,
  ): Promise<{ success: boolean; markedCount: number }> {
    const files = await this.filesService.findBySessionId(sessionId);
    const newFiles = files.filter((f) => f.status === 'new');

    // Mark each new file as synced
    for (const file of newFiles) {
      await this.filesService.markAsSynced(file.id);
    }

    return {
      success: true,
      markedCount: newFiles.length,
    };
  }
}
