import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgentFile } from './entities/agent-file.entity';
import { FileVersion } from './entities/file-version.entity';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { lookup as mimeLookup } from 'mime-types';
import type { FileTreeNode, FilePreviewResponse, FileUploadResult } from './dto/file.dto';

export interface CreateFromWriteToolDto {
  messageId: string;
  sessionId: string;
  solutionId?: string;
  originalPath: string; // Path from Write tool (could be absolute or relative)
  workspaceDir: string; // Session workspace directory
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly persistentStorageBase: string;

  constructor(
    @InjectRepository(AgentFile)
    private readonly fileRepository: Repository<AgentFile>,
    @InjectRepository(FileVersion)
    private readonly versionRepository: Repository<FileVersion>,
    private readonly eventEmitter: EventEmitter2,
  ) {
    // Persistent storage location
    this.persistentStorageBase =
      process.env.FILE_STORAGE_PATH || '.agent-workspace/files';
  }

  /**
   * Create a file record from session workspace (for MCP servers)
   */
  async createFromSessionFile(dto: {
    sessionId: string;
    messageId: string | null;
    solutionId?: string;
    originalPath: string;
    workspaceDir: string;
  }): Promise<AgentFile> {
    const { messageId, sessionId, solutionId, originalPath, workspaceDir } = dto;

    // Resolve the source file path
    const sourcePath = path.isAbsolute(originalPath)
      ? originalPath
      : path.join(workspaceDir, originalPath);

    // Check if file exists
    try {
      await fs.access(sourcePath);
    } catch {
      this.logger.warn(`File not found at ${sourcePath}`);
      throw new NotFoundException(`File not found: ${originalPath}`);
    }

    // Get file stats
    const stats = await fs.stat(sourcePath);
    const filename = path.basename(originalPath);
    const mimeType = mimeLookup(filename) || null;

    // Create persistent storage path: files/{solutionId}/{messageId}/{filename}
    const tenantDir = solutionId || 'default';
    const storedDir = path.join(
      this.persistentStorageBase,
      tenantDir,
      messageId || 'mcp-generated',
    );
    const storedPath = path.join(storedDir, filename);

    // Ensure directory exists
    await fs.mkdir(storedDir, { recursive: true });

    // Copy file to persistent storage
    try {
      await fs.copyFile(sourcePath, storedPath);
      this.logger.debug(`Copied file from ${sourcePath} to ${storedPath}`);
    } catch (error) {
      this.logger.error(`Failed to copy file: ${error.message}`);
      throw new InternalServerErrorException('Failed to copy file to storage');
    }

    // Create database record
    const agentFile = this.fileRepository.create({
      messageId: messageId || null,
      sessionId,
      solutionId: solutionId || null,
      originalPath,
      storedPath,
      filename,
      mimeType,
      size: stats.size,
      uploadedBy: 'agent' as const,
      status: 'new' as const,
    });

    const saved = await this.fileRepository.save(agentFile);
    this.logger.log(
      `Created file record ${saved.id} for ${filename} (${stats.size} bytes)`,
    );

    // Emit file created event for real-time updates
    this.eventEmitter.emit('file.created', {
      fileId: saved.id,
      sessionId: saved.sessionId,
      solutionId: saved.solutionId,
      filename: saved.filename,
      status: saved.status,
      uploadedBy: saved.uploadedBy,
    });

    return saved;
  }

