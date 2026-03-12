/**
 * Attachment Service
 *
 * Handles file attachment operations for session management.
 *
 * Responsibilities:
 * - Resolve attachment paths (relative → absolute)
 * - Validate attachment existence
 * - Guess MIME types from file extensions
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Attachment input from REST API
 */
export interface AttachmentInput {
  type: string;        // 'image' | 'document'
  path: string;        // Relative path in workspace
}

/**
 * Resolved attachment with absolute path and MIME type
 */
export interface ResolvedAttachment {
  type: string;
  absolutePath: string;
  mimeType: string;
}

@Injectable()
export class AttachmentService {
  private readonly logger = new Logger(AttachmentService.name);

  /**
   * Guess MIME type from file extension
   *
   * @param filePath - File path (absolute or relative)
   * @returns MIME type string
   */
  guessMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const map: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.csv': 'text/csv',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
    };
    return map[ext] || 'application/octet-stream';
  }

  /**
   * Resolve attachments from relative paths to absolute paths
   *
   * Converts REST API attachment inputs to resolved attachments
   * with absolute paths and MIME types.
   *
   * @param attachments - Array of attachment inputs
   * @param workspaceDir - Session workspace directory
   * @param validateExistence - Whether to validate files exist (default: false)
   * @returns Array of resolved attachments
   * @throws BadRequestException if validation fails
   */
  resolveAttachments(
    attachments: AttachmentInput[] | undefined,
    workspaceDir: string,
    validateExistence = false,
  ): ResolvedAttachment[] | undefined {
    if (!attachments || attachments.length === 0) {
      return undefined;
    }

    const normalizedWorkspace = path.resolve(workspaceDir);

    const resolved = attachments.map(a => {
      const absolutePath = path.resolve(workspaceDir, a.path);
      const mimeType = this.guessMimeType(a.path);

      // Path traversal protection — ensure resolved path stays within workspace
      if (!absolutePath.startsWith(normalizedWorkspace + path.sep) && absolutePath !== normalizedWorkspace) {
        throw new BadRequestException(
          `Invalid attachment path (path traversal detected): ${a.path}`,
        );
      }

      // Optionally validate file exists
      if (validateExistence && !fs.existsSync(absolutePath)) {
        throw new BadRequestException(
          `Attachment file not found: ${a.path}`,
        );
      }

      return {
        type: a.type,
        absolutePath,
        mimeType,
      };
    });

    this.logger.debug(`Resolved ${resolved.length} attachments`);
    return resolved;
  }

  /**
   * Validate attachment paths for security
   *
   * Ensures paths don't escape workspace directory (path traversal protection)
   *
   * @param attachments - Attachment inputs to validate
   * @param workspaceDir - Session workspace directory
   * @throws BadRequestException if path traversal detected
   */
  validateAttachmentPaths(
    attachments: AttachmentInput[] | undefined,
    workspaceDir: string,
  ): void {
    if (!attachments) return;

    const normalizedWorkspace = path.resolve(workspaceDir);

    for (const attachment of attachments) {
      const absolutePath = path.resolve(workspaceDir, attachment.path);

      // Check for path traversal
      if (!absolutePath.startsWith(normalizedWorkspace)) {
        throw new BadRequestException(
          `Invalid attachment path (path traversal detected): ${attachment.path}`,
        );
      }
    }
  }
}
