import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentFile } from './entities/agent-file.entity';
import * as fs from 'fs/promises';
import * as path from 'path';
import { lookup as mimeLookup } from 'mime-types';

export interface CreateFromWriteToolDto {
  messageId: string;
  sessionId: string;
  tenantId?: string;
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
  ) {
    // Persistent storage location
    this.persistentStorageBase =
      process.env.FILE_STORAGE_PATH || '.agent-workspace/files';
  }

  /**
   * Create a file record from Write tool result
   * Copies the file from session workspace to persistent storage
   */
  async createFromWriteTool(dto: CreateFromWriteToolDto): Promise<AgentFile> {
    const { messageId, sessionId, tenantId, originalPath, workspaceDir } = dto;

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

    // Create persistent storage path: files/{tenantId}/{messageId}/{filename}
    const tenantDir = tenantId || 'default';
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
      tenantId: tenantId || null,
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
}