  /**
   * Create a file record from Write tool result
   * Copies the file from session workspace to persistent storage
   */
  async createFromWriteTool(dto: CreateFromWriteToolDto): Promise<AgentFile> {
    const { messageId, sessionId, solutionId, originalPath, workspaceDir } = dto;

    // Resolve the source file path
    const sourcePath = path.isAbsolute(originalPath)
      ? originalPath
      : path.join(workspaceDir, originalPath);

    // Check if file exists
    try {
      await fs.access(sourcePath);
    } catch {
      this.logger.warn(
        `File not found at ${sourcePath}, skipping file tracking`,
      );
      throw new NotFoundException(`File not found: ${originalPath}`);
    }

    // Get file stats
    const stats = await fs.stat(sourcePath);
    const filename = path.basename(originalPath);
    const mimeType = mimeLookup(filename) || null;

    // Create persistent storage path: files/{solutionId}/{messageId}/{filename}
    const tenantDir = solutionId || 'default';
    const storedDir = path.join(
      this.persistentStorageBase,
      tenantDir,
      messageId,
    );
    const storedPath = path.join(storedDir, filename);

    // Ensure directory exists
    await fs.mkdir(storedDir, { recursive: true });

    // Copy file to persistent storage
    try {
      await fs.copyFile(sourcePath, storedPath);
      this.logger.debug(`Copied file from ${sourcePath} to ${storedPath}`);
    } catch (error) {
      this.logger.error(`Failed to copy file: ${error.message}`);
      throw new InternalServerErrorException('Failed to copy file to storage');
    }

    // Create database record
    const agentFile = this.fileRepository.create({
      messageId,
      sessionId,
      solutionId: solutionId || null,
      originalPath,
      storedPath,
      filename,
      mimeType,
      size: stats.size,
    });

    const saved = await this.fileRepository.save(agentFile);
    this.logger.log(
      `Created file record ${saved.id} for ${filename} (${stats.size} bytes)`,
    );

    // Emit file created event for real-time updates
    this.eventEmitter.emit('file.created', {
      fileId: saved.id,
      sessionId: saved.sessionId,
      solutionId: saved.solutionId,
      filename: saved.filename,
      status: saved.status,
      uploadedBy: saved.uploadedBy,
    });

    return saved;
  }

  /**
   * Find a file by ID
   */
  async findById(id: string): Promise<AgentFile | null> {
    return this.fileRepository.findOne({ where: { id } });
  }

  /**
   * Find a file by ID or throw
   */
  async findByIdOrFail(id: string): Promise<AgentFile> {
    const file = await this.findById(id);
    if (!file) {
      throw new NotFoundException(`File ${id} not found`);
    }
    return file;
  }

