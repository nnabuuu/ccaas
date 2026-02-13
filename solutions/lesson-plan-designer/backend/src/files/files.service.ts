import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { DATABASE_TOKEN } from '../database/database.module';
import * as Database from 'better-sqlite3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { lookup as mimeLookup } from 'mime-types';
import type {
  FileTreeNode,
  FilePreviewResponse,
  FileUploadResult,
  AgentFile,
} from './dto/file.dto';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly persistentStorageBase: string;

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database.Database,
  ) {
    // Persistent storage location - use ./data/files for lesson-plan-designer
    this.persistentStorageBase = process.env.FILE_STORAGE_PATH || './data/files';
  }

  /**
   * Find a file by ID
   */
  async findById(id: string): Promise<AgentFile | null> {
    const file = this.db
      .prepare('SELECT * FROM agent_files WHERE id = ?')
      .get(id) as AgentFile | undefined;

    return file || null;
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
   * Find all files for a session
   */
  async findBySessionId(sessionId: string): Promise<AgentFile[]> {
    const files = this.db
      .prepare('SELECT * FROM agent_files WHERE session_id = ? ORDER BY created_at ASC')
      .all(sessionId) as AgentFile[];

    return files;
  }

  /**
   * Get file path for download
   */
  getFilePath(file: AgentFile): string {
    return file.stored_path;
  }

  /**
   * Check if a file exists in storage
   */
  async fileExists(id: string): Promise<boolean> {
    const file = await this.findById(id);
    if (!file) return false;

    try {
      await fs.access(file.stored_path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get session files organized as a tree structure
   * ENHANCED: Hybrid mode - database + filesystem fallback
   */
  async getSessionFilesAsTree(
    sessionId: string,
    options?: {
      includeMessage?: boolean;
      scanFilesystem?: boolean;
      autoImport?: boolean;
    }
  ): Promise<{
    tree: FileTreeNode[];
    stats: {
      totalFiles: number;
      newFiles: number;
      trackedInDb: number;
      scannedFromFs: number;
    };
  }> {
    const opts = {
      includeMessage: true,
      scanFilesystem: true,
      autoImport: false,
      ...options,
    };

    // Step 1: Get files from database
    let dbFiles = await this.findBySessionId(sessionId);
    let scannedFiles: AgentFile[] = [];

    // Step 2: Fallback to filesystem scan if database is empty
    if (dbFiles.length === 0 && opts.scanFilesystem) {
      scannedFiles = await this.scanWorkspaceFiles(sessionId);

      // Step 3: Optional auto-import scanned files to database
      if (opts.autoImport && scannedFiles.length > 0) {
        this.logger.log(`Auto-importing ${scannedFiles.length} scanned files to database`);
        for (const file of scannedFiles) {
          try {
            // Import to database (create permanent record)
            const fileBuffer = await fs.readFile(file.stored_path);
            await this.importScannedFile(file, fileBuffer);
          } catch (error) {
            this.logger.warn(`Failed to import file ${file.filename}: ${error.message}`);
          }
        }
        // Re-query database after import
        dbFiles = await this.findBySessionId(sessionId);
        scannedFiles = []; // Clear scanned files (now in DB)
      }
    }

    // Step 4: Combine database + scanned files
    const allFiles = [...dbFiles, ...scannedFiles];

    // Step 5: Build tree with message info
    const tree = await this.buildFileTreeWithMessages(allFiles, opts.includeMessage);

    // Step 6: Calculate stats
    const stats = {
      totalFiles: allFiles.length,
      newFiles: allFiles.filter(f => f.status === 'new').length,
      trackedInDb: dbFiles.length,
      scannedFromFs: scannedFiles.length,
    };

    return { tree, stats };
  }

  /**
   * Scan workspace directory for files (fallback when database is empty)
   * Returns files that exist in filesystem but not in database
   */
  private async scanWorkspaceFiles(sessionId: string): Promise<AgentFile[]> {
    const workspaceBase = process.env.WORKSPACE_DIR || './.agent-workspace';
    const sessionWorkspace = path.join(workspaceBase, 'sessions', sessionId);

    try {
      await fs.access(sessionWorkspace);
    } catch {
      // Session workspace doesn't exist
      return [];
    }

    const scannedFiles: AgentFile[] = [];

    const scanDir = async (dir: string, basePath: string = '') => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.join(basePath, entry.name);

        // Skip .claude and .context directories
        if (entry.name.startsWith('.')) continue;

        if (entry.isDirectory()) {
          await scanDir(fullPath, relativePath);
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          const mimeType = mimeLookup(entry.name) || null;

          // Create pseudo AgentFile (not in database)
          scannedFiles.push({
            id: `fs-${crypto.randomUUID()}`, // Temporary ID
            message_id: null,
            session_id: sessionId,
            tenant_id: null,
            original_path: relativePath,
            stored_path: fullPath,
            filename: entry.name,
            mime_type: mimeType,
            size: stats.size,
            status: 'synced', // Mark as synced (historical file)
            uploaded_by: 'agent',
            current_version: '1.0.0',
            last_version_at: null,
            created_at: stats.birthtime.toISOString(),
            updated_at: stats.mtime.toISOString(),
            downloaded_at: null,
          });
        }
      }
    };

    await scanDir(sessionWorkspace);
    this.logger.debug(`Scanned ${scannedFiles.length} files from filesystem for session ${sessionId}`);
    return scannedFiles;
  }

  /**
   * Import scanned file to database
   */
  private async importScannedFile(file: AgentFile, fileBuffer: Buffer): Promise<void> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO agent_files (
          id, message_id, session_id, tenant_id, original_path, stored_path,
          filename, mime_type, size, status, uploaded_by, current_version,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        null, // No message link for imported files
        file.session_id,
        file.tenant_id,
        file.original_path,
        file.stored_path,
        file.filename,
        file.mime_type,
        file.size,
        'synced', // Mark as synced (historical file)
        'agent',
        '1.0.0',
        file.created_at,
        now
      );
  }

  /**
   * Build a hierarchical file tree from flat file list
   * ENHANCED: Optionally include message information for 跳转
   */
  private async buildFileTreeWithMessages(
    files: AgentFile[],
    includeMessage: boolean = true
  ): Promise<FileTreeNode[]> {
    // Step 1: Build basic tree structure
    const root: FileTreeNode[] = [];
    const folderMap = new Map<string, FileTreeNode>();

    for (const file of files) {
      const normalizedPath = file.original_path.replace(/^\/+/, '');
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
      const fileNode: FileTreeNode = {
        id: `file-${file.id}`,
        name: fileName,
        type: 'file',
        path: file.original_path,
        fileId: file.id,
        mimeType: file.mime_type || undefined,
        size: file.size,
        status: file.status,
        uploadedBy: file.uploaded_by,
        createdAt: new Date(file.created_at),
        currentVersion: file.current_version,
        lastModifiedAt: file.updated_at ? new Date(file.updated_at) : null,
      };

      currentLevel.push(fileNode);
    }

    // Step 2: Enrich with message information (if requested)
    if (includeMessage) {
      const fileNodes = this.collectFileNodes(root);
      const messageIds = [...new Set(
        files.filter(f => f.message_id).map(f => f.message_id!)
      )];

      if (messageIds.length > 0) {
        const messages = await this.getMessagesByIds(messageIds);
        const messageMap = new Map(messages.map(m => [m.id, m]));

        for (const fileNode of fileNodes) {
          const file = files.find(f => f.id === fileNode.fileId);
          if (file?.message_id) {
            const message = messageMap.get(file.message_id);
            if (message) {
              fileNode.messageId = message.id;
              fileNode.messagePreview = this.truncate(message.content, 100);
              fileNode.messageCreatedAt = new Date(message.created_at);
            }
          }
        }
      }
    }

    // Step 3: Sort tree
    this.sortFileTree(root);

    return root;
  }

  /**
   * Collect all file nodes from tree (recursive)
   */
  private collectFileNodes(nodes: FileTreeNode[]): FileTreeNode[] {
    const files: FileTreeNode[] = [];
    for (const node of nodes) {
      if (node.type === 'file') {
        files.push(node);
      }
      if (node.children) {
        files.push(...this.collectFileNodes(node.children));
      }
    }
    return files;
  }

  /**
   * Get messages by IDs (batch query)
   */
  private async getMessagesByIds(messageIds: string[]): Promise<any[]> {
    if (messageIds.length === 0) return [];

    const placeholders = messageIds.map(() => '?').join(',');
    const messages = this.db
      .prepare(`SELECT id, role, content, created_at FROM messages WHERE id IN (${placeholders})`)
      .all(...messageIds);

    return messages;
  }

  /**
   * Truncate text to max length
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }

  /**
   * Sort file tree (folders first, then files, alphabetically)
   */
  private sortFileTree(nodes: FileTreeNode[]): void {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    for (const node of nodes) {
      if (node.children) {
        this.sortFileTree(node.children);
      }
    }
  }

  /**
   * Create file record from Write tool execution
   * Called by WriteFileTrackerHook
   */
  async createFromWriteTool(params: {
    messageId: string;
    sessionId: string;
    tenantId?: string;
    originalPath: string;
    workspaceDir: string;
  }): Promise<FileUploadResult> {
    const { messageId, sessionId, tenantId, originalPath, workspaceDir } = params;

    // Read file from workspace
    const filePath = path.join(workspaceDir, originalPath);
    const fileBuffer = await fs.readFile(filePath);
    const filename = path.basename(originalPath);
    const mimeType = mimeLookup(filename) || null;
    const id = crypto.randomUUID();

    // Copy to persistent storage
    const subDir = sessionId;
    const storedDir = path.join(this.persistentStorageBase, subDir);
    const storedPath = path.join(storedDir, filename);

    await fs.mkdir(storedDir, { recursive: true });
    await fs.writeFile(storedPath, fileBuffer);

    // Create database record
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO agent_files (
          id, message_id, session_id, tenant_id, original_path, stored_path,
          filename, mime_type, size, status, uploaded_by, current_version,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        messageId,
        sessionId,
        tenantId || null,
        originalPath,
        storedPath,
        filename,
        mimeType,
        fileBuffer.length,
        'new',
        'agent',
        '1.0.0',
        now,
        now
      );

    this.logger.log(
      `Tracked agent file ${filename} (${fileBuffer.length} bytes) for message ${messageId}`
    );

    const saved = await this.findByIdOrFail(id);

    return {
      id: saved.id,
      filename: saved.filename,
      originalPath: saved.original_path,
      mimeType: saved.mime_type,
      size: saved.size,
      status: saved.status,
      uploadedBy: saved.uploaded_by,
      createdAt: new Date(saved.created_at),
    };
  }

  /**
   * Mark a file as synced (downloaded by user)
   */
  async markAsSynced(fileId: string): Promise<AgentFile> {
    const file = await this.findByIdOrFail(fileId);

    const now = new Date().toISOString();
    this.db
      .prepare(
        'UPDATE agent_files SET status = ?, downloaded_at = ?, updated_at = ? WHERE id = ?',
      )
      .run('synced', now, now, fileId);

    return await this.findByIdOrFail(fileId);
  }

  /**
   * Mark all files in session as synced
   */
  async markAllFilesSeen(sessionId: string): Promise<number> {
    const files = await this.findBySessionId(sessionId);
    const newFiles = files.filter((f) => f.status === 'new');

    const now = new Date().toISOString();
    for (const file of newFiles) {
      this.db
        .prepare(
          'UPDATE agent_files SET status = ?, downloaded_at = ?, updated_at = ? WHERE id = ?',
        )
        .run('synced', now, now, file.id);
    }

    return newFiles.length;
  }

  /**
   * Upload a file from user
   */
  async uploadFile(
    fileBuffer: Buffer,
    originalFilename: string,
    sessionId: string,
    messageId: string | null,
    tenantId?: string,
    targetPath?: string,
    workspaceDir?: string,
  ): Promise<FileUploadResult> {
    const filename = path.basename(originalFilename);
    const mimeType = mimeLookup(filename) || null;
    const id = crypto.randomUUID();

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
    const subDir = sessionId;
    const storedDir = path.join(this.persistentStorageBase, subDir);
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
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO agent_files (
          id, message_id, session_id, tenant_id, original_path, stored_path,
          filename, mime_type, size, status, uploaded_by, current_version,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        messageId,
        sessionId,
        tenantId || null,
        originalPath,
        storedPath,
        filename,
        mimeType,
        fileBuffer.length,
        'new',
        'user',
        '1.0.0',
        now,
        now,
      );

    this.logger.log(
      `Created user upload record ${id} for ${filename} (${fileBuffer.length} bytes)`,
    );

    const saved = await this.findByIdOrFail(id);

    return {
      id: saved.id,
      filename: saved.filename,
      originalPath: saved.original_path,
      mimeType: saved.mime_type,
      size: saved.size,
      status: saved.status,
      uploadedBy: saved.uploaded_by,
      createdAt: new Date(saved.created_at),
    };
  }

  /**
   * Validate file upload
   */
  validateUpload(
    file: Express.Multer.File,
    maxSizeBytes = 50 * 1024 * 1024, // Default 50MB
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
    const isText = this.isTextFile(file.mime_type);
    const isImage = file.mime_type?.startsWith('image/');

    try {
      const stats = await fs.stat(file.stored_path);
      const actualSize = stats.size;
      const truncated = actualSize > maxBytes;
      const readSize = truncated ? maxBytes : actualSize;

      if (isImage) {
        // For images, return base64 encoded content
        const buffer = await this.readFilePartial(file.stored_path, readSize);
        return {
          content: buffer.toString('base64'),
          truncated,
          encoding: 'base64',
          mimeType: file.mime_type || 'application/octet-stream',
          size: actualSize,
        };
      } else if (isText) {
        // For text files, return UTF-8 content
        const buffer = await this.readFilePartial(file.stored_path, readSize);
        return {
          content: buffer.toString('utf8'),
          truncated,
          encoding: 'utf8',
          mimeType: file.mime_type || 'text/plain',
          size: actualSize,
        };
      } else {
        // For binary files, return base64
        const buffer = await this.readFilePartial(file.stored_path, readSize);
        return {
          content: buffer.toString('base64'),
          truncated,
          encoding: 'base64',
          mimeType: file.mime_type || 'application/octet-stream',
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
   * Delete a file record and its stored content
   */
  async delete(id: string): Promise<void> {
    const file = await this.findByIdOrFail(id);

    // Delete stored file
    try {
      await fs.unlink(file.stored_path);
      this.logger.debug(`Deleted stored file ${file.stored_path}`);
    } catch (error) {
      this.logger.warn(
        `Failed to delete stored file ${file.stored_path}: ${error.message}`,
      );
    }

    // Delete database record
    this.db.prepare('DELETE FROM agent_files WHERE id = ?').run(id);
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
        await fs.unlink(file.stored_path);
      } catch {
        // Ignore errors for individual file deletions
      }
    }

    // Delete database records
    const result = this.db
      .prepare('DELETE FROM agent_files WHERE session_id = ?')
      .run(sessionId);

    this.logger.debug(
      `Deleted ${result.changes} file records for session ${sessionId}`,
    );

    return result.changes || 0;
  }

  /**
   * Get message information (for frontend跳转)
   */
  async getMessageInfo(messageId: string): Promise<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: Date;
    files: string[];
  }> {
    const message = this.db
      .prepare('SELECT id, role, content, created_at FROM messages WHERE id = ?')
      .get(messageId) as { id: string; role: 'user' | 'assistant'; content: string; created_at: string } | undefined;

    if (!message) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    // Get all files created by this message
    const files = this.db
      .prepare('SELECT id FROM agent_files WHERE message_id = ?')
      .all(messageId) as { id: string }[];

    return {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: new Date(message.created_at),
      files: files.map(f => f.id),
    };
  }
}