  /**
   * Find all files for a message
   */
  async findByMessageId(messageId: string): Promise<AgentFile[]> {
    return this.fileRepository.find({
      where: { messageId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Find all files for a session
   */
  async findBySessionId(sessionId: string): Promise<AgentFile[]> {
    return this.fileRepository.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get file content for download
   */
  async getFileContent(id: string): Promise<{
    content: Buffer;
    filename: string;
    mimeType: string | null;
    size: number;
  }> {
    const file = await this.findByIdOrFail(id);

    try {
      const content = await fs.readFile(file.storedPath);
      return {
        content,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
      };
    } catch (error) {
      this.logger.error(
        `Failed to read file ${file.storedPath}: ${error.message}`,
      );
      throw new NotFoundException('File content not available');
    }
  }

  /**
   * Get file stream for large file download
   */
  getFilePath(file: AgentFile): string {
    return file.storedPath;
  }

  /**
   * Delete a file record and its stored content
   */
  async delete(id: string): Promise<void> {
    const file = await this.findByIdOrFail(id);

    // Delete stored file
    try {
      await fs.unlink(file.storedPath);
      this.logger.debug(`Deleted stored file ${file.storedPath}`);
    } catch (error) {
      this.logger.warn(
        `Failed to delete stored file ${file.storedPath}: ${error.message}`,
      );
    }

    // Delete database record
    await this.fileRepository.delete(id);
    this.logger.debug(`Deleted file record ${id}`);
  }

  /**
   * Delete all files for a session
   */
  async deleteBySessionId(sessionId: string): Promise<number> {
    const files = await this.findBySessionId(sessionId);

    // Delete stored files
    for (const file of files) {
      try {
        await fs.unlink(file.storedPath);
      } catch {
        // Ignore errors for individual file deletions
      }
    }

    // Delete database records
    const result = await this.fileRepository.delete({ sessionId });
    this.logger.debug(
      `Deleted ${result.affected} file records for session ${sessionId}`,
    );

    return result.affected || 0;
  }

  /**
   * Check if a file exists in storage
   */
  async fileExists(id: string): Promise<boolean> {
    const file = await this.findById(id);
    if (!file) return false;

    try {
      await fs.access(file.storedPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get session files organized as a tree structure
   */
  async getSessionFilesAsTree(sessionId: string): Promise<FileTreeNode[]> {
    const files = await this.findBySessionId(sessionId);
    return this.buildFileTree(files);
  }

  /**
   * Build a hierarchical file tree from flat file list
   */
  private buildFileTree(files: AgentFile[]): FileTreeNode[] {
    const root: FileTreeNode[] = [];
    const folderMap = new Map<string, FileTreeNode>();

    for (const file of files) {
      // Normalize path - remove leading slash and split
      const normalizedPath = file.originalPath.replace(/^\/+/, '');
      const pathParts = normalizedPath.split('/').filter(Boolean);
      const fileName = pathParts.pop()!;

      let currentLevel = root;
      let currentPath = '';

      // Create/find parent folders
      for (const folderName of pathParts) {
        currentPath += '/' + folderName;
        let folder = folderMap.get(currentPath);
        if (!folder) {
          folder = {
            id: `folder-${currentPath}`,
            name: folderName,
            type: 'folder',
            path: currentPath,
            children: [],
          };
          folderMap.set(currentPath, folder);
          currentLevel.push(folder);
        }
        currentLevel = folder.children!;
      }

      // Add file node
      currentLevel.push({
        id: `file-${file.id}`,
        name: fileName,
        type: 'file',
        path: file.originalPath,
        fileId: file.id,
        mimeType: file.mimeType || undefined,
        size: file.size,
        status: file.status,
        uploadedBy: file.uploadedBy,
        createdAt: file.createdAt,
      });
    }

    // Sort each level: folders first, then files, alphabetically
    const sortLevel = (nodes: FileTreeNode[]) => {
      nodes.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      for (const node of nodes) {
        if (node.children) {
          sortLevel(node.children);
        }
      }
    };
    sortLevel(root);

    return root;
  }

  /**
   * Get file preview content
   */
  async getFilePreview(
    id: string,
    maxBytes = 100 * 1024, // Default 100KB limit
  ): Promise<FilePreviewResponse> {
    const file = await this.findByIdOrFail(id);

    // Check if file exists
    const exists = await this.fileExists(id);
    if (!exists) {
      throw new NotFoundException('File content not available');
    }

    // Determine encoding based on MIME type
    const isText = this.isTextFile(file.mimeType);
    const isImage = file.mimeType?.startsWith('image/');

    try {
      const stats = await fs.stat(file.storedPath);
      const actualSize = stats.size;
      const truncated = actualSize > maxBytes;
      const readSize = truncated ? maxBytes : actualSize;

      if (isImage) {
        // For images, return base64 encoded content
        const buffer = await this.readFilePartial(file.storedPath, readSize);
        return {
          content: buffer.toString('base64'),
          truncated,
          encoding: 'base64',
          mimeType: file.mimeType || 'application/octet-stream',
          size: actualSize,
        };
      } else if (isText) {
        // For text files, return UTF-8 content
        const buffer = await this.readFilePartial(file.storedPath, readSize);
        return {
          content: buffer.toString('utf8'),
          truncated,
          encoding: 'utf8',
          mimeType: file.mimeType || 'text/plain',
          size: actualSize,
        };
      } else {
        // For binary files, return base64
        const buffer = await this.readFilePartial(file.storedPath, readSize);
        return {
          content: buffer.toString('base64'),
          truncated,
          encoding: 'base64',
          mimeType: file.mimeType || 'application/octet-stream',
          size: actualSize,
        };
      }
    } catch (error) {
      this.logger.error(`Failed to read file preview: ${error.message}`);
      throw new InternalServerErrorException('Failed to read file preview');
    }
  }

  /**
   * Read partial file content
   */
  private async readFilePartial(
    filePath: string,
    maxBytes: number,
  ): Promise<Buffer> {
    const handle = await fs.open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(maxBytes);
      const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  /**
   * Check if MIME type indicates a text file
   */
  private isTextFile(mimeType: string | null): boolean {
    if (!mimeType) return false;
    return (
      mimeType.startsWith('text/') ||
      mimeType === 'application/json' ||
      mimeType === 'application/javascript' ||
      mimeType === 'application/typescript' ||
      mimeType === 'application/xml' ||
      mimeType === 'application/x-yaml' ||
      mimeType === 'application/x-sh'
    );
  }

  /**
   * Mark a file as synced (downloaded by user)
   */
  async markAsSynced(fileId: string): Promise<AgentFile> {
    const file = await this.findByIdOrFail(fileId);

    file.status = 'synced';
    file.downloadedAt = new Date();

    return this.fileRepository.save(file);
  }

  /**
   * Upload a file from user
   *
   * Files are written to two locations:
   * 1. Session workspace (for agent access): workspaceDir/{targetPath}/{filename}
   * 2. Persistent storage (for versioning): .agent-workspace/files/{solutionId}/{subDir}/{filename}
   *
   * @param fileBuffer - The file content
   * @param originalFilename - Original filename from upload
   * @param sessionId - Session ID
   * @param messageId - Message ID (null for pre-chat uploads)
   * @param solutionId - Solution ID (optional)
   * @param targetPath - Target path within workspace (optional)
   * @param workspaceDir - Session workspace directory (optional, for agent access)
   */
  async uploadFile(
    fileBuffer: Buffer,
    originalFilename: string,
    sessionId: string,
    messageId: string | null,
    solutionId?: string,
    targetPath?: string,
    workspaceDir?: string,
  ): Promise<FileUploadResult> {
    const filename = path.basename(originalFilename);
    const mimeType = mimeLookup(filename) || null;

    // Determine the virtual path (relative path in workspace)
    const originalPath = targetPath
      ? path.join(targetPath, filename)
      : filename;

    // ==========================================
    // STEP 1: Write to session workspace FIRST
    // (So agent can access the file immediately)
    // ==========================================
    if (workspaceDir) {
      const workspacePath = path.join(workspaceDir, originalPath);
      const workspaceParentDir = path.dirname(workspacePath);

      await fs.mkdir(workspaceParentDir, { recursive: true });
      await fs.writeFile(workspacePath, fileBuffer);

      this.logger.debug(`Uploaded file to workspace: ${workspacePath}`);
    }

    // ==========================================
    // STEP 2: Copy to persistent storage
    // (For version history, survives session cleanup)
    // ==========================================
    const tenantDir = solutionId || 'default';
    const subDir = messageId || `session-${sessionId}`;
    const storedDir = path.join(
      this.persistentStorageBase,
      tenantDir,
      subDir,
    );
    const storedPath = path.join(storedDir, filename);

    await fs.mkdir(storedDir, { recursive: true });

    try {
      await fs.writeFile(storedPath, fileBuffer);
      this.logger.debug(`Stored file version: ${storedPath}`);
    } catch (error) {
      this.logger.error(`Failed to store file version: ${error.message}`);
      throw new InternalServerErrorException('Failed to store uploaded file');
    }

    // ==========================================
    // STEP 3: Create database record
    // ==========================================
    const agentFile = this.fileRepository.create({
      messageId,
      sessionId,
      solutionId: solutionId || null,
      originalPath,
      storedPath,
      filename,
      mimeType,
      size: fileBuffer.length,
      status: 'new',
      uploadedBy: 'user',
    });

    const saved = await this.fileRepository.save(agentFile);
    this.logger.log(
      `Created user upload record ${saved.id} for ${filename} (${saved.size} bytes)`,
    );

    // Emit file created event for real-time updates
    this.eventEmitter.emit('file.created', {
      fileId: saved.id,
      sessionId: saved.sessionId,
      solutionId: saved.solutionId,
      filename: saved.filename,
      status: saved.status,
      uploadedBy: saved.uploadedBy,
    });

    return {
      id: saved.id,
      filename: saved.filename,
      originalPath: saved.originalPath,
      mimeType: saved.mimeType,
      size: saved.size,
      status: saved.status,
      uploadedBy: saved.uploadedBy,
      createdAt: saved.createdAt,
    };
  }

  /**
   * Validate file upload
   */
  validateUpload(
    file: Express.Multer.File,
    maxSizeBytes = 10 * 1024 * 1024, // Default 10MB
    allowedTypes?: string[],
  ): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > maxSizeBytes) {
      throw new BadRequestException(
        `File size exceeds limit of ${Math.round(maxSizeBytes / 1024 / 1024)}MB`,
      );
    }

    if (allowedTypes && allowedTypes.length > 0) {
      const mimeType = file.mimetype;
      if (!allowedTypes.includes(mimeType)) {
        throw new BadRequestException(
          `File type ${mimeType} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
        );
      }
    }
  }

  // ==========================================
  // VERSION CONTROL METHODS
  // ==========================================

  /**
   * Create a new version of a file
   *
   * This method creates a snapshot of the current file state.
   * Used when:
   * - File is modified by agent or user
   * - User explicitly requests to create a version
   * - Automatic versioning is enabled
   */
  async createVersion(
    fileId: string,
    dto?: {
      version?: string;
      bumpType?: 'major' | 'minor' | 'patch';
      changelog?: string;
    },
  ): Promise<FileVersion> {
    const file = await this.findByIdOrFail(fileId);

    // Check if file content exists
    const exists = await this.fileExists(fileId);
    if (!exists) {
      throw new NotFoundException('File content not available for versioning');
    }

    // Read file content and calculate hash
    const content = await fs.readFile(file.storedPath);
    const contentHash = crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');

    // Determine version number
    let version: string;
    if (dto?.version) {
      version = dto.version;
    } else {
      // Auto-increment version based on bumpType
      const currentVersion = file.currentVersion || '1.0.0';
      version = this.bumpVersion(currentVersion, dto?.bumpType || 'patch');
    }

    // Check if version already exists
    const existingVersion = await this.versionRepository.findOne({
      where: { fileId, version },
    });
    if (existingVersion) {
      throw new BadRequestException(
        `Version ${version} already exists for this file`,
      );
    }

    // Create versioned file storage path
    const versionDir = path.join(
      this.persistentStorageBase,
      'versions',
      file.solutionId || 'default',
      fileId,
    );
    const versionedPath = path.join(versionDir, `${version}-${file.filename}`);

    // Ensure version directory exists
    await fs.mkdir(versionDir, { recursive: true });

    // Copy current file to versioned storage
    try {
      await fs.copyFile(file.storedPath, versionedPath);
      this.logger.debug(`Created version ${version} at ${versionedPath}`);
    } catch (error) {
      this.logger.error(`Failed to create version: ${error.message}`);
      throw new InternalServerErrorException('Failed to create version');
    }

    // Create version record
    const fileVersion = this.versionRepository.create({
      fileId,
      version,
      contentHash,
      storedPath: versionedPath,
      size: file.size,
      mimeType: file.mimeType,
      changelog: dto?.changelog || null,
      uploadedBy: file.uploadedBy,
    });

    const saved = await this.versionRepository.save(fileVersion);

    // Update file's current version
    file.currentVersion = version;
    file.lastVersionAt = new Date();
    await this.fileRepository.save(file);

    this.logger.log(`Created version ${version} for file ${file.filename}`);

    // Emit version created event for real-time updates
    this.eventEmitter.emit('file.version_created', {
      fileId: file.id,
      sessionId: file.sessionId,
      solutionId: file.solutionId,
      versionId: saved.id,
      version: saved.version,
      filename: file.filename,
    });

    return saved;
  }

  /**
   * Bump semantic version
   */
  private bumpVersion(
    current: string,
    type: 'major' | 'minor' | 'patch',
  ): string {
    const parts = current.split('.').map(Number);
    if (parts.length !== 3) {
      this.logger.warn(
        `Invalid version format ${current}, resetting to 1.0.0`,
      );
      return '1.0.0';
    }

    const [major, minor, patch] = parts;

    switch (type) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
      default:
        return `${major}.${minor}.${patch + 1}`;
    }
  }

  /**
   * List versions of a file
   */
  async listVersions(fileId: string): Promise<FileVersion[]> {
    return this.versionRepository.find({
      where: { fileId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a specific version
   */
  async getVersion(fileId: string, version: string): Promise<FileVersion> {
    const fileVersion = await this.versionRepository.findOne({
      where: { fileId, version },
    });

    if (!fileVersion) {
      throw new NotFoundException(
        `Version ${version} not found for file ${fileId}`,
      );
    }

    return fileVersion;
  }

  /**
   * Rollback file to a specific version
   *
   * This creates a new version with the content from the target version.
   * The version history is preserved (no data loss).
   */
  async rollbackToVersion(
    fileId: string,
    targetVersion: string,
  ): Promise<AgentFile> {
    const file = await this.findByIdOrFail(fileId);
    const version = await this.getVersion(fileId, targetVersion);

    try {
      // Read content from the target version
      const versionContent = await fs.readFile(version.storedPath);

      // Overwrite current file with version content
      await fs.writeFile(file.storedPath, versionContent);

      // Update file metadata
      file.size = version.size;
      file.status = 'modified';
      const updated = await this.fileRepository.save(file);

      // Create a new version to record the rollback
      await this.createVersion(fileId, {
        bumpType: 'minor',
        changelog: `Rollback to version ${targetVersion}`,
      });

      this.logger.log(
        `Rolled back file ${file.filename} to version ${targetVersion}`,
      );

      // Emit file modified event for real-time updates
      this.eventEmitter.emit('file.modified', {
        fileId: updated.id,
        sessionId: updated.sessionId,
        solutionId: updated.solutionId,
        filename: updated.filename,
        status: updated.status,
        action: 'rollback',
        targetVersion,
      });

      return updated;
    } catch (error) {
      this.logger.error(`Failed to rollback file: ${error.message}`);
      throw new InternalServerErrorException('Failed to rollback file');
    }
  }

  /**
   * Compare two versions of a file
   *
   * Returns basic comparison metadata. For detailed diff,
   * the frontend should download both versions and compute diff client-side.
   */
  async compareVersions(
    fileId: string,
    fromVersion: string,
    toVersion: string,
  ): Promise<{
    from: FileVersion;
    to: FileVersion;
    sizeDiff: number;
    hashChanged: boolean;
  }> {
    const from = await this.getVersion(fileId, fromVersion);
    const to = await this.getVersion(fileId, toVersion);

    return {
      from,
      to,
      sizeDiff: to.size - from.size,
      hashChanged: from.contentHash !== to.contentHash,
    };
  }

  /**
   * Get version file content for download
   */
  async getVersionContent(
    fileId: string,
    version: string,
  ): Promise<{
    content: Buffer;
    filename: string;
    mimeType: string | null;
    size: number;
  }> {
    const fileVersion = await this.getVersion(fileId, version);
    const file = await this.findByIdOrFail(fileId);

    try {
      const content = await fs.readFile(fileVersion.storedPath);
      return {
        content,
        filename: `${file.filename}.v${version}`,
        mimeType: fileVersion.mimeType,
        size: fileVersion.size,
      };
    } catch (error) {
      this.logger.error(
        `Failed to read version content: ${error.message}`,
      );
      throw new NotFoundException('Version content not available');
    }
  }

  /**
   * Delete a specific version
   * (Admin operation - use with caution)
   */
  async deleteVersion(fileId: string, version: string): Promise<void> {
    const fileVersion = await this.getVersion(fileId, version);

    // Delete versioned file
    try {
      await fs.unlink(fileVersion.storedPath);
      this.logger.debug(`Deleted version file ${fileVersion.storedPath}`);
    } catch (error) {
      this.logger.warn(
        `Failed to delete version file ${fileVersion.storedPath}: ${error.message}`,
      );
    }

    // Delete database record
    await this.versionRepository.delete(fileVersion.id);
    this.logger.log(
      `Deleted version ${version} of file ${fileId}`,
    );
  }
}
